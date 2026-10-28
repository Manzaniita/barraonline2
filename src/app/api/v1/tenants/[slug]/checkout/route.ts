import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ensureDemoDataSeeded } from '@/db/seed';
import {
  createCheckoutAndReserveStock,
  releaseExpiredStockReservationsForTenant,
} from '@/modules/inventory/checkout-and-stock-service';
import {
  confirmOrderPaymentAndIssueQr,
  createMercadoPagoPreferenceForOrder,
} from '@/modules/payments/mercadopago-service';
import { getTenantBySlug } from '@/modules/tenancy/tenant-service';

const CheckoutSchema = z.object({
  action: z
    .enum(['CREATE_CHECKOUT', 'CONFIRM_PAYMENT', 'SIMULATE_LATE_CONFLICT'])
    .default('CREATE_CHECKOUT'),
  idempotencyKey: z.string().min(6).optional(),
  customerDisplayName: z.string().max(120).optional(),
  guestRecoveryContact: z.string().max(160).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
      })
    )
    .optional(),
  orderId: z.string().uuid().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  await ensureDemoDataSeeded();
  const { slug } = await context.params;
  const tenant = await getTenantBySlug(slug);

  if (!tenant) {
    return NextResponse.json({ error: 'TENANT_NOT_FOUND' }, { status: 404 });
  }

  try {
    const rawBody = await request.json();
    const parsed = CheckoutSchema.parse(rawBody);

    if (parsed.action === 'CREATE_CHECKOUT') {
      const idempotencyKey =
        request.headers.get('idempotency-key') ??
        parsed.idempotencyKey ??
        `chk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const checkout = await createCheckoutAndReserveStock({
        tenantId: tenant.id,
        idempotencyKey,
        customerDisplayName: parsed.customerDisplayName || 'Invitado Club',
        guestRecoveryContact: parsed.guestRecoveryContact || null,
        items: parsed.items ?? [],
      });

      const mpPreference = await createMercadoPagoPreferenceForOrder({
        tenantId: tenant.id,
        orderId: checkout.orderId,
      });

      return NextResponse.json({
        checkout,
        mpPreference,
      });
    }

    if (parsed.action === 'CONFIRM_PAYMENT') {
      if (!parsed.orderId) {
        return NextResponse.json(
          { error: 'ORDER_ID_REQUIRED' },
          { status: 400 }
        );
      }

      // Obtenemos el total real validado en servidor para confirmar el pago en la cuenta conectada del boliche
      const catalogResp = await createCheckoutInfoLookup(tenant.id, parsed.orderId);
      const confirmation = await confirmOrderPaymentAndIssueQr({
        tenantId: tenant.id,
        orderId: parsed.orderId,
        mpPaymentId: Math.floor(1000000000 + Math.random() * 9000000000),
        grossAmountCents: catalogResp.totalCents,
      });

      return NextResponse.json({ confirmation });
    }

    if (parsed.action === 'SIMULATE_LATE_CONFLICT') {
      if (!parsed.items || parsed.items.length === 0) {
        return NextResponse.json({ error: 'ITEMS_REQUIRED' }, { status: 400 });
      }
      // Simula paso a paso el caso de pago tardío:
      // 1. Crea la reserva con vencimiento inmediato
      const pastDate = new Date(Date.now() - 10 * 60 * 1000);
      const checkout = await createCheckoutAndReserveStock({
        tenantId: tenant.id,
        idempotencyKey: `late-conflict-${Date.now()}`,
        customerDisplayName:
          parsed.customerDisplayName || 'Invitado (Pago Tardío MP)',
        items: parsed.items,
        now: pastDate,
      });

      // 2. Libera la reserva vencida
      await releaseExpiredStockReservationsForTenant(tenant.id, new Date());

      // 3. Simula que el stock disponible fue consumido mientras tanto y llega el webhook aprobado de MP
      const conflictConfirmation = await forceLateConflictConfirmationForDemo(
        tenant.id,
        checkout.orderId,
        checkout.totalCents
      );

      return NextResponse.json({
        checkout,
        confirmation: conflictConfirmation,
      });
    }

    return NextResponse.json({ error: 'UNSUPPORTED_ACTION' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error en checkout';
    const status = message.includes('OUT_OF_STOCK') ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

import { withTenantContext } from '@/db';

async function createCheckoutInfoLookup(
  tenantId: string,
  orderId: string
): Promise<{ totalCents: number }> {
  return withTenantContext(tenantId, async (tx) => {
    const res = await tx.query<{ total_cents: string }>(
      `SELECT total_cents FROM orders WHERE id = $1`,
      [orderId]
    );
    const row = res.rows[0];
    if (!row) throw new Error('Pedido no encontrado.');
    return { totalCents: Number(row.total_cents) };
  });
}

async function forceLateConflictConfirmationForDemo(
  tenantId: string,
  orderId: string,
  totalCents: number
) {
  // Temporarily sets stock_reserved = stock_total - stock_sold during confirmation so freeStock = 0, then restores it
  return withTenantContext(tenantId, async (tx) => {
    const itemsRes = await tx.query<{ product_id: string }>(
      `SELECT product_id FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    const pid = itemsRes.rows[0]?.product_id;
    const origRes = await tx.query<{
      stock_total: number;
      stock_reserved: number;
      stock_sold: number;
    }>(
      `SELECT stock_total, stock_reserved, stock_sold FROM products WHERE id = $1`,
      [pid]
    );
    const orig = origRes.rows[0]!;

    await tx.query(
      `UPDATE products SET stock_reserved = stock_total - stock_sold WHERE id = $1`,
      [pid]
    );
    return { pid, orig };
  }).then(async ({ pid, orig }) => {
    try {
      return await confirmOrderPaymentAndIssueQr({
        tenantId,
        orderId,
        mpPaymentId: Math.floor(1000000000 + Math.random() * 9000000000),
        grossAmountCents: totalCents,
      });
    } finally {
      await withTenantContext(tenantId, async (tx) => {
        await tx.query(
          `UPDATE products SET stock_reserved = $2 WHERE id = $1`,
          [pid, orig.stock_reserved]
        );
      });
    }
  });
}
