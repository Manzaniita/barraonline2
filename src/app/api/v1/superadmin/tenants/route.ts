import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ensureDemoDataSeeded } from '@/db/seed';
import {
  ADMIN_SESSION_COOKIE,
  verifySuperadminSessionServerSide,
} from '@/modules/identity/admin-auth-service';
import {
  archiveTenantBySuperadmin,
  createTenantBySuperadmin,
  listAllTenantsForSuperadmin,
  updateTenantBySuperadmin,
  updateTenantStatusBySuperadmin,
} from '@/modules/tenancy/tenant-service';
import { withSuperadminContext } from '@/db';

const CreateTenantSchema = z.object({
  slug: z.string().min(2).max(63),
  fantasyName: z.string().min(2).max(120),
  legalName: z.string().min(2).max(200),
  cuit: z.string().min(8).max(13),
  city: z.string().min(2).max(80),
  address: z.string().max(160).optional(),
  status: z.enum(['ONBOARDING', 'ACTIVE', 'PAUSED_MORA', 'SUSPENDED']).optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isVisibleOnLanding: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  commercialTag: z.string().max(60).optional(),
  themeConfig: z
    .object({
      accentPrimary: z.string().optional(),
      accentSecondary: z.string().optional(),
      tagline: z.string().optional(),
      heroBadge: z.string().optional(),
      logoText: z.string().optional(),
    })
    .optional(),
});

const UpdateTenantSchema = z.object({
  tenantId: z.string().uuid(),
  action: z
    .enum([
      'UPDATE_GENERAL',
      'TOGGLE_STATUS',
      'TOGGLE_LANDING_VISIBILITY',
      'TOGGLE_FEATURED',
      'TOGGLE_PUBLISHED',
      'UPDATE_SORT_ORDER',
      'ARCHIVE',
    ])
    .optional(),
  fantasyName: z.string().min(2).max(120).optional(),
  legalName: z.string().min(2).max(200).optional(),
  cuit: z.string().min(8).max(13).optional(),
  city: z.string().min(2).max(80).optional(),
  address: z.string().max(160).optional(),
  status: z.enum(['ONBOARDING', 'ACTIVE', 'PAUSED_MORA', 'SUSPENDED']).optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isVisibleOnLanding: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  commercialTag: z.string().max(60).nullable().optional(),
  themeConfig: z
    .object({
      accentPrimary: z.string().optional(),
      accentSecondary: z.string().optional(),
      tagline: z.string().optional(),
      heroBadge: z.string().optional(),
      logoText: z.string().optional(),
    })
    .optional(),
});

async function requireSuperadmin(request: NextRequest) {
  const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const adminUser = await verifySuperadminSessionServerSide(adminToken);
  if (!adminUser || !adminUser.isSuperadmin) {
    return null;
  }
  return adminUser;
}

