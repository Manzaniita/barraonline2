import { NextResponse, type NextRequest } from 'next/server';
import { withTenantContext } from '@/db';
import { ensureDemoDataSeeded } from '@/db/seed';
import { authenticateBartenderByShiftPin } from '@/modules/identity/rbac-service';
import {
  inspectQrAtBar,
  redeemQrAtBarAtomically,
  resolveStockConflictAtBar,
} from '@/modules/qr-redemption/qr-service';
import { getTenantBySlug } from '@/modules/tenancy/tenant-service';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  await ensureDemoDataSeeded();
  const { slug } = await context.params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    return NextResponse.json({ error: 'TENANT_NOT_FOUND' }, { status: 404 });
  }

  const barContext = await withTenantContext(tenant.id, async (tx) => {
    const staffRes = await tx.query<{
      id: string;
      staff_display_name: string;
      role: string;
    }>(
      `SELECT id, staff_display_name, role
       FROM tenant_users
       WHERE is_active = true
       ORDER BY staff_display_name ASC`
    );

    const stationsRes = await tx.query<{
      id: string;
      name: string;
      sector: string;
    }>(
      `SELECT id, name, sector
       FROM bar_stations
       WHERE is_revoked = false
       ORDER BY name ASC`
    );

    const logsRes = await tx.query<{
      id: string;
      attempted_token_prefix: string | null;
      attempt_result: string;
      details: string | null;
      created_at: string;
      staff_display_name: string | null;
      station_name: string | null;
    }>(
      `SELECT l.id, l.attempted_token_prefix, l.attempt_result, l.details, l.created_at,
              tu.staff_display_name, bs.name AS station_name
       FROM qr_redemption_logs l
       LEFT JOIN tenant_users tu ON tu.tenant_id = l.tenant_id AND tu.id = l.tenant_user_id
       LEFT JOIN bar_stations bs ON bs.tenant_id = l.tenant_id AND bs.id = l.station_id
       ORDER BY l.created_at DESC
       LIMIT 15`
    );

    const ordersRes = await tx.query<{
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

    return {
      staff: staffRes.rows,
      stations: stationsRes.rows,
      recentLogs: logsRes.rows,
      recentOrders: ordersRes.rows.map((r) => ({
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
      })),
    };
  });

  return NextResponse.json({
    tenant,
    ...barContext,
  });
}

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
    const body = (await request.json()) as {
      action: 'AUTH_PIN' | 'INSPECT' | 'REDEEM' | 'RESOLVE_CONFLICT';
      tenantUserId: string;
      stationId?: string;
      pin?: string;
      rawQrToken?: string;
      resolution?:
        | {
            action: 'SUBSTITUTE';
            orderItemId: string;
            substituteProductId: string;
            notes?: string;
          }
        | {
            action: 'REFUND';
            reason?: string;
          };
    };

    if (body.action === 'AUTH_PIN') {
      const authenticatedStaff = await authenticateBartenderByShiftPin({
        tenantId: tenant.id,
        tenantUserId: body.tenantUserId,
        pin: body.pin ?? '',
      });
      return NextResponse.json({ authenticatedStaff });
    }

    if (body.action === 'INSPECT') {
      const inspection = await inspectQrAtBar({
        tenantId: tenant.id,
        actorRole: 'BARTENDER',
        actorTenantUserId: body.tenantUserId,
        stationId: body.stationId ?? null,
        rawQrToken: body.rawQrToken ?? '',
      });
      return NextResponse.json({ inspection });
    }

    if (body.action === 'REDEEM') {
      const redemption = await redeemQrAtBarAtomically({
        tenantId: tenant.id,
        actorRole: 'BARTENDER',
        actorTenantUserId: body.tenantUserId,
        stationId: body.stationId ?? null,
        rawQrToken: body.rawQrToken ?? '',
      });
      return NextResponse.json({ redemption });
    }

    if (body.action === 'RESOLVE_CONFLICT' && body.resolution) {
      const resolutionResult = await resolveStockConflictAtBar({
        tenantId: tenant.id,
        actorRole: 'MANAGER',
        actorTenantUserId: body.tenantUserId,
        stationId: body.stationId ?? null,
        rawQrToken: body.rawQrToken ?? '',
        resolution: body.resolution,
      });
      return NextResponse.json({ resolutionResult });
    }

    return NextResponse.json({ error: 'INVALID_BAR_ACTION' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error en consola de barra';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
