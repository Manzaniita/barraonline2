import { beforeAll, describe, expect, it } from 'vitest';
import { withSuperadminContext, withTenantContext } from '@/db';
import {
  configureTenantCommissionRule,
  generateWeeklySettlementForTenant,
  recordManualSettlementPayment,
} from '@/modules/billing-settlements/settlement-service';
import {
  createCheckoutAndReserveStock,
  releaseExpiredStockReservationsForTenant,
} from '@/modules/inventory/checkout-and-stock-service';
import {
  confirmOrderPaymentAndIssueQr,
  executeOrderRefundOrChargeback,
  saveTenantMercadoPagoOAuthCredentials,
} from '@/modules/payments/mercadopago-service';
import {
  inspectQrAtBar,
  redeemQrAtBarAtomically,
  resolveStockConflictAtBar,
} from '@/modules/qr-redemption/qr-service';

const TENANT_MUSEUM = '10101010-1111-4111-8111-111111111111';
const TENANT_PUEBLO = '20202020-2222-4222-8222-222222222222';
const CAT_VIP_MUSEUM = '30303030-1111-4111-8111-111111111111';
const PROD_LIMITED_BOTTLE = '40404040-1111-4111-8111-111111111111';
const PROD_LAST_UNIT_BOTTLE = '40404040-2222-4222-8222-222222222222';
const PROD_SUBSTITUTE_BOTTLE = '40404040-3333-4333-8333-333333333333';
const STAFF_BARMAN_MUSEUM = '50505050-1111-4111-8111-111111111111';
const STAFF_BARMAN_PUEBLO = '50505050-2222-4222-8222-222222222222';
const STATION_MAIN_MUSEUM = '60606060-1111-4111-8111-111111111111';

