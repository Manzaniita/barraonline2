import { withAnonymousRlsContext, withSuperadminContext } from '@/db';
import { resolveTenantSlugFromHost } from './host-resolver';

export { resolveTenantSlugFromHost };

export interface TenantThemeConfig {
  accentPrimary: string;
  accentSecondary: string;
  accentOnPrimary: string;
  bgBase: string;
  bgSurface: string;
  tagline: string;
  heroBadge: string;
  logoText: string;
}

export interface TenantRecord {
  id: string;
  slug: string;
  legal_name: string;
  fantasy_name: string;
  cuit: string;
  city: string;
  address: string;
  status: 'ONBOARDING' | 'ACTIVE' | 'PAUSED_MORA' | 'SUSPENDED';
  is_published: boolean;
  is_featured: boolean;
  is_visible_on_landing: boolean;
  sort_order: number;
  commercial_tag: string | null;
  timezone: string;
  business_day_cutoff_hour: number;
  alcohol_cutoff_hour: number;
  reservation_ttl_seconds: number;
  allow_bartender_conflict_resolution: boolean;
  theme_config: TenantThemeConfig;
  created_at: string;
  updated_at?: string;
}

/**
 * Calcula la "Fecha de Noche Comercial" en horario de Argentina (UTC-3).
 * Si un pedido se realiza el domingo a las 04:30 AM y `cutoffHour` es 10 (10:00 AM),
 * pertenece operativamente a la jornada nocturna iniciada el sábado.
 */
