import { beforeAll, describe, expect, it } from 'vitest';
import { withSuperadminContext, withTenantContext } from '@/db';
import {
  getPublicCatalogForTenant,
  updateProductStockOrPrice,
} from '@/modules/catalog/catalog-service';
import {
  buildGoogleOAuthAuthorizationFlow,
  createSignedGuestSessionToken,
  upsertAuthenticatedGoogleCustomer,
  verifyGoogleOAuthCallbackState,
  verifySignedCustomerSessionToken,
} from '@/modules/identity/customer-auth-service';
import {
  createCheckoutAndReserveStock,
  getAuthorizedCustomerOrder,
  listAuthorizedCustomerOrders,
  recoverAndValidateOrderDraft,
  saveOrderDraft,
} from '@/modules/inventory/checkout-and-stock-service';
import {
  confirmOrderPaymentAndIssueQr,
  createMercadoPagoPreferenceForOrder,
  recordOrderPaymentPending,
  recordOrderPaymentRejected,
  saveTenantMercadoPagoOAuthCredentials,
} from '@/modules/payments/mercadopago-service';
import {
  inspectQrAtBar,
  redeemQrAtBarAtomically,
} from '@/modules/qr-redemption/qr-service';

const EXPRESS_TENANT_ID = '77777777-1111-4111-8111-111111111111';
const EXPRESS_CAT_ID = '77777777-2222-4222-8222-222222222222';
const PROD_FERNET_ID = '77777777-3001-4301-8301-333333333001';
const PROD_GIN_ID = '77777777-3002-4302-8302-333333333002';
const PROD_SOLD_OUT_ID = '77777777-3003-4303-8303-333333333003';
const STAFF_BARMAN_ID = '77777777-4444-4444-8444-444444444444';
const BAR_STATION_ID = '77777777-5555-4555-8555-555555555555';

