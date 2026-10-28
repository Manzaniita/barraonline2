import { withSuperadminContext, withTenantContext } from '@/db';
import {
  generateHighEntropyToken,
  hashShiftPin,
  sha256Hex,
  verifyShiftPin,
} from '@/modules/security/crypto-vault';

export type TenantRole =
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'BARTENDER'
  | 'MARKETING'
  | 'READONLY';

export type PermissionCode =
  | 'mp:connect'
  | 'staff:manage'
  | 'bar_stations:authorize'
  | 'catalog:write'
  | 'stock:write'
  | 'theme:write'
  | 'bar:scan_and_redeem'
  | 'bar:resolve_conflict'
  | 'orders:refund'
  | 'settlements:read'
  | 'reports:read';

const ROLE_PERMISSION_MATRIX: Record<TenantRole, ReadonlySet<PermissionCode>> = {
  OWNER: new Set<PermissionCode>([
    'mp:connect',
    'staff:manage',
    'bar_stations:authorize',
    'catalog:write',
    'stock:write',
    'theme:write',
    'bar:scan_and_redeem',
    'bar:resolve_conflict',
    'orders:refund',
    'settlements:read',
    'reports:read',
  ]),
  ADMIN: new Set<PermissionCode>([
    'staff:manage',
    'bar_stations:authorize',
    'catalog:write',
    'stock:write',
    'theme:write',
    'bar:scan_and_redeem',
    'bar:resolve_conflict',
    'orders:refund',
    'settlements:read',
    'reports:read',
  ]),
  MANAGER: new Set<PermissionCode>([
    'bar_stations:authorize',
    'stock:write',
    'bar:scan_and_redeem',
    'bar:resolve_conflict',
    'orders:refund',
    'reports:read',
  ]),
  BARTENDER: new Set<PermissionCode>(['bar:scan_and_redeem', 'bar:resolve_conflict']),
  MARKETING: new Set<PermissionCode>(['catalog:write', 'theme:write', 'reports:read']),
  READONLY: new Set<PermissionCode>(['settlements:read', 'reports:read']),
};

export function hasRolePermission(
  role: TenantRole,
  permission: PermissionCode,
  options?: { allowBartenderConflictResolution?: boolean }
): boolean {
  if (
    role === 'BARTENDER' &&
    permission === 'bar:resolve_conflict' &&
    options?.allowBartenderConflictResolution === false
  ) {
    return false;
  }
  return ROLE_PERMISSION_MATRIX[role]?.has(permission) ?? false;
}

export function assertRolePermission(
  role: TenantRole,
  permission: PermissionCode,
  options?: { allowBartenderConflictResolution?: boolean }
): void {
  if (!hasRolePermission(role, permission, options)) {
    throw new Error(
      `FORBIDDEN: El rol "${role}" no posee el permiso requerido "${permission}".`
    );
  }
}

export interface TenantUserRecord {
  id: string;
  tenant_id: string;
  user_id: string | null;
  staff_display_name: string;
  role: TenantRole;
  is_active: boolean;
}

/**
 * Emite un código de intercambio de un solo uso (TTL 30s) para transferir
 * de forma segura una sesión autenticada desde el dominio central hacia el subdominio de un boliche
 * sin compartir cookies comodín (*.barraonline.com.ar).
 */