export async function GET(request: NextRequest) {
  await ensureDemoDataSeeded();

  const admin = await requireSuperadmin(request);
  if (!admin) {
    return NextResponse.json(
      { error: 'No autorizado. Acceso exclusivo para superadministradores.' },
      { status: 401 }
    );
  }

  try {
    const tenantsWithMetrics = await withSuperadminContext(async (tx) => {
      const res = await tx.query<{
        id: string;
        slug: string;
        legal_name: string;
        fantasy_name: string;
        cuit: string;
        city: string;
        address: string;
        status: string;
        is_published: boolean;
        is_featured: boolean;
        is_visible_on_landing: boolean;
        sort_order: number;
        commercial_tag: string | null;
        theme_config: Record<string, unknown>;
        created_at: string;
        mp_user_id: string | null;
        mp_connection_status: string | null;
        commission_bps: number | null;
        plan_name: string | null;
        monthly_fee_cents: string | null;
        unsettled_commission_cents: string | null;
        total_orders_count: string;
      }>(
        `SELECT t.id, t.slug, t.legal_name, t.fantasy_name, t.cuit, t.city, t.address, t.status,
                t.is_published, t.is_featured, t.is_visible_on_landing, t.sort_order, t.commercial_tag,
                t.theme_config, t.created_at,
                mc.mp_user_id, mc.connection_status AS mp_connection_status,
                (SELECT cr.commission_bps FROM tenant_commission_rules cr WHERE cr.tenant_id = t.id AND cr.effective_to IS NULL ORDER BY cr.effective_from DESC LIMIT 1) AS commission_bps,
                (SELECT tp.plan_name FROM tenant_plans tp WHERE tp.tenant_id = t.id AND tp.effective_to IS NULL ORDER BY tp.effective_from DESC LIMIT 1) AS plan_name,
                (SELECT tp.monthly_fee_cents FROM tenant_plans tp WHERE tp.tenant_id = t.id AND tp.effective_to IS NULL ORDER BY tp.effective_from DESC LIMIT 1) AS monthly_fee_cents,
                (SELECT COALESCE(SUM(cl.commission_amount_cents), 0) FROM commission_ledger cl WHERE cl.tenant_id = t.id AND cl.settlement_id IS NULL) AS unsettled_commission_cents,
                (SELECT COUNT(*) FROM orders o WHERE o.tenant_id = t.id) AS total_orders_count
         FROM tenants t
         LEFT JOIN tenant_mp_credentials mc ON mc.tenant_id = t.id
         ORDER BY t.sort_order ASC, t.fantasy_name ASC`
      );
      return res.rows;
    });

    return NextResponse.json({
      tenants: tenantsWithMetrics.map((t) => ({
        id: t.id,
        slug: t.slug,
        legalName: t.legal_name,
        fantasyName: t.fantasy_name,
        cuit: t.cuit,
        city: t.city,
        address: t.address,
        status: t.status,
        isPublished: t.is_published,
        isFeatured: t.is_featured,
        isVisibleOnLanding: t.is_visible_on_landing,
        sortOrder: t.sort_order,
        commercialTag: t.commercial_tag,
        themeConfig: t.theme_config,
        createdAt: t.created_at,
        mpUserId: t.mp_user_id ? Number(t.mp_user_id) : null,
        mpConnectionStatus: t.mp_connection_status || 'NOT_CONNECTED',
        commissionBps: t.commission_bps ?? 500,
        planName: t.plan_name || 'Sin plan asignado',
        monthlyFeeCents: Number(t.monthly_fee_cents || 0),
        unsettledCommissionCents: Number(t.unsettled_commission_cents || 0),
        totalOrdersCount: Number(t.total_orders_count || 0),
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al listar establecimientos.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  await ensureDemoDataSeeded();

  const admin = await requireSuperadmin(request);
  if (!admin) {
    return NextResponse.json(
      { error: 'No autorizado. Acceso exclusivo para superadministradores.' },
      { status: 401 }
    );
  }

  try {
    const body = CreateTenantSchema.parse(await request.json());

    const created = await createTenantBySuperadmin({
      slug: body.slug,
      fantasyName: body.fantasyName,
      legalName: body.legalName,
      cuit: body.cuit,
      city: body.city,
      address: body.address,
      status: body.status || 'ACTIVE',
      isPublished: body.isPublished !== false,
      isFeatured: body.isFeatured ?? false,
      isVisibleOnLanding: body.isVisibleOnLanding !== false,
      sortOrder: body.sortOrder ?? 0,
      commercialTag: body.commercialTag,
      themeConfig: body.themeConfig,
      superadminUserId: admin.id,
    });

    return NextResponse.json({
      success: true,
      message: `Establecimiento ${created.fantasy_name} creado exitosamente.`,
      tenant: created,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al crear establecimiento.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  await ensureDemoDataSeeded();

  const admin = await requireSuperadmin(request);
  if (!admin) {
    return NextResponse.json(
      { error: 'No autorizado. Acceso exclusivo para superadministradores.' },
      { status: 401 }
    );
  }

  try {
    const body = UpdateTenantSchema.parse(await request.json());

    if (body.action === 'ARCHIVE') {
      const archived = await archiveTenantBySuperadmin({
        tenantId: body.tenantId,
        superadminUserId: admin.id,
      });
      return NextResponse.json({
        success: true,
        message: `Establecimiento ${archived.fantasy_name} archivado correctamente (baja lógica).`,
        tenant: archived,
      });
    }

    if (body.action === 'TOGGLE_STATUS' && body.status) {
      const updatedStatus = await updateTenantStatusBySuperadmin({
        tenantId: body.tenantId,
        newStatus: body.status,
        superadminUserId: admin.id,
      });
      return NextResponse.json({
        success: true,
        message: `Estado de ${updatedStatus.fantasy_name} actualizado a ${updatedStatus.status}.`,
        tenant: updatedStatus,
      });
    }

    const updated = await updateTenantBySuperadmin({
      tenantId: body.tenantId,
      fantasyName: body.fantasyName,
      legalName: body.legalName,
      cuit: body.cuit,
      city: body.city,
      address: body.address,
      status: body.status,
      isPublished: body.isPublished,
      isFeatured: body.isFeatured,
      isVisibleOnLanding: body.isVisibleOnLanding,
      sortOrder: body.sortOrder,
      commercialTag: body.commercialTag,
      themeConfig: body.themeConfig,
      superadminUserId: admin.id,
    });

    return NextResponse.json({
      success: true,
      message: `Establecimiento ${updated.fantasy_name} actualizado exitosamente.`,
      tenant: updated,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al actualizar establecimiento.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