export function computeBusinessDate(now: Date = new Date(), cutoffHour = 10): string {
  // Argentina opera en UTC-3 fijo sin horario de verano
  const argentinaOffsetMs = -3 * 60 * 60 * 1000;
  const localTime = new Date(now.getTime() + argentinaOffsetMs);

  const hour = localTime.getUTCHours();
  if (hour < cutoffHour) {
    localTime.setUTCDate(localTime.getUTCDate() - 1);
  }

  const yyyy = localTime.getUTCFullYear();
  const mm = String(localTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(localTime.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseHexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const transform = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * transform(rgb.r) + 0.7152 * transform(rgb.g) + 0.0722 * transform(rgb.b);
}

export function calculateWcagContrastRatio(hexA: string, hexB: string): number {
  const rgbA = parseHexToRgb(hexA) ?? { r: 255, g: 46, b: 99 };
  const rgbB = parseHexToRgb(hexB) ?? { r: 7, g: 7, b: 9 };
  const lumA = relativeLuminance(rgbA);
  const lumB = relativeLuminance(rgbB);
  const brightest = Math.max(lumA, lumB);
  const darkest = Math.min(lumA, lumB);
  return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
}

/**
 * Sanitiza la configuración visual de un boliche y garantiza un contraste
 * accesible WCAG AA para los botones de compra y lectura de precios en la oscuridad.
 */
export function sanitizeAndValidateThemeConfig(
  input: Partial<TenantThemeConfig>
): TenantThemeConfig {
  const bgBase = '#070709';
  const bgSurface = '#11131A';
  let accentPrimary =
    input.accentPrimary && parseHexToRgb(input.accentPrimary)
      ? input.accentPrimary.toUpperCase()
      : '#FF2E63';

  // Si el color primario elegido es demasiado oscuro contra el fondo nocturno (#070709),
  // forzamos un mínimo de contraste de 3.2:1 para elementos interactivos
  const contrastAgainstDarkBg = calculateWcagContrastRatio(accentPrimary, bgBase);
  if (contrastAgainstDarkBg < 3.2) {
    accentPrimary = '#FF2E63';
  }

  // Calculamos automáticamente si el texto sobre el botón primario debe ser negro profundo o blanco
  const contrastWithBlack = calculateWcagContrastRatio(accentPrimary, '#070709');
  const contrastWithWhite = calculateWcagContrastRatio(accentPrimary, '#FFFFFF');
  const accentOnPrimary = contrastWithBlack >= contrastWithWhite ? '#070709' : '#FFFFFF';

  return {
    accentPrimary,
    accentSecondary:
      input.accentSecondary && parseHexToRgb(input.accentSecondary)
        ? input.accentSecondary.toUpperCase()
        : '#00F0FF',
    accentOnPrimary,
    bgBase,
    bgSurface,
    tagline: (input.tagline || 'Pedí desde la pista. Retirá sin fila en barra.').slice(0, 120),
    heroBadge: (input.heroBadge || 'BARRA RÁPIDA QR').slice(0, 40),
    logoText: (input.logoText || 'CLUB').slice(0, 28),
  };
}

export async function getTenantBySlug(slug: string): Promise<TenantRecord | null> {
  const cleanSlug = slug.trim().toLowerCase();
  return withAnonymousRlsContext(async (tx) => {
    const res = await tx.query<TenantRecord>(
      `SELECT id, slug, legal_name, fantasy_name, cuit, city, address, status,
              is_published, is_featured, is_visible_on_landing, sort_order, commercial_tag,
              timezone, business_day_cutoff_hour, alcohol_cutoff_hour,
              reservation_ttl_seconds, allow_bartender_conflict_resolution,
              theme_config, created_at, updated_at
       FROM tenants
       WHERE slug = $1
       LIMIT 1`,
      [cleanSlug]
    );
    return res.rows[0] ?? null;
  });
}

/**
 * Retorna exclusivamente los boliches autorizados para mostrarse en la landing comercial:
 * - Estado operativo ACTIVE
 * - is_published = true
 * - is_visible_on_landing = true
 * Ordenados por destacados primero, luego sort_order ascendente y fantasy_name.
 */
export async function listAllTenantsForDirectory(): Promise<TenantRecord[]> {
  return withAnonymousRlsContext(async (tx) => {
    const res = await tx.query<TenantRecord>(
      `SELECT id, slug, legal_name, fantasy_name, cuit, city, address, status,
              is_published, is_featured, is_visible_on_landing, sort_order, commercial_tag,
              timezone, business_day_cutoff_hour, alcohol_cutoff_hour,
              reservation_ttl_seconds, allow_bartender_conflict_resolution,
              theme_config, created_at
       FROM tenants
       WHERE status = 'ACTIVE'
         AND is_published = true
         AND is_visible_on_landing = true
       ORDER BY is_featured DESC, sort_order ASC, fantasy_name ASC`
    );
    return res.rows;
  });
}

/**
 * Listado completo de establecimientos para el panel de superadministración,
 * incluyendo tanto boliches activos como en onboarding, pausados, ocultos o destacados.
 */
export async function listAllTenantsForSuperadmin(): Promise<TenantRecord[]> {
  return withSuperadminContext(async (tx) => {
    const res = await tx.query<TenantRecord>(
      `SELECT id, slug, legal_name, fantasy_name, cuit, city, address, status,
              is_published, is_featured, is_visible_on_landing, sort_order, commercial_tag,
              timezone, business_day_cutoff_hour, alcohol_cutoff_hour,
              reservation_ttl_seconds, allow_bartender_conflict_resolution,
              theme_config, created_at, updated_at
       FROM tenants
       ORDER BY sort_order ASC, fantasy_name ASC`
    );
    return res.rows;
  });
}

export async function createTenantBySuperadmin(params: {
  slug: string;
  fantasyName: string;
  legalName: string;
  cuit: string;
  city: string;
  address?: string;
  status?: 'ONBOARDING' | 'ACTIVE' | 'PAUSED_MORA' | 'SUSPENDED';
  isPublished?: boolean;
  isFeatured?: boolean;
  isVisibleOnLanding?: boolean;
  sortOrder?: number;
  commercialTag?: string;
  themeConfig?: Partial<TenantThemeConfig>;
  superadminUserId?: string;
}): Promise<TenantRecord> {
  const cleanSlug = params.slug.trim().toLowerCase();
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(cleanSlug)) {
    throw new Error(
      'El slug debe contener únicamente letras minúsculas, números o guiones y no empezar ni terminar con guion.'
    );
  }

  const cleanTheme = sanitizeAndValidateThemeConfig(params.themeConfig || {});

  return withSuperadminContext(async (tx) => {
    const existing = await tx.query<{ id: string }>(
      `SELECT id FROM tenants WHERE slug = $1 LIMIT 1`,
      [cleanSlug]
    );
    if (existing.rows.length > 0) {
      throw new Error(`Ya existe un establecimiento registrado con el slug "${cleanSlug}".`);
    }

    const res = await tx.query<TenantRecord>(
      `INSERT INTO tenants (
         slug, legal_name, fantasy_name, cuit, city, address,
         status, is_published, is_featured, is_visible_on_landing,
         sort_order, commercial_tag, theme_config
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10,
         $11, $12, $13::jsonb
       )
       RETURNING *`,
      [
        cleanSlug,
        params.legalName.trim(),
        params.fantasyName.trim(),
        params.cuit.trim(),
        params.city.trim(),
        (params.address || '').trim(),
        params.status || 'ACTIVE',
        params.isPublished !== false,
        Boolean(params.isFeatured),
        params.isVisibleOnLanding !== false,
        params.sortOrder ?? 0,
        params.commercialTag?.trim() || null,
        JSON.stringify(cleanTheme),
      ]
    );

    const created = res.rows[0]!;

    await tx.query(
      `INSERT INTO audit_logs (
         tenant_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
       ) VALUES ($1::uuid, $2, 'SUPERADMIN', 'TENANT_CREATED', 'tenant', $3, $4::jsonb)`,
      [
        created.id,
        params.superadminUserId ?? null,
        String(created.id),
        JSON.stringify({
          slug: created.slug,
          fantasyName: created.fantasy_name,
          city: created.city,
          status: created.status,
        }),
      ]
    );

    return created;
  });
}

export async function updateTenantBySuperadmin(params: {
  tenantId: string;
  fantasyName?: string;
  legalName?: string;
  cuit?: string;
  city?: string;
  address?: string;
  status?: 'ONBOARDING' | 'ACTIVE' | 'PAUSED_MORA' | 'SUSPENDED';
  isPublished?: boolean;
  isFeatured?: boolean;
  isVisibleOnLanding?: boolean;
  sortOrder?: number;
  commercialTag?: string | null;
  themeConfig?: Partial<TenantThemeConfig>;
  superadminUserId?: string;
}): Promise<TenantRecord> {
  return withSuperadminContext(async (tx) => {
    const beforeRes = await tx.query<TenantRecord>(
      `SELECT * FROM tenants WHERE id = $1`,
      [params.tenantId]
    );
    const before = beforeRes.rows[0];
    if (!before) throw new Error('Boliche no encontrado.');

    let newTheme = before.theme_config;
    if (params.themeConfig) {
      newTheme = sanitizeAndValidateThemeConfig({
        ...before.theme_config,
        ...params.themeConfig,
      });
    }

    const updatedRes = await tx.query<TenantRecord>(
      `UPDATE tenants
       SET fantasy_name = COALESCE($2, fantasy_name),
           legal_name = COALESCE($3, legal_name),
           cuit = COALESCE($4, cuit),
           city = COALESCE($5, city),
           address = COALESCE($6, address),
           status = COALESCE($7, status),
           is_published = COALESCE($8, is_published),
           is_featured = COALESCE($9, is_featured),
           is_visible_on_landing = COALESCE($10, is_visible_on_landing),
           sort_order = COALESCE($11, sort_order),
           commercial_tag = CASE WHEN $12::text IS NOT NULL THEN $12 ELSE commercial_tag END,
           theme_config = $13::jsonb,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        params.tenantId,
        params.fantasyName?.trim() ?? null,
        params.legalName?.trim() ?? null,
        params.cuit?.trim() ?? null,
        params.city?.trim() ?? null,
        params.address !== undefined ? params.address.trim() : null,
        params.status ?? null,
        params.isPublished !== undefined ? params.isPublished : null,
        params.isFeatured !== undefined ? params.isFeatured : null,
        params.isVisibleOnLanding !== undefined ? params.isVisibleOnLanding : null,
        params.sortOrder !== undefined ? params.sortOrder : null,
        params.commercialTag !== undefined ? (params.commercialTag?.trim() || null) : null,
        JSON.stringify(newTheme),
      ]
    );

    const updated = updatedRes.rows[0]!;

    await tx.query(
      `INSERT INTO audit_logs (
         tenant_id, actor_user_id, actor_role, action, entity_type, entity_id, before_state, after_state
       ) VALUES ($1::uuid, $2, 'SUPERADMIN', 'TENANT_UPDATED', 'tenant', $3, $4::jsonb, $5::jsonb)`,
      [
        params.tenantId,
        params.superadminUserId ?? null,
        String(params.tenantId),
        JSON.stringify({
          fantasyName: before.fantasy_name,
          status: before.status,
          isPublished: before.is_published,
          isFeatured: before.is_featured,
          isVisibleOnLanding: before.is_visible_on_landing,
        }),
        JSON.stringify({
          fantasyName: updated.fantasy_name,
          status: updated.status,
          isPublished: updated.is_published,
          isFeatured: updated.is_featured,
          isVisibleOnLanding: updated.is_visible_on_landing,
        }),
      ]
    );

    return updated;
  });
}

export async function updateTenantLandingVisibility(params: {
  tenantId: string;
  isPublished?: boolean;
  isFeatured?: boolean;
  isVisibleOnLanding?: boolean;
  sortOrder?: number;
  commercialTag?: string | null;
  superadminUserId?: string;
}): Promise<TenantRecord> {
  return updateTenantBySuperadmin(params);
}

export async function archiveTenantBySuperadmin(params: {
  tenantId: string;
  superadminUserId?: string;
}): Promise<TenantRecord> {
  return withSuperadminContext(async (tx) => {
    const beforeRes = await tx.query<TenantRecord>(
      `SELECT * FROM tenants WHERE id = $1`,
      [params.tenantId]
    );
    const before = beforeRes.rows[0];
    if (!before) throw new Error('Boliche no encontrado.');

    // Baja lógica / archivado: nunca borrado físico con pedidos históricos
    const updatedRes = await tx.query<TenantRecord>(
      `UPDATE tenants
       SET status = 'SUSPENDED',
           is_published = false,
           is_visible_on_landing = false,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [params.tenantId]
    );
    const updated = updatedRes.rows[0]!;

    await tx.query(
      `INSERT INTO audit_logs (
         tenant_id, actor_user_id, actor_role, action, entity_type, entity_id, before_state, after_state
       ) VALUES ($1::uuid, $2, 'SUPERADMIN', 'TENANT_ARCHIVED', 'tenant', $3, $4::jsonb, $5::jsonb)`,
      [
        params.tenantId,
        params.superadminUserId ?? null,
        String(params.tenantId),
        JSON.stringify({ status: before.status }),
        JSON.stringify({ status: updated.status }),
      ]
    );

    return updated;
  });
}

export async function updateTenantStatusBySuperadmin(params: {
  tenantId: string;
  newStatus: 'ONBOARDING' | 'ACTIVE' | 'PAUSED_MORA' | 'SUSPENDED';
  superadminUserId?: string;
}): Promise<TenantRecord> {
  return withSuperadminContext(async (tx) => {
    const beforeRes = await tx.query<TenantRecord>(
      `SELECT * FROM tenants WHERE id = $1`,
      [params.tenantId]
    );
    const before = beforeRes.rows[0];
    if (!before) throw new Error('Boliche no encontrado.');

    const updatedRes = await tx.query<TenantRecord>(
      `UPDATE tenants
       SET status = $2, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [params.tenantId, params.newStatus]
    );
    const updated = updatedRes.rows[0]!;

    await tx.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, actor_role, action, entity_type, entity_id, before_state, after_state)
       VALUES ($1::uuid, $2, 'SUPERADMIN', 'TENANT_STATUS_UPDATED', 'tenant', $3, $4::jsonb, $5::jsonb)`,
      [
        params.tenantId,
        params.superadminUserId ?? null,
        String(params.tenantId),
        JSON.stringify({ status: before.status }),
        JSON.stringify({ status: updated.status }),
      ]
    );

    return updated;
  });
}