describe('Concurrencia ACID, Stock, Pagos Tardíos (STOCK_CONFLICT), QR Único y Liquidaciones', () => {
  beforeAll(async () => {
    await withSuperadminContext(async (tx) => {
      await tx.query(
        `INSERT INTO tenants (id, slug, legal_name, fantasy_name, cuit, status, reservation_ttl_seconds)
         VALUES
           ($1, 'museum-conc', 'Museum Nocturno SA', 'Museum Costanera', '30-70000001-9', 'ACTIVE', 300),
           ($2, 'pueblo-conc', 'Pueblo Gesell SRL', 'Pueblo Límite', '30-70000002-9', 'ACTIVE', 300)
         ON CONFLICT (id) DO NOTHING`,
        [TENANT_MUSEUM, TENANT_PUEBLO]
      );
    });

    await configureTenantCommissionRule({
      tenantId: TENANT_MUSEUM,
      commissionBps: 600, // 6.00%
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      notes: 'Comisión temporada verano 6%',
    });

    await saveTenantMercadoPagoOAuthCredentials({
      tenantId: TENANT_MUSEUM,
      actorRole: 'OWNER',
      mpUserId: 9001001,
      mpPublicKey: 'APP_USR-museum-pub',
      accessToken: 'APP_USR-museum-live-token',
      refreshToken: 'TG-museum-refresh-token',
    });

    await withTenantContext(TENANT_MUSEUM, async (tx) => {
      await tx.query(
        `INSERT INTO categories (id, tenant_id, name, sort_order)
         VALUES ($1, $2, 'Botellas y Combos', 1)
         ON CONFLICT (id) DO NOTHING`,
        [CAT_VIP_MUSEUM, TENANT_MUSEUM]
      );

      await tx.query(
        `INSERT INTO products (id, tenant_id, category_id, name, price_cents, stock_total)
         VALUES
           ($1, $4, $5, 'Combo Grey Goose + 4 Speed', 9000000, 3),
           ($2, $4, $5, 'Botella Chandon Extra Brut', 4000000, 1),
           ($3, $4, $5, 'Botella Baron B Extra Brut (Sustituto)', 4500000, 10)
         ON CONFLICT (id) DO NOTHING`,
        [
          PROD_LIMITED_BOTTLE,
          PROD_LAST_UNIT_BOTTLE,
          PROD_SUBSTITUTE_BOTTLE,
          TENANT_MUSEUM,
          CAT_VIP_MUSEUM,
        ]
      );

      await tx.query(
        `INSERT INTO tenant_users (id, tenant_id, staff_display_name, role)
         VALUES ($1, $2, 'Matías (Barman Pista)', 'BARTENDER')
         ON CONFLICT (id) DO NOTHING`,
        [STAFF_BARMAN_MUSEUM, TENANT_MUSEUM]
      );

      await tx.query(
        `INSERT INTO bar_stations (id, tenant_id, name, sector, device_token_hash, expires_at)
         VALUES ($1, $2, 'Barra Pista Central #1', 'Pista Central', 'dev-hash-museum-1', now() + interval '30 days')
         ON CONFLICT (id) DO NOTHING`,
        [STATION_MAIN_MUSEUM, TENANT_MUSEUM]
      );
    });

    await withTenantContext(TENANT_PUEBLO, async (tx) => {
      await tx.query(
        `INSERT INTO tenant_users (id, tenant_id, staff_display_name, role)
         VALUES ($1, $2, 'Lucas (Barman Pueblo)', 'BARTENDER')
         ON CONFLICT (id) DO NOTHING`,
        [STAFF_BARMAN_PUEBLO, TENANT_PUEBLO]
      );
    });
  });

  it('impide la sobreventa ante 20 checkouts simultáneos por las últimas 3 botellas y respeta idempotencia', async () => {
    // 1. Prueba de idempotencia e ignorancia de precio manipulado por el cliente
    const firstAttempt = await createCheckoutAndReserveStock({
      tenantId: TENANT_MUSEUM,
      idempotencyKey: 'idem-checkout-001',
      items: [
        {
          productId: PROD_LIMITED_BOTTLE,
          quantity: 1,
          clientUntrustedPriceCents: 100, // Cliente intenta pagar $1 ARS en lugar de $90.000 ARS
        },
      ],
    });
    expect(firstAttempt.totalCents).toBe(9000000);
    expect(firstAttempt.isIdempotentReplay).toBe(false);

    const duplicateAttempt = await createCheckoutAndReserveStock({
      tenantId: TENANT_MUSEUM,
      idempotencyKey: 'idem-checkout-001',
      items: [{ productId: PROD_LIMITED_BOTTLE, quantity: 1 }],
    });
    expect(duplicateAttempt.orderId).toBe(firstAttempt.orderId);
    expect(duplicateAttempt.isIdempotentReplay).toBe(true);

    // 2. Lanzamos 19 compradores adicionales en paralelo compitiendo por las 2 botellas restantes (total stock = 3)
    const concurrentPromises = Array.from({ length: 19 }, (_, idx) =>
      createCheckoutAndReserveStock({
        tenantId: TENANT_MUSEUM,
        idempotencyKey: `idem-race-buyer-${idx + 2}`,
        items: [{ productId: PROD_LIMITED_BOTTLE, quantity: 1 }],
      })
    );

    const results = await Promise.allSettled(concurrentPromises);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactamente 2 más pudieron reservar (1 inicial + 2 = 3 totales); los otros 17 fueron rechazados con OUT_OF_STOCK
    expect(fulfilled.length).toBe(2);
    expect(rejected.length).toBe(17);

    await withTenantContext(TENANT_MUSEUM, async (tx) => {
      const prodCheck = await tx.query<{
        stock_total: number;
        stock_reserved: number;
        stock_sold: number;
      }>(`SELECT stock_total, stock_reserved, stock_sold FROM products WHERE id = $1`, [
        PROD_LIMITED_BOTTLE,
      ]);
      expect(prodCheck.rows[0]).toEqual({
        stock_total: 3,
        stock_reserved: 3,
        stock_sold: 0,
      });
    });
  });

  it('bloquea dobles canjes ante 15 escaneos simultáneos del mismo QR y bloquea escaneo desde otro boliche', async () => {
    // Confirmamos el pago de una de las reservas de $90.000 ARS
    const checkout = await createCheckoutAndReserveStock({
      tenantId: TENANT_MUSEUM,
      idempotencyKey: 'idem-checkout-001', // Recupera la primera orden reservada
      items: [{ productId: PROD_LIMITED_BOTTLE, quantity: 1 }],
    });

    const confirmation = await confirmOrderPaymentAndIssueQr({
      tenantId: TENANT_MUSEUM,
      orderId: checkout.orderId,
      mpPaymentId: 777000111,
      grossAmountCents: 9000000,
    });
    expect(confirmation.qrStatus).toBe('ACTIVE');
    expect(confirmation.commissionChargedCents).toBe(540000); // 6% de 9.000.000 = 540.000 centavos ($5.400 ARS)

    // Webhook duplicado de Mercado Pago para el mismo pago -> Idempotente
    const duplicateWebhook = await confirmOrderPaymentAndIssueQr({
      tenantId: TENANT_MUSEUM,
      orderId: checkout.orderId,
      mpPaymentId: 777000111,
      grossAmountCents: 9000000,
    });
    expect(duplicateWebhook.wasIdempotentDuplicate).toBe(true);
    expect(duplicateWebhook.qrId).toBe(confirmation.qrId);

    // Intento de escanear el QR de Museum en la barra de Pueblo Límite -> REJECTED_WRONG_TENANT
    const crossTenantInspect = await inspectQrAtBar({
      tenantId: TENANT_PUEBLO,
      actorRole: 'BARTENDER',
      actorTenantUserId: STAFF_BARMAN_PUEBLO,
      rawQrToken: confirmation.qrRawToken,
    });
    expect(crossTenantInspect.validTenantMatch).toBe(false);
    expect(crossTenantInspect.lookupOutcome).toBe('WRONG_TENANT');

    // Ahora 15 barmans/terminales de Museum escanean y confirman el retiro del mismo QR al mismo tiempo
    const scanPromises = Array.from({ length: 15 }, () =>
      redeemQrAtBarAtomically({
        tenantId: TENANT_MUSEUM,
        actorRole: 'BARTENDER',
        actorTenantUserId: STAFF_BARMAN_MUSEUM,
        stationId: STATION_MAIN_MUSEUM,
        rawQrToken: confirmation.qrRawToken,
      })
    );

    const scanResults = await Promise.all(scanPromises);
    const winners = scanResults.filter((r) => r.outcome === 'REDEEMED_SUCCESSFULLY');
    const losers = scanResults.filter((r) => r.outcome === 'REJECTED_ALREADY_REDEEMED');

    expect(winners.length).toBe(1);
    expect(losers.length).toBe(14);
    expect(losers[0]?.previousRedemption?.redeemedByStaffName).toBe(
      'Matías (Barman Pista)'
    );
    expect(losers[0]?.previousRedemption?.stationName).toBe('Barra Pista Central #1');
  });

  it('resuelve correctamente una confirmación tardía de Mercado Pago cuando la reserva expiró y se agotó el stock (STOCK_CONFLICT)', async () => {
    const t0 = new Date('2026-10-31T04:00:00.000Z');
    // 1. Cliente A inicia checkout por la última botella de Chandon (stock_total = 1)
    const buyerA = await createCheckoutAndReserveStock({
      tenantId: TENANT_MUSEUM,
      idempotencyKey: 'idem-late-buyer-a',
      items: [{ productId: PROD_LAST_UNIT_BOTTLE, quantity: 1 }],
      now: t0,
    });

    // 2. Pasan 8 minutos sin novedad de MP -> el worker expira la reserva de Cliente A y libera la botella
    const tExpired = new Date('2026-10-31T04:08:00.000Z');
    const released = await releaseExpiredStockReservationsForTenant(
      TENANT_MUSEUM,
      tExpired
    );
    expect(released.releasedOrderIds).toContain(buyerA.orderId);

    // 3. Cliente B entra a las 04:09, compra esa última botella y su pago se aprueba en el acto
    const buyerB = await createCheckoutAndReserveStock({
      tenantId: TENANT_MUSEUM,
      idempotencyKey: 'idem-fast-buyer-b',
      items: [{ productId: PROD_LAST_UNIT_BOTTLE, quantity: 1 }],
      now: new Date('2026-10-31T04:09:00.000Z'),
    });
    const confirmB = await confirmOrderPaymentAndIssueQr({
      tenantId: TENANT_MUSEUM,
      orderId: buyerB.orderId,
      mpPaymentId: 888000222,
      grossAmountCents: 4000000,
    });
    expect(confirmB.qrStatus).toBe('ACTIVE');

    // 4. A las 04:11 llega el Webhook tardío de Mercado Pago confirmando que Cliente A SÍ había pagado
    const lateConfirmA = await confirmOrderPaymentAndIssueQr({
      tenantId: TENANT_MUSEUM,
      orderId: buyerA.orderId,
      mpPaymentId: 888000111,
      grossAmountCents: 4000000,
      now: new Date('2026-10-31T04:11:00.000Z'),
    });

    // No se sobrevendió stock inexistente, pero Cliente A recibe su QR en estado STOCK_CONFLICT
    expect(lateConfirmA.qrStatus).toBe('STOCK_CONFLICT');
    expect(lateConfirmA.fulfillmentStatus).toBe('STOCK_CONFLICT');

    // 5. En la barra, el barman escanea el QR de Cliente A y le entrega el sustituto autorizado (Baron B)
    const inspectedA = await inspectQrAtBar({
      tenantId: TENANT_MUSEUM,
      actorRole: 'BARTENDER',
      actorTenantUserId: STAFF_BARMAN_MUSEUM,
      stationId: STATION_MAIN_MUSEUM,
      rawQrToken: lateConfirmA.qrRawToken,
    });
    expect(inspectedA.lookupOutcome).toBe('STOCK_CONFLICT_REQUIRES_RESOLUTION');

    const resolvedSub = await resolveStockConflictAtBar({
      tenantId: TENANT_MUSEUM,
      actorRole: 'BARTENDER',
      actorTenantUserId: STAFF_BARMAN_MUSEUM,
      stationId: STATION_MAIN_MUSEUM,
      rawQrToken: lateConfirmA.qrRawToken,
      resolution: {
        action: 'SUBSTITUTE',
        orderItemId: inspectedA.items![0]!.id,
        substituteProductId: PROD_SUBSTITUTE_BOTTLE,
        notes: 'Entregado Baron B sin cargo adicional por falta de Chandon',
      },
    });
    expect(resolvedSub.qrStatus).toBe('REDEEMED');
    expect(resolvedSub.orderFulfillmentStatus).toBe('RESOLVED_WITH_SUBSTITUTE');
  });

  it('calcula liquidaciones semanales exactas, concilia pagos manuales y ajusta devoluciones post-liquidación en la semana siguiente', async () => {
    // Hasta aquí Museum tiene 3 ventas aprobadas:
    // - Venta 1 (checkout-001): $90.000 ARS (9.000.000 centavos) -> Comisión 6% = $5.400 ARS (540.000 centavos)
    // - Venta 2 (buyerB):       $40.000 ARS (4.000.000 centavos) -> Comisión 6% = $2.400 ARS (240.000 centavos)
    // - Venta 3 (buyerA):       $40.000 ARS (4.000.000 centavos) -> Comisión 6% = $2.400 ARS (240.000 centavos)
    // Total Bruto = $170.000 ARS (17.000.000 centavos) | Comisión total = $10.200 ARS (1.020.000 centavos)

    const settlementW1 = await generateWeeklySettlementForTenant({
      tenantId: TENANT_MUSEUM,
      periodStart: new Date('2026-10-25T00:00:00.000Z'),
      periodEnd: new Date('2026-11-02T00:00:00.000Z'),
      dueDate: '2026-11-05',
      settlementCode: 'LIQ-MUSEUM-2026-W44',
    });

    expect(settlementW1.grossSalesCents).toBe(17000000);
    expect(settlementW1.refundsAndAdjustmentsCents).toBe(0);
    expect(settlementW1.commissionableBaseCents).toBe(17000000);
    expect(settlementW1.commissionDueCents).toBe(1020000);
    expect(settlementW1.status).toBe('ISSUED_PENDING');

    // Registramos un pago parcial por transferencia bancaria ($6.000 ARS = 600.000 centavos)
    const partialPay = await recordManualSettlementPayment({
      tenantId: TENANT_MUSEUM,
      settlementId: settlementW1.id,
      amountCents: 600000,
      paymentMethod: 'BANK_TRANSFER',
      externalReferenceNumber: 'CBU-TRF-00098123',
    });
    expect(partialPay.settlementStatus).toBe('PARTIALLY_PAID');
    expect(partialPay.balanceDueCents).toBe(420000);

    // Intento de cargar dos veces el mismo número de comprobante bancario -> Rechazado por UNIQUE constraint
    await expect(
      recordManualSettlementPayment({
        tenantId: TENANT_MUSEUM,
        settlementId: settlementW1.id,
        amountCents: 420000,
        paymentMethod: 'BANK_TRANSFER',
        externalReferenceNumber: 'CBU-TRF-00098123',
      })
    ).rejects.toThrow();

    // Pago del saldo restante con nuevo comprobante -> Liquidación queda PAID
    const finalPay = await recordManualSettlementPayment({
      tenantId: TENANT_MUSEUM,
      settlementId: settlementW1.id,
      amountCents: 420000,
      paymentMethod: 'BANK_TRANSFER',
      externalReferenceNumber: 'CBU-TRF-00098124',
    });
    expect(finalPay.settlementStatus).toBe('PAID');
    expect(finalPay.balanceDueCents).toBe(0);

    // Ahora, en la Semana 2 (con la liquidación W1 ya cerrada y pagada), entra una devolución parcial de $10.000 ARS (1.000.000 centavos) sobre la Venta 1
    const oldOrderRes = await withTenantContext(TENANT_MUSEUM, async (tx) => {
      return tx.query<{ id: string }>(
        `SELECT id FROM orders WHERE idempotency_key = 'idem-checkout-001' LIMIT 1`
      );
    });
    const postSettlementRefund = await executeOrderRefundOrChargeback({
      tenantId: TENANT_MUSEUM,
      actorRole: 'OWNER',
      orderId: oldOrderRes.rows[0]!.id,
      amountCents: 1000000,
      refundType: 'PARTIAL',
      reason: 'Bonificación comercial post-evento',
      now: new Date('2026-11-03T15:00:00.000Z'),
    });

    // Como la orden original ya estaba liquidada en W1, genera un asiento POST_SETTLEMENT_REFUND_ADJUSTMENT para descontar $600 ARS (60.000 centavos) en la siguiente liquidación
    expect(postSettlementRefund.ledgerEntryType).toBe(
      'POST_SETTLEMENT_REFUND_ADJUSTMENT'
    );
    expect(postSettlementRefund.commissionDeductedCents).toBe(60000);
  });
});
