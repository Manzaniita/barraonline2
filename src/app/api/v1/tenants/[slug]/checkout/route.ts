import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withTenantContext } from '@/db';
import { ensureDemoDataSeeded } from '@/db/seed';
import {
  createSignedGuestSessionToken,
  CUSTOMER_SESSION_COOKIE,
  DRAFT_ACCESS_COOKIE_PREFIX,
  GUEST_SESSION_COOKIE,
  ORDER_ACCESS_COOKIE_PREFIX,
  verifySignedCustomerSessionToken,
  verifySignedGuestSessionToken,
} from '@/modules/identity/customer-auth-service';
import {
  createCheckoutAndReserveStock,
  discardOrderDraft,
  getAuthorizedCustomerOrder,
  recoverAndValidateOrderDraft,
  releaseExpiredStockReservationsForTenant,
  saveOrderDraft,
} from '@/modules/inventory/checkout-and-stock-service';
import {
  confirmOrderPaymentAndIssueQr,
  createMercadoPagoPreferenceForOrder,
  recordOrderPaymentPending,
  recordOrderPaymentRejected,
} from '@/modules/payments/mercadopago-service';
import { getTenantBySlug } from '@/modules/tenancy/tenant-service';

const CheckoutSchema = z.object({
  action: z
    .enum([
      'CREATE_CHECKOUT',
      'CONFIRM_PAYMENT',
      'MARK_PAYMENT_PENDING',
      'MARK_PAYMENT_REJECTED',
      'SAVE_DRAFT',
      'RECOVER_DRAFT',
      'DISCARD_DRAFT',
      'SIMULATE_LATE_CONFLICT',
    ])
    .default('CREATE_CHECKOUT'),
  idempotencyKey: z.string().min(6).optional(),
  customerDisplayName: z.string().max(120).optional(),
  guestRecoveryContact: z.string().max(160).optional(),
  savedStep: z.number().int().min(1).max(3).optional(),
  draftId: z.string().uuid().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
        expectedUnitPriceCents: z.number().int().positive().optional(),
      })
    )
    .optional(),
  orderId: z.string().uuid().optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  await ensureDemoDataSeeded();
  const { slug } = await context.params;
  const tenant = await getTenantBySlug(slug);

  if (!tenant) {
    return NextResponse.json(
      { error: 'TENANT_NOT_FOUND', message: 'Establecimiento no encontrado.' },
      { status: 404 }
    );
  }

  const orderId = request.nextUrl.searchParams.get('orderId');
  if (!orderId) {
    return NextResponse.json(
      { error: 'ORDER_ID_REQUIRED', message: 'Falta indicar el pedido.' },
      { status: 400 }
    );
  }

  const customerSession = verifySignedCustomerSessionToken(
    request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value
  );
  const guestSessionToken = verifySignedGuestSessionToken(
    request.cookies.get(GUEST_SESSION_COOKIE)?.value
  );
  const orderAccessToken =
    request.cookies.get(`${ORDER_ACCESS_COOKIE_PREFIX}${orderId}`)?.value ??
    request.headers.get('x-order-access-token') ??
    null;

  try {
    const order = await getAuthorizedCustomerOrder({
      tenantId: tenant.id,
      orderId,
      customerUserId: customerSession?.userId ?? null,
      guestSessionToken,
      orderAccessToken,
    });

    return NextResponse.json(
      { order },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'No se pudo consultar el pedido.';
    if (msg.includes('FORBIDDEN_ORDER_ACCESS')) {
      return NextResponse.json(
        {
          error: 'FORBIDDEN_ORDER_ACCESS',
          message: 'No tenés autorización para consultar este pedido.',
        },
        { status: 403 }
      );
    }
    if (msg.includes('ORDER_NOT_FOUND')) {
      return NextResponse.json(
        { error: 'ORDER_NOT_FOUND', message: 'Pedido no encontrado.' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'ORDER_LOOKUP_FAILED', message: 'No se pudo consultar el pedido.' },
      { status: 400 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  await ensureDemoDataSeeded();
  const { slug } = await context.params;
  const tenant = await getTenantBySlug(slug);

  if (!tenant) {
    return NextResponse.json(
      { error: 'TENANT_NOT_FOUND', message: 'Establecimiento no encontrado.' },
      { status: 404 }
    );
  }

  const customerSession = verifySignedCustomerSessionToken(
    request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value
  );
  let guestSessionToken = verifySignedGuestSessionToken(
    request.cookies.get(GUEST_SESSION_COOKIE)?.value
  );
  let newGuestCookieValue: string | null = null;
  if (!guestSessionToken) {
    const generated = createSignedGuestSessionToken();
    guestSessionToken = generated.rawSessionId;
    newGuestCookieValue = generated.signedCookieValue;
  }

  function attachCommonCookies(resp: NextResponse): NextResponse {
    if (newGuestCookieValue) {
      resp.cookies.set(GUEST_SESSION_COOKIE, newGuestCookieValue, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
    }
    return resp;
  }

  try {
    const rawBody = await request.json();
    const parsed = CheckoutSchema.parse(rawBody);

    if (parsed.action === 'SAVE_DRAFT') {
      const savedDraft = await saveOrderDraft({
        tenantId: tenant.id,
        items: (parsed.items ?? []).map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
        })),
        savedStep: parsed.savedStep ?? 2,
        customerUserId: customerSession?.userId ?? null,
        customerDisplayName:
          customerSession?.fullName ?? parsed.customerDisplayName ?? null,
        guestSessionToken,
      });

      const resp = NextResponse.json({
        draft: {
          draftId: savedDraft.draftId,
          savedStep: savedDraft.savedStep,
          customerDisplayName: savedDraft.customerDisplayName,
          itemsSnapshot: savedDraft.itemsSnapshot,
          subtotalSnapshotCents: savedDraft.subtotalSnapshotCents,
          canRecoverAcrossDevices: savedDraft.canRecoverAcrossDevices,
          expiresAt: savedDraft.expiresAt,
        },
      });

      resp.cookies.set(
        `${DRAFT_ACCESS_COOKIE_PREFIX}${savedDraft.draftId}`,
        savedDraft.draftAccessToken,
        {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 24 * 60 * 60,
        }
      );

      return attachCommonCookies(resp);
    }

    if (parsed.action === 'RECOVER_DRAFT') {
      const draftAccessToken = parsed.draftId
        ? request.cookies.get(`${DRAFT_ACCESS_COOKIE_PREFIX}${parsed.draftId}`)?.value ??
          null
        : null;

      const recovered = await recoverAndValidateOrderDraft({
        tenantId: tenant.id,
        draftId: parsed.draftId ?? null,
        customerUserId: customerSession?.userId ?? null,
        guestSessionToken,
        draftAccessToken,
      });

      return attachCommonCookies(NextResponse.json({ draft: recovered }));
    }

    if (parsed.action === 'DISCARD_DRAFT') {
      if (parsed.draftId) {
        await discardOrderDraft({
          tenantId: tenant.id,
          draftId: parsed.draftId,
          customerUserId: customerSession?.userId ?? null,
          guestSessionToken,
        });
      }
      return attachCommonCookies(NextResponse.json({ ok: true }));
    }

    if (parsed.action === 'CREATE_CHECKOUT') {
      const idempotencyKey =
        request.headers.get('idempotency-key') ??
        parsed.idempotencyKey ??
        `chk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const resolvedDisplayName =
        customerSession?.fullName ||
        parsed.customerDisplayName?.trim() ||
        'Invitado Club';

      const checkout = await createCheckoutAndReserveStock({
        tenantId: tenant.id,
        idempotencyKey,
        customerUserId: customerSession?.userId ?? null,
        customerDisplayName: resolvedDisplayName,
        guestSessionToken,
        guestRecoveryContact:
          customerSession?.email ?? parsed.guestRecoveryContact ?? null,
        draftId: parsed.draftId ?? null,
        items: parsed.items ?? [],
      });

      const mpPreference = await createMercadoPagoPreferenceForOrder({
        tenantId: tenant.id,
        orderId: checkout.orderId,
      });

      const resp = NextResponse.json({
        checkout: {
          orderId: checkout.orderId,
          orderNumber: checkout.orderNumber,
          tenantId: checkout.tenantId,
          subtotalCents: checkout.subtotalCents,
          discountCents: checkout.discountCents,
          totalCents: checkout.totalCents,
          reservationId: checkout.reservationId,
          reservationExpiresAt: checkout.reservationExpiresAt,
          isIdempotentReplay: checkout.isIdempotentReplay,
        },
        mpPreference: {
          preferenceId: mpPreference.preferenceId,
          initPointUrl: mpPreference.initPointUrl,
        },
      });

      if (
        checkout.orderAccessToken &&
        checkout.orderAccessToken !== 'IDEMPOTENT_REPLAY_TOKEN_ALREADY_ISSUED'
      ) {
        resp.cookies.set(
          `${ORDER_ACCESS_COOKIE_PREFIX}${checkout.orderId}`,
          checkout.orderAccessToken,
          {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 7 * 24 * 60 * 60,
          }
        );
      }

      return attachCommonCookies(resp);
    }

    if (parsed.action === 'CONFIRM_PAYMENT') {
      if (!parsed.orderId) {
        return NextResponse.json(
          { error: 'ORDER_ID_REQUIRED', message: 'Falta indicar el pedido.' },
          { status: 400 }
        );
      }

      const orderAccessToken =
        request.cookies.get(`${ORDER_ACCESS_COOKIE_PREFIX}${parsed.orderId}`)?.value ??
        request.headers.get('x-order-access-token') ??
        null;

      // Verificamos autorización antes de operar sobre el pedido
      const authorizedOrder = await getAuthorizedCustomerOrder({
        tenantId: tenant.id,
        orderId: parsed.orderId,
        customerUserId: customerSession?.userId ?? null,
        guestSessionToken,
        orderAccessToken,
      });

      const confirmation = await confirmOrderPaymentAndIssueQr({
        tenantId: tenant.id,
        orderId: authorizedOrder.orderId,
        mpPaymentId: Math.floor(1000000000 + Math.random() * 9000000000),
        grossAmountCents: authorizedOrder.totalCents,
      });

      const updatedOrder = await getAuthorizedCustomerOrder({
        tenantId: tenant.id,
        orderId: authorizedOrder.orderId,
        customerUserId: customerSession?.userId ?? null,
        guestSessionToken,
        orderAccessToken,
      });

      return attachCommonCookies(
        NextResponse.json({
          confirmation,
          order: updatedOrder,
        })
      );
    }

    if (parsed.action === 'MARK_PAYMENT_PENDING') {
      if (!parsed.orderId) {
        return NextResponse.json(
          { error: 'ORDER_ID_REQUIRED', message: 'Falta indicar el pedido.' },
          { status: 400 }
        );
      }

      const orderAccessToken =
        request.cookies.get(`${ORDER_ACCESS_COOKIE_PREFIX}${parsed.orderId}`)?.value ??
        request.headers.get('x-order-access-token') ??
        null;

      const authorizedOrder = await getAuthorizedCustomerOrder({
        tenantId: tenant.id,
        orderId: parsed.orderId,
        customerUserId: customerSession?.userId ?? null,
        guestSessionToken,
        orderAccessToken,
      });

      const pendingResult = await recordOrderPaymentPending({
        tenantId: tenant.id,
        orderId: authorizedOrder.orderId,
      });

      const updatedOrder = await getAuthorizedCustomerOrder({
        tenantId: tenant.id,
        orderId: authorizedOrder.orderId,
        customerUserId: customerSession?.userId ?? null,
        guestSessionToken,
        orderAccessToken,
      });

      return attachCommonCookies(
        NextResponse.json({
          pendingResult,
          order: updatedOrder,
        })
      );
    }

    if (parsed.action === 'MARK_PAYMENT_REJECTED') {
      if (!parsed.orderId) {
        return NextResponse.json(
          { error: 'ORDER_ID_REQUIRED', message: 'Falta indicar el pedido.' },
          { status: 400 }
        );
      }

      const orderAccessToken =
        request.cookies.get(`${ORDER_ACCESS_COOKIE_PREFIX}${parsed.orderId}`)?.value ??
        request.headers.get('x-order-access-token') ??
        null;

      const authorizedOrder = await getAuthorizedCustomerOrder({
        tenantId: tenant.id,
        orderId: parsed.orderId,
        customerUserId: customerSession?.userId ?? null,
        guestSessionToken,
        orderAccessToken,
      });

      const rejectResult = await recordOrderPaymentRejected({
        tenantId: tenant.id,
        orderId: authorizedOrder.orderId,
      });

      const updatedOrder = await getAuthorizedCustomerOrder({
        tenantId: tenant.id,
        orderId: authorizedOrder.orderId,
        customerUserId: customerSession?.userId ?? null,
        guestSessionToken,
        orderAccessToken,
      });

      return attachCommonCookies(
        NextResponse.json({
          rejectResult,
          order: updatedOrder,
        })
      );
    }

    if (parsed.action === 'SIMULATE_LATE_CONFLICT') {
      if (!parsed.items || parsed.items.length === 0) {
        return NextResponse.json({ error: 'ITEMS_REQUIRED' }, { status: 400 });
      }
      const pastDate = new Date(Date.now() - 10 * 60 * 1000);
      const checkout = await createCheckoutAndReserveStock({
        tenantId: tenant.id,
        idempotencyKey: `late-conflict-${Date.now()}`,
        customerUserId: customerSession?.userId ?? null,
        customerDisplayName:
          parsed.customerDisplayName || 'Invitado (Pago Tardío MP)',
        guestSessionToken,
        items: parsed.items,
        now: pastDate,
      });

      await releaseExpiredStockReservationsForTenant(tenant.id, new Date());

      const conflictConfirmation = await forceLateConflictConfirmationForDemo(
        tenant.id,
        checkout.orderId,
        checkout.totalCents
      );

      return attachCommonCookies(
        NextResponse.json({
          checkout,
          confirmation: conflictConfirmation,
        })
      );
    }

    return NextResponse.json({ error: 'UNSUPPORTED_ACTION' }, { status: 400 });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : 'Error al procesar el pedido';
    if (rawMessage.includes('FORBIDDEN_')) {
      return NextResponse.json(
        {
          error: 'FORBIDDEN_ACCESS',
          message: 'No tenés autorización para acceder a este pedido.',
        },
        { status: 403 }
      );
    }
    const status =
      rawMessage.includes('OUT_OF_STOCK') || rawMessage.includes('PRICE_CHANGED')
        ? 409
        : 400;
    const cleanMessage = rawMessage.includes(':')
      ? rawMessage.split(':').slice(1).join(':').trim()
      : rawMessage;
    return NextResponse.json(
      {
        error: rawMessage.split(':')[0] || 'CHECKOUT_ERROR',
        message: cleanMessage || 'No pudimos completar la operación. Intentá nuevamente.',
      },
      { status }
    );
  }
}

async function forceLateConflictConfirmationForDemo(
  tenantId: string,
  orderId: string,
  totalCents: number
) {
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
