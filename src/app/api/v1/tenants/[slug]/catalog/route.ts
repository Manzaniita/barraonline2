import { NextResponse } from 'next/server';
import { withTenantContext } from '@/db';
import { ensureDemoDataSeeded } from '@/db/seed';
import { getPublicCatalogForTenant } from '@/modules/catalog/catalog-service';
import { getTenantBySlug } from '@/modules/tenancy/tenant-service';

export async function GET(
  _request: Request,
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

  const catalog = await getPublicCatalogForTenant(tenant.id);

  // Obtenemos también los últimos pedidos del boliche para facilitar la prueba interactiva de punta a punta
  const recentOrders = await withTenantContext(tenant.id, async (tx) => {
    const res = await tx.query<{
      id: string;
      order_number: string;
      customer_display_name: string | null;
      payment_status: string;
      fulfillment_status: string;
      total_cents: string;
      created_at: string;
      qr_raw_token: string | null;
      short_verification_code: string | null;
      qr_status: string | null;
      redeemed_at: string | null;
    }>(
      `SELECT o.id, o.order_number, o.customer_display_name,
              o.payment_status, o.fulfillment_status, o.total_cents, o.created_at,
              q.qr_raw_token, q.short_verification_code, q.status AS qr_status, q.redeemed_at
       FROM orders o
       LEFT JOIN order_qrs q ON q.tenant_id = o.tenant_id AND q.order_id = o.id
       ORDER BY o.created_at DESC
       LIMIT 10`
    );
    return res.rows.map((r) => ({
      id: r.id,
      orderNumber: r.order_number,
      customerDisplayName: r.customer_display_name ?? 'Invitado',
      paymentStatus: r.payment_status,
      fulfillmentStatus: r.fulfillment_status,
      totalCents: Number(r.total_cents),
      createdAt: r.created_at,
      qrRawToken: r.qr_raw_token,
      shortVerificationCode: r.short_verification_code,
      qrStatus: r.qr_status,
      redeemedAt: r.redeemed_at,
    }));
  });

  return NextResponse.json(
    {
      tenant,
      categories: catalog.categories,
      products: catalog.products,
      recentOrders,
    },
    {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Cache-Tag': `catalog-${tenant.id}`,
      },
    }
  );
}
