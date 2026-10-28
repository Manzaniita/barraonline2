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
  timezone: string;
  business_day_cutoff_hour: number;
  alcohol_cutoff_hour: number;
  reservation_ttl_seconds: number;
  allow_bartender_conflict_resolution: boolean;
  theme_config: TenantThemeConfig;
  created_at: string;
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
  // forzamos un mínimo de contraste de 3.5:1 para elementos interactivos
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
              timezone, business_day_cutoff_hour, alcohol_cutoff_hour,
              reservation_ttl_seconds, allow_bartender_conflict_resolution,
              theme_config, created_at
       FROM tenants
       WHERE slug = $1
       LIMIT 1`,
      [cleanSlug]
    );
    return res.rows[0] ?? null;
  });
}

export async function listAllTenantsForDirectory(): Promise<TenantRecord[]> {
  return withAnonymousRlsContext(async (tx) => {
    const res = await tx.query<TenantRecord>(
      `SELECT id, slug, legal_name, fantasy_name, cuit, city, address, status,
              timezone, business_day_cutoff_hour, alcohol_cutoff_hour,
              reservation_ttl_seconds, allow_bartender_conflict_resolution,
              theme_config, created_at
       FROM tenants
       ORDER BY fantasy_name ASC`
    );
    return res.rows;
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
       VALUES ($1::uuid, $2, 'SUPERADMIN', 'TENANT_STATUS_UPDATED', 'tenant', $1::text, $3::jsonb, $4::jsonb)`,
      [
        params.tenantId,
        params.superadminUserId ?? null,
        JSON.stringify({ status: before.status }),
        JSON.stringify({ status: updated.status }),
      ]
    );

    return updated;
  });
}