describe('BarraOnline Express — Flujo Guiado de 4 Pasos (Criterios de Aceptación #1 a #14)', () => {
  beforeAll(async () => {
    await withSuperadminContext(async (tx) => {
      await tx.query(
        `INSERT INTO tenants (id, slug, legal_name, fantasy_name, cuit, status, reservation_ttl_seconds)
         VALUES ($1, 'express-club', 'Express Nocturno SA', 'Express Club', '30-75555555-9', 'ACTIVE', 420)
         ON CONFLICT (id) DO NOTHING`,
        [EXPRESS_TENANT_ID]
      );
    });

    await saveTenantMercadoPagoOAuthCredentials({
      tenantId: EXPRESS_TENANT_ID,
      actorRole: 'OWNER',
      mpUserId: 555000111,
      mpPublicKey: 'APP_USR-express-pub',
      accessToken: 'APP_USR-express-secret-token',
      refreshToken: 'TG-express-refresh',
    });

    await withTenantContext(EXPRESS_TENANT_ID, async (tx) => {
      await tx.query(
        `INSERT INTO categories (id, tenant_id, name, badge_text, sort_order)
         VALUES ($1, $2, 'Tragos Express', 'MÁS PEDIDOS', 1)
         ON CONFLICT (id) DO NOTHING`,
        [EXPRESS_CAT_ID, EXPRESS_TENANT_ID]
      );

      await tx.query(
        `INSERT INTO products (
           id, tenant_id, category_id, name, description,
           price_cents, promo_price_cents, promo_label, stock_total, max_per_order, sort_order
         ) VALUES
           ($1, $4, $5, 'Fernet Branca XL', 'Vaso 750ml con hielo', 1400000, 1200000, 'PROMO', 50, 6, 1),
           ($2, $4, $5, 'Gin Tonic Beefeater XL', 'Con pomelo rosado', 1500000, NULL, NULL, 30, 6, 2),
           ($3, $4, $5, 'Champagne Edición Agotada', 'Sin stock', 6000000, NULL, NULL, 0, 2, 3)
         ON CONFLICT (id) DO NOTHING`,
        [
          PROD_FERNET_ID,
          PROD_GIN_ID,
          PROD_SOLD_OUT_ID,
          EXPRESS_TENANT_ID,
          EXPRESS_CAT_ID,
        ]
      );

      await tx.query(
        `INSERT INTO tenant_users (id, tenant_id, staff_display_name, role)
         VALUES ($1, $2, 'Julián (Barman Express)', 'BARTENDER')
         ON CONFLICT (id) DO NOTHING`,
        [STAFF_BARMAN_ID, EXPRESS_TENANT_ID]
      );

      await tx.query(
        `INSERT INTO bar_stations (id, tenant_id, name, sector, device_token_hash, expires_at)
         VALUES ($1, $2, 'Barra Express #1', 'Pista Principal', 'express-station-hash-1', now() + interval '30 days')
         ON CONFLICT (id) DO NOTHING`,
        [BAR_STATION_ID, EXPRESS_TENANT_ID]
      );
    });
  });

  it('Escenarios 1, 2, 3 y 4: selección de múltiples tragos, guardado de borrador, autenticación Google con CSRF/PKCE y recuperación en el paso correcto', async () => {
    const guestSession = createSignedGuestSessionToken();

    // 1. El cliente explora la carta y guarda un borrador en el Paso 2 antes de autenticarse con Google
    const catalog = await getPublicCatalogForTenant(EXPRESS_TENANT_ID);
    expect(catalog.products.length).toBe(3);

    const draft = await saveOrderDraft({
      tenantId: EXPRESS_TENANT_ID,
      guestSessionToken: guestSession.rawSessionId,
      savedStep: 3,
      items: [
        { productId: PROD_FERNET_ID, quantity: 2 },
        { productId: PROD_GIN_ID, quantity: 1 },
      ],
    });
    expect(draft.canRecoverAcrossDevices).toBe(false);
    expect(draft.subtotalSnapshotCents).toBe(1200000 * 2 + 1500000); // $39.000 ARS

    // 2. Inicia flujo oficial de Google OAuth 2.0 con PKCE y state firmado contra CSRF
    const oauthStart = buildGoogleOAuthAuthorizationFlow({
      tenantSlug: 'express-club',
      returnStep: 3,
      clientId: '123456-real-google-client.apps.googleusercontent.com',
      redirectUri: 'https://barraonline.com.ar/api/auth/google/callback',
    });
    expect(oauthStart.authorizationUrl).toContain('accounts.google.com/o/oauth2/v2/auth');
    expect(oauthStart.authorizationUrl).toContain('code_challenge_method=S256');

    // Intento de ataque CSRF con un state alterado -> Rechazado
    const csrfAttack = verifyGoogleOAuthCallbackState({
      stateQueryParam: `${oauthStart.state}tampered`,
      signedStateCookieValue: oauthStart.signedStateCookieValue,
    });
    expect(csrfAttack.valid).toBe(false);

    // Validación legítima al regresar de Google -> Retoma exactamente el Paso 3
    const stateCheck = verifyGoogleOAuthCallbackState({
      stateQueryParam: oauthStart.state,
      signedStateCookieValue: oauthStart.signedStateCookieValue,
    });
    expect(stateCheck.valid).toBe(true);
    expect(stateCheck.tenantSlug).toBe('express-club');
    expect(stateCheck.returnStep).toBe(3);

    // 3. Se confirma la identidad de Google y se vincula automáticamente el borrador de la sesión a su cuenta
    const googleCustomer = await upsertAuthenticatedGoogleCustomer({
      googleSub: 'google-oidc-sub-998877',
      email: 'camila.noche@gmail.com',
      fullName: 'Camila Rossi',
      tenantId: EXPRESS_TENANT_ID,
      guestSessionToken: guestSession.rawSessionId,
    });

    const verifiedCookie = verifySignedCustomerSessionToken(
      googleCustomer.sessionToken
    );
    expect(verifiedCookie?.provider).toBe('GOOGLE');
    expect(verifiedCookie?.userId).toBe(googleCustomer.userId);

    // 4. Ahora el cliente puede recuperar su borrador incluso desde otro dispositivo usando su cuenta autenticada
    const recoveredFromAccount = await recoverAndValidateOrderDraft({
      tenantId: EXPRESS_TENANT_ID,
      customerUserId: googleCustomer.userId,
    });
    expect(recoveredFromAccount).not.toBeNull();
    expect(recoveredFromAccount?.canRecoverAcrossDevices).toBe(true);
    expect(recoveredFromAccount?.savedStep).toBe(3);
    expect(recoveredFromAccount?.currentTotalCents).toBe(3900000);
    expect(recoveredFromAccount?.validatedItems.length).toBe(2);
  });

  it('Escenarios 5 y 6: bloquea la compra de productos agotados y detecta cambios de precio antes de pagar o al reabrir un borrador', async () => {
    const guestSession = createSignedGuestSessionToken();

    // Escenario 5: Cliente intenta comprar un producto agotado (stock = 0)
    await expect(
      createCheckoutAndReserveStock({
        tenantId: EXPRESS_TENANT_ID,
        idempotencyKey: 'idem-soldout-attempt-1',
        guestSessionToken: guestSession.rawSessionId,
        items: [{ productId: PROD_SOLD_OUT_ID, quantity: 1 }],
      })
    ).rejects.toThrow(/OUT_OF_STOCK/);

    // Guardamos un borrador con Gin Tonic a $15.000 ARS (1.500.000 centavos)
    const saved = await saveOrderDraft({
      tenantId: EXPRESS_TENANT_ID,
      guestSessionToken: guestSession.rawSessionId,
      savedStep: 2,
      items: [{ productId: PROD_GIN_ID, quantity: 2 }],
    });

    // Escenario 6A: El encargado del boliche actualiza el precio del Gin Tonic a $16.500 ARS (1.650.000 centavos)
    await updateProductStockOrPrice({
      tenantId: EXPRESS_TENANT_ID,
      actorRole: 'OWNER',
      productId: PROD_GIN_ID,
      priceCents: 1650000,
    });

    // Si el cliente intenta iniciar el cobro con el precio viejo en pantalla ($15.000), el servidor lo frena y le informa el nuevo precio
    await expect(
      createCheckoutAndReserveStock({
        tenantId: EXPRESS_TENANT_ID,
        idempotencyKey: 'idem-price-changed-check',
        guestSessionToken: guestSession.rawSessionId,
        items: [
          {
            productId: PROD_GIN_ID,
            quantity: 2,
            expectedUnitPriceCents: 1500000, // Precio viejo
          },
        ],
      })
    ).rejects.toThrow(/PRICE_CHANGED/);

    // Escenario 6B: Al reabrir el borrador, revalida el precio en vivo e informa el cambio
    const recovered = await recoverAndValidateOrderDraft({
      tenantId: EXPRESS_TENANT_ID,
      draftId: saved.draftId,
      guestSessionToken: guestSession.rawSessionId,
    });
    expect(recovered?.hasChanges).toBe(true);
    expect(recovered?.notices[0]?.type).toBe('PRICE_CHANGED');
    expect(recovered?.currentTotalCents).toBe(1650000 * 2);
  });

  it('Escenarios 7, 8, 9, 10, 11, 12 y 13: estados de pago (pendiente sin QR, rechazado con reintento, aprobado con QR), idempotencia y protección contra acceso de terceros (IDOR)', async () => {
    const buyerSession = createSignedGuestSessionToken();
    const attackerSession = createSignedGuestSessionToken();

    // 1. El comprador inicia el checkout por 2 Fernet Branca XL ($12.000 promo c/u = $24.000 ARS)
    const firstAttempt = await createCheckoutAndReserveStock({
      tenantId: EXPRESS_TENANT_ID,
      idempotencyKey: 'idem-express-order-attempt-1',
      guestSessionToken: buyerSession.rawSessionId,
      customerDisplayName: 'Lucas comprador',
      items: [
        {
          productId: PROD_FERNET_ID,
          quantity: 2,
          expectedUnitPriceCents: 1200000,
        },
      ],
    });
    expect(firstAttempt.totalCents).toBe(2400000);
    expect(firstAttempt.discountCents).toBe(400000); // Ahorro de $4.000 ARS sobre precio regular ($28.000)

    await createMercadoPagoPreferenceForOrder({
      tenantId: EXPRESS_TENANT_ID,
      orderId: firstAttempt.orderId,
    });

    // Escenario 9 & 11: El pago queda PENDIENTE -> No se genera ningún QR válido de retiro
    const pendingState = await recordOrderPaymentPending({
      tenantId: EXPRESS_TENANT_ID,
      orderId: firstAttempt.orderId,
      mpPaymentId: 3000111222,
    });
    expect(pendingState.paymentStatus).toBe('IN_REVIEW');
    expect(pendingState.qrIssued).toBe(false);

    const orderWhilePending = await getAuthorizedCustomerOrder({
      tenantId: EXPRESS_TENANT_ID,
      orderId: firstAttempt.orderId,
      guestSessionToken: buyerSession.rawSessionId,
    });
    expect(orderWhilePending.paymentStatus).toBe('IN_REVIEW');
    expect(orderWhilePending.qr).toBeNull();

    // Escenario 8: Mercado Pago RECHAZA ese primer intento -> libera el stock reservado y no emite QR
    const rejectedState = await recordOrderPaymentRejected({
      tenantId: EXPRESS_TENANT_ID,
      orderId: firstAttempt.orderId,
      mpPaymentId: 3000111222,
    });
    expect(rejectedState.paymentStatus).toBe('REJECTED');
    expect(rejectedState.qrIssued).toBe(false);
    expect(rejectedState.stockReleased).toBe(true);

    // Notificación repetida de rechazo -> Idempotente
    const duplicateRejection = await recordOrderPaymentRejected({
      tenantId: EXPRESS_TENANT_ID,
      orderId: firstAttempt.orderId,
      mpPaymentId: 3000111222,
    });
    expect(duplicateRejection.wasIdempotentDuplicate).toBe(true);

    // El cliente reintenta el pago sin perder su selección y Mercado Pago APRUEBA el pago (Escenarios 7 y 10)
    const retryCheckout = await createCheckoutAndReserveStock({
      tenantId: EXPRESS_TENANT_ID,
      idempotencyKey: 'idem-express-order-attempt-2',
      guestSessionToken: buyerSession.rawSessionId,
      customerDisplayName: 'Lucas comprador',
      items: [
        {
          productId: PROD_FERNET_ID,
          quantity: 2,
          expectedUnitPriceCents: 1200000,
        },
      ],
    });

    const approved = await confirmOrderPaymentAndIssueQr({
      tenantId: EXPRESS_TENANT_ID,
      orderId: retryCheckout.orderId,
      mpPaymentId: 4000999888,
      grossAmountCents: retryCheckout.totalCents,
    });
    expect(approved.paymentStatus).toBe('APPROVED');
    expect(approved.qrStatus).toBe('ACTIVE');
    expect(approved.qrRawToken.length).toBeGreaterThanOrEqual(24);
    // El QR no contiene datos personales del comprador
    expect(approved.qrRawToken).not.toContain('Lucas');

    // Escenario 10: Notificación repetida de aprobación -> Idempotente, devuelve el mismo QR sin duplicar cargos
    const repeatedApproval = await confirmOrderPaymentAndIssueQr({
      tenantId: EXPRESS_TENANT_ID,
      orderId: retryCheckout.orderId,
      mpPaymentId: 4000999888,
      grossAmountCents: retryCheckout.totalCents,
    });
    expect(repeatedApproval.wasIdempotentDuplicate).toBe(true);
    expect(repeatedApproval.qrId).toBe(approved.qrId);

    // Escenario 13: Otra persona (attackerSession) intenta consultar el pedido y QR de Lucas conociendo el orderId -> Bloqueado con FORBIDDEN_ORDER_ACCESS
    await expect(
      getAuthorizedCustomerOrder({
        tenantId: EXPRESS_TENANT_ID,
        orderId: retryCheckout.orderId,
        guestSessionToken: attackerSession.rawSessionId,
      })
    ).rejects.toThrow(/FORBIDDEN_ORDER_ACCESS/);

    // Escenario 12: Lucas recupera su pedido y su QR de forma autorizada, y la barra lo escanea y entrega
    const authorizedOrder = await getAuthorizedCustomerOrder({
      tenantId: EXPRESS_TENANT_ID,
      orderId: retryCheckout.orderId,
      guestSessionToken: buyerSession.rawSessionId,
    });
    expect(authorizedOrder.qr?.qrRawToken).toBe(approved.qrRawToken);
    expect(authorizedOrder.fulfillmentStatus).toBe('READY_FOR_PICKUP');

    const customerOrderHistory = await listAuthorizedCustomerOrders({
      tenantId: EXPRESS_TENANT_ID,
      guestSessionToken: buyerSession.rawSessionId,
    });
    expect(
      customerOrderHistory.some((o) => o.orderId === retryCheckout.orderId)
    ).toBe(true);

    // Escaneo en la barra del boliche
    const barInspection = await inspectQrAtBar({
      tenantId: EXPRESS_TENANT_ID,
      actorRole: 'BARTENDER',
      actorTenantUserId: STAFF_BARMAN_ID,
      stationId: BAR_STATION_ID,
      rawQrToken: `https://express-club.barraonline.com.ar/r/${approved.qrRawToken}`,
    });
    expect(barInspection.lookupOutcome).toBe('READY_TO_REDEEM');

    const barRedemption = await redeemQrAtBarAtomically({
      tenantId: EXPRESS_TENANT_ID,
      actorRole: 'BARTENDER',
      actorTenantUserId: STAFF_BARMAN_ID,
      stationId: BAR_STATION_ID,
      rawQrToken: approved.qrRawToken,
    });
    expect(barRedemption.success).toBe(true);
    expect(barRedemption.outcome).toBe('REDEEMED_SUCCESSFULLY');

    // Al volver a consultar su pedido, el estado real figura como DELIVERED (Retirado)
    const afterPickupOrder = await getAuthorizedCustomerOrder({
      tenantId: EXPRESS_TENANT_ID,
      orderId: retryCheckout.orderId,
      guestSessionToken: buyerSession.rawSessionId,
    });
    expect(afterPickupOrder.fulfillmentStatus).toBe('DELIVERED');
    expect(afterPickupOrder.qr?.qrStatus).toBe('REDEEMED');
  });
});
