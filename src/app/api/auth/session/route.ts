import { NextResponse, type NextRequest } from 'next/server';
import { ensureDemoDataSeeded } from '@/db/seed';
import {
  ADMIN_SESSION_COOKIE,
  verifyUserSessionServerSide,
} from '@/modules/identity/admin-auth-service';
import {
  CUSTOMER_SESSION_COOKIE,
  verifySignedCustomerSessionToken,
} from '@/modules/identity/customer-auth-service';
import { withSuperadminContext } from '@/db';

export async function GET(request: NextRequest) {
  await ensureDemoDataSeeded();

  // 1. Verificamos sesión administrativa / staff / unificada
  const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (adminToken) {
    const verifiedUser = await verifyUserSessionServerSide(adminToken);
    if (verifiedUser) {
      let redirectUrl = '/';
      if (verifiedUser.role === 'SUPERADMIN') {
        redirectUrl = '/admin';
      } else if (
        (verifiedUser.role === 'DUEÑO' ||
          verifiedUser.role === 'GERENTE' ||
          verifiedUser.role === 'ADMIN') &&
        verifiedUser.tenantSlug
      ) {
        redirectUrl = `/b/${verifiedUser.tenantSlug}/admin`;
      } else if (verifiedUser.role === 'CAJERO' && verifiedUser.tenantSlug) {
        redirectUrl = `/b/${verifiedUser.tenantSlug}/bar`;
      }

      // Si además tiene pedidos como cliente, los consultamos
      let customerOrders: Array<{
        id: string;
        orderNumber: string;
        tenantFantasyName: string;
        tenantSlug: string;
        paymentStatus: string;
        fulfillmentStatus: string;
        totalCents: number;
        createdAt: string;
        hasQr: boolean;
        shortCode: string | null;
      }> = [];

      try {
        const rawOrders = await withSuperadminContext(async (tx) => {
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
                    q.token_hash AS qr_code, q.short_verification_code AS short_code
             FROM orders o
             INNER JOIN tenants t ON t.id = o.tenant_id
             LEFT JOIN order_qrs q ON q.order_id = o.id AND q.status = 'ACTIVE'
             WHERE o.customer_user_id = $1
             ORDER BY o.created_at DESC
             LIMIT 15`,
            [verifiedUser.id]
          );
          return res.rows;
        });

        customerOrders = rawOrders.map((o) => ({
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
        }));
      } catch {
        customerOrders = [];
      }

      return NextResponse.json({
        authenticated: true,
        role: verifiedUser.role,
        rawRole: verifiedUser.rawRole,
        user: {
          id: verifiedUser.id,
          email: verifiedUser.email,
          fullName: verifiedUser.fullName,
          role: verifiedUser.role,
          tenantSlug: verifiedUser.tenantSlug ?? null,
          tenantFantasyName: verifiedUser.tenantFantasyName ?? null,
          status: verifiedUser.status,
        },
        redirectUrl,
        orders: customerOrders,
      });
    }
  }

  // 2. Verificamos sesión de cliente (Google u OAuth)
  const customerToken = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (customerToken) {
    const customerPayload = verifySignedCustomerSessionToken(customerToken);
    if (customerPayload) {
      let customerOrders: Array<{
        id: string;
        orderNumber: string;
        tenantFantasyName: string;
        tenantSlug: string;
        paymentStatus: string;
        fulfillmentStatus: string;
        totalCents: number;
        createdAt: string;
        hasQr: boolean;
        shortCode: string | null;
      }> = [];

      try {
        const rawOrders = await withSuperadminContext(async (tx) => {
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
                    q.token_hash AS qr_code, q.short_verification_code AS short_code
             FROM orders o
             INNER JOIN tenants t ON t.id = o.tenant_id
             LEFT JOIN order_qrs q ON q.order_id = o.id AND q.status = 'ACTIVE'
             WHERE o.customer_user_id = $1
             ORDER BY o.created_at DESC
             LIMIT 15`,
            [customerPayload.userId]
          );
          return res.rows;
        });

        customerOrders = rawOrders.map((o) => ({
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
        }));
      } catch {
        customerOrders = [];
      }

      return NextResponse.json({
        authenticated: true,
        role: 'CLIENTE',
        rawRole: 'CUSTOMER',
        user: {
          id: customerPayload.userId,
          email: customerPayload.email,
          fullName: customerPayload.fullName,
          avatarUrl: customerPayload.avatarUrl,
          provider: customerPayload.provider,
          role: 'CLIENTE',
        },
        redirectUrl: '/',
        orders: customerOrders,
      });
    }
  }

  return NextResponse.json({
    authenticated: false,
    role: 'ANONYMOUS',
    user: null,
  });
}
