import { NextResponse, type NextRequest } from 'next/server';
import { ensureDemoDataSeeded } from '@/db/seed';
import {
  ADMIN_SESSION_COOKIE,
  verifySuperadminSessionServerSide,
} from '@/modules/identity/admin-auth-service';
import {
  CUSTOMER_SESSION_COOKIE,
  verifySignedCustomerSessionToken,
} from '@/modules/identity/customer-auth-service';
import { withAnonymousRlsContext, withSuperadminContext } from '@/db';

export async function GET(request: NextRequest) {
  await ensureDemoDataSeeded();

  const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (adminToken) {
    const adminUser = await verifySuperadminSessionServerSide(adminToken);
    if (adminUser) {
      return NextResponse.json({
        authenticated: true,
        role: 'SUPERADMIN',
        user: {
          id: adminUser.id,
          email: adminUser.email,
          fullName: adminUser.fullName,
          isSuperadmin: true,
          status: adminUser.status,
        },
      });
    }
  }

  const customerToken = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (customerToken) {
    const customerPayload = verifySignedCustomerSessionToken(customerToken);
    if (customerPayload) {
      // Obtenemos los pedidos del cliente a través de todos los establecimientos para la vista "Mis Pedidos"
      const customerOrders = await withSuperadminContext(async (tx) => {
        const res = await tx.query<{
          id: string;
          order_number: string;
          tenant_id: string;
          fantasy_name: string;
          slug: string;
          payment_status: string;
          fulfillment_status: string;
          total_cents: string;
          created_at: string;
          qr_code: string | null;
          short_code: string | null;
        }>(
          `SELECT o.id, o.order_number, o.tenant_id, t.fantasy_name, t.slug,
                  o.payment_status, o.fulfillment_status, o.total_cents, o.created_at,
                  q.qr_token_hash AS qr_code, q.short_code
           FROM orders o
           INNER JOIN tenants t ON t.id = o.tenant_id
           LEFT JOIN order_qrs q ON q.order_id = o.id AND q.is_redeemed = false
           WHERE o.customer_user_id = $1
           ORDER BY o.created_at DESC
           LIMIT 15`,
          [customerPayload.userId]
        );
        return res.rows;
      }).catch(() => []);

      return NextResponse.json({
        authenticated: true,
        role: 'CUSTOMER',
        user: {
          id: customerPayload.userId,
          email: customerPayload.email,
          fullName: customerPayload.fullName,
          avatarUrl: customerPayload.avatarUrl,
          provider: customerPayload.provider,
        },
        orders: customerOrders.map((o) => ({
          id: o.id,
          orderNumber: o.order_number,
          tenantFantasyName: o.fantasy_name,
          tenantSlug: o.slug,
          paymentStatus: o.payment_status,
          fulfillmentStatus: o.fulfillment_status,
          totalCents: Number(o.total_cents),
          createdAt: o.created_at,
          hasQr: Boolean(o.qr_code && o.payment_status === 'APPROVED'),
          shortCode: o.short_code,
        })),
      });
    }
  }

  return NextResponse.json({
    authenticated: false,
    role: 'ANONYMOUS',
    user: null,
  });
}