export async function issueCrossSubdomainAuthTicket(params: {
  userId: string;
  targetTenantId: string;
  ttlSeconds?: number;
}): Promise<{ rawTicket: string; expiresAt: Date }> {
  const { rawToken, tokenHash } = generateHighEntropyToken(24);
  const ttlSeconds = params.ttlSeconds ?? 30;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  await withSuperadminContext(async (tx) => {
    await tx.query(
      `INSERT INTO auth_exchange_tickets (ticket_hash, user_id, target_tenant_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [tokenHash, params.userId, params.targetTenantId, expiresAt.toISOString()]
    );
  });

  return { rawTicket: rawToken, expiresAt };
}

/**
 * Consume atómicamente un ticket de intercambio en el subdominio destino.
 * Protegido contra ataques de repetición (Replay Attack) y uso cruzado en otro boliche.
 */
export async function consumeCrossSubdomainAuthTicket(params: {
  rawTicket: string;
  expectedTenantId: string;
}): Promise<{ userId: string; targetTenantId: string }> {
  const ticketHash = sha256Hex(params.rawTicket);

  return withSuperadminContext(async (tx) => {
    const res = await tx.query<{
      id: string;
      user_id: string;
      target_tenant_id: string;
      expires_at: string;
    }>(
      `UPDATE auth_exchange_tickets
       SET consumed_at = now()
       WHERE ticket_hash = $1
         AND target_tenant_id = $2
         AND consumed_at IS NULL
         AND expires_at > now()
       RETURNING id, user_id, target_tenant_id, expires_at`,
      [ticketHash, params.expectedTenantId]
    );

    const row = res.rows[0];
    if (!row) {
      throw new Error('Ticket de autenticación inválido, expirado o ya utilizado.');
    }

    return {
      userId: row.user_id,
      targetTenantId: row.target_tenant_id,
    };
  });
}

/**
 * Asigna o rota el PIN operativo de 6 dígitos de un Barman para la jornada nocturna actual.
 */
export async function assignBartenderShiftPin(params: {
  tenantId: string;
  actorRole: TenantRole;
  tenantUserId: string;
  pin: string;
  shiftDurationHours?: number;
}): Promise<void> {
  assertRolePermission(params.actorRole, 'bar_stations:authorize');
  const pinHash = hashShiftPin(params.tenantId, params.pin);
  const expiresAt = new Date(
    Date.now() + (params.shiftDurationHours ?? 12) * 60 * 60 * 1000
  );

  await withTenantContext(params.tenantId, async (tx) => {
    const res = await tx.query(
      `UPDATE tenant_users
       SET shift_pin_hash = $1,
           shift_pin_expires_at = $2
       WHERE id = $3 AND is_active = true
       RETURNING id`,
      [pinHash, expiresAt.toISOString(), params.tenantUserId]
    );
    if (res.rowCount === 0) {
      throw new Error('Usuario interno de barra no encontrado en este boliche.');
    }
  });
}

/**
 * Valida las credenciales operativas de un Barman (PIN de turno + usuario activo del boliche).
 */
export async function authenticateBartenderByShiftPin(params: {
  tenantId: string;
  tenantUserId: string;
  pin: string;
}): Promise<TenantUserRecord> {
  return withTenantContext(params.tenantId, async (tx) => {
    const res = await tx.query<
      TenantUserRecord & {
        shift_pin_hash: string | null;
        shift_pin_expires_at: string | null;
      }
    >(
      `SELECT id, tenant_id, user_id, staff_display_name, role, is_active,
              shift_pin_hash, shift_pin_expires_at
       FROM tenant_users
       WHERE id = $1 AND is_active = true
       LIMIT 1`,
      [params.tenantUserId]
    );

    const staff = res.rows[0];
    if (!staff || !staff.shift_pin_hash || !staff.shift_pin_expires_at) {
      throw new Error('Credenciales de turno inválidas o no configuradas.');
    }

    if (new Date(staff.shift_pin_expires_at).getTime() <= Date.now()) {
      throw new Error('El PIN de turno ha expirado. Solicitá renovación al Encargado.');
    }

    const valid = verifyShiftPin(params.tenantId, params.pin, staff.shift_pin_hash);
    if (!valid) {
      throw new Error('PIN de barra incorrecto.');
    }

    return {
      id: staff.id,
      tenant_id: staff.tenant_id,
      user_id: staff.user_id,
      staff_display_name: staff.staff_display_name,
      role: staff.role,
      is_active: staff.is_active,
    };
  });
}
