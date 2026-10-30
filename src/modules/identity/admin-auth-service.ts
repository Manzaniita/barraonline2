import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { withSuperadminContext } from '@/db';
import { hmacSha256Hex } from '@/modules/security/crypto-vault';

import {
  ADMIN_SESSION_COOKIE,
  DEFAULT_SUPERADMIN_EMAIL,
  ADMIN_SESSION_TTL_SECONDS,
  type AdminSessionPayload,
  validatePasswordStrength,
} from './admin-session-edge';

export {
  ADMIN_SESSION_COOKIE,
  DEFAULT_SUPERADMIN_EMAIL,
  ADMIN_SESSION_TTL_SECONDS,
  type AdminSessionPayload,
  validatePasswordStrength,
};

export interface SuperadminUserRecord {
  id: string;
  email: string;
  fullName: string;
  isSuperadmin: boolean;
  status: string;
  sessionVersion: number;
  createdAt: string;
}

function getSessionHmacSecret(): string {
  return (
    process.env.SESSION_HMAC_SECRET ||
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );
}

function signJsonPayload(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = hmacSha256Hex(getSessionHmacSecret(), encoded);
  return `${encoded}.${sig}`;
}

function verifySignedJsonPayload<T>(token: string | null | undefined): T | null {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig || !/^[0-9a-fA-F]{64}$/.test(sig)) return null;

  const expectedSig = hmacSha256Hex(getSessionHmacSecret(), encoded);
  const actualBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (
    actualBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(actualBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(encoded, 'base64url').toString('utf-8');
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Control en memoria de intentos fallidos (Sliding window / Rate limiting)
interface RateLimitBucket {
  count: number;
  firstAttemptAt: number;
  blockedUntil: number;
}
const loginRateLimitMap = new Map<string, RateLimitBucket>();

function checkAndRecordLoginAttempt(
  identifier: string,
  isSuccess: boolean
): { allowed: boolean; remainingAttempts: number; retryAfterSeconds?: number } {
  const now = Date.now();
  const maxAttempts = 5;
  const windowMs = 15 * 60 * 1000; // 15 minutos
  const blockDurationMs = 15 * 60 * 1000;

  const bucket = loginRateLimitMap.get(identifier);

  if (isSuccess) {
    loginRateLimitMap.delete(identifier);
    return { allowed: true, remainingAttempts: maxAttempts };
  }

  if (!bucket) {
    loginRateLimitMap.set(identifier, {
      count: 1,
      firstAttemptAt: now,
      blockedUntil: 0,
    });
    return { allowed: true, remainingAttempts: maxAttempts - 1 };
  }

  if (bucket.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((bucket.blockedUntil - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
  }

  // Reset si la ventana expiró
  if (now - bucket.firstAttemptAt > windowMs) {
    bucket.count = 1;
    bucket.firstAttemptAt = now;
    bucket.blockedUntil = 0;
    return { allowed: true, remainingAttempts: maxAttempts - 1 };
  }

  bucket.count++;
  if (bucket.count >= maxAttempts) {
    bucket.blockedUntil = now + blockDurationMs;
    const retryAfterSeconds = Math.ceil(blockDurationMs / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
  }

  return { allowed: true, remainingAttempts: maxAttempts - bucket.count };
}

/**
 * Inicializa la cuenta de superadministrador principal de forma determinista y segura.
 * Cumple con las 5 reglas del Criterio #2:
 * 1. Crea la cuenta si todavía no existe.
 * 2. Comprueba que el correo corresponde a la cuenta configurada (xjoacovidal@gmail.com).
 * 3. Asigna el rol SUPERADMIN.
 * 4. No vuelve a sobrescribir la contraseña en cada reinicio si ya existe hash configurado.
 * 5. No permite crear otro superadministrador desde un formulario público.
 */
export async function ensureSuperadminAccountInitialized(): Promise<void> {
  const targetEmail = (
    process.env.SUPERADMIN_INITIAL_EMAIL || DEFAULT_SUPERADMIN_EMAIL
  )
    .trim()
    .toLowerCase();

  const initialPassword = (process.env.SUPERADMIN_INITIAL_PASSWORD || '').trim();

  await withSuperadminContext(async (tx) => {
    const existing = await tx.query<{
      id: string;
      email: string;
      password_hash: string | null;
      is_superadmin: boolean;
      status: string;
    }>(
      `SELECT id, email, password_hash, is_superadmin, status
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [targetEmail]
    );

    const user = existing.rows[0];

    if (!user) {
      if (!initialPassword) {
        console.warn(
          `[BARRAONLINE-AUTH] No se configuró SUPERADMIN_INITIAL_PASSWORD en las variables de entorno. La cuenta ${targetEmail} no pudo inicializarse con contraseña.`
        );
        return;
      }

      const passwordHash = await hashPassword(initialPassword);
      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO users (
           email, full_name, password_hash, is_superadmin, status, session_version
         ) VALUES ($1, $2, $3, true, 'ACTIVE', 1)
         RETURNING id`,
        [targetEmail, 'Joaquín Vidal (Superadmin)', passwordHash]
      );

      const newUserId = inserted.rows[0]?.id;
      if (newUserId) {
        await tx.query(
          `INSERT INTO audit_logs (
             actor_user_id, actor_role, action, entity_type, entity_id, after_state
           ) VALUES ($1::uuid, 'SUPERADMIN', 'SUPERADMIN_INITIALIZED', 'user', $2, $3::jsonb)`,
          [newUserId, String(newUserId), JSON.stringify({ email: targetEmail, role: 'SUPERADMIN' })]
        );
      }
      return;
    }

    // El usuario ya existe. Comprobamos si tiene contraseña establecida.
    // Si ya tiene contraseña, NO la sobrescribimos en cada reinicio.
    if (!user.password_hash && initialPassword) {
      const passwordHash = await hashPassword(initialPassword);
      await tx.query(
        `UPDATE users
         SET password_hash = $2, is_superadmin = true, status = 'ACTIVE', updated_at = now()
         WHERE id = $1`,
        [user.id, passwordHash]
      );

      await tx.query(
        `INSERT INTO audit_logs (
           actor_user_id, actor_role, action, entity_type, entity_id, after_state
         ) VALUES ($1::uuid, 'SUPERADMIN', 'SUPERADMIN_PASSWORD_INITIALIZED', 'user', $2, $3::jsonb)`,
        [user.id, String(user.id), JSON.stringify({ email: targetEmail })]
      );
    } else if (!user.is_superadmin || user.status !== 'ACTIVE') {
      // Garantizamos que conserve los privilegios y el estado activo
      await tx.query(
        `UPDATE users
         SET is_superadmin = true, status = 'ACTIVE', updated_at = now()
         WHERE id = $1`,
        [user.id]
      );
    }
  });
}

export function createSignedAdminSessionToken(user: {
  id: string;
  email: string;
  fullName: string;
  sessionVersion: number;
  ttlSeconds?: number;
}): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const ttl = user.ttlSeconds ?? ADMIN_SESSION_TTL_SECONDS;
  const payload: AdminSessionPayload = {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: 'SUPERADMIN',
    sessionVersion: user.sessionVersion,
    issuedAt: nowSec,
    expiresAt: nowSec + ttl,
  };
  return signJsonPayload(payload);
}

export function verifySignedAdminSessionToken(
  token: string | null | undefined,
  nowMs: number = Date.now()
): AdminSessionPayload | null {
  const payload = verifySignedJsonPayload<AdminSessionPayload>(token);
  if (!payload || !payload.userId || payload.role !== 'SUPERADMIN') return null;
  const nowSec = Math.floor(nowMs / 1000);
  if (payload.expiresAt <= nowSec) return null;
  return payload;
}

/**
 * Verificación autoritativa desde el servidor (Defense in Depth).
 * Valida la firma del token y comprueba en la base de datos que el usuario siga existiendo,
 * continúe teniendo `is_superadmin = true`, su estado sea `ACTIVE`, y que la versión
 * de la sesión (`session_version`) coincida exactamente con la DB.
 */
export async function verifySuperadminSessionServerSide(
  token: string | null | undefined
): Promise<SuperadminUserRecord | null> {
  const payload = verifySignedAdminSessionToken(token);
  if (!payload) return null;

  return withSuperadminContext(async (tx) => {
    const res = await tx.query<{
      id: string;
      email: string;
      full_name: string;
      is_superadmin: boolean;
      status: string;
      session_version: number;
      created_at: string;
    }>(
      `SELECT id, email, full_name, is_superadmin, status, session_version, created_at
       FROM users
       WHERE id = $1 AND is_superadmin = true AND status = 'ACTIVE'
       LIMIT 1`,
      [payload.userId]
    );

    const user = res.rows[0];
    if (!user) return null;

    // Si la versión de la sesión no coincide, la sesión fue invalidada (por ejemplo tras cambio de contraseña)
    if (user.session_version !== payload.sessionVersion) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      isSuperadmin: user.is_superadmin,
      status: user.status,
      sessionVersion: user.session_version,
      createdAt: user.created_at,
    };
  });
}

/**
 * Autentica al superadministrador con mitigación de fuerza bruta y resistencia a timing attacks.
 */
export async function loginSuperadmin(params: {
  email: string;
  password: string;
  clientIp?: string;
}): Promise<{ user: SuperadminUserRecord; token: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const rateLimitKey = `${params.clientIp || 'unknown'}:${cleanEmail}`;

  const rateCheck = checkAndRecordLoginAttempt(rateLimitKey, false);
  if (!rateCheck.allowed) {
    throw new Error(
      `Demasiados intentos fallidos. Por favor esperá ${rateCheck.retryAfterSeconds ?? 900} segundos antes de volver a intentar.`
    );
  }

  // Obtenemos el usuario de la DB
  const user = await withSuperadminContext(async (tx) => {
    const res = await tx.query<{
      id: string;
      email: string;
      full_name: string;
      password_hash: string | null;
      is_superadmin: boolean;
      status: string;
      session_version: number;
      created_at: string;
    }>(
      `SELECT id, email, full_name, password_hash, is_superadmin, status, session_version, created_at
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [cleanEmail]
    );
    return res.rows[0] ?? null;
  });

  // Dummy compare para mitigar ataques de timing si el correo no existe
  if (!user || !user.password_hash) {
    const dummyHash =
      '$2a$12$e8Yp0yZzV1/0m3YyH8o2t.Z6OqfE8WwRj1l2U4p3M7m5Y8s6d9o1y';
    await bcrypt.compare(params.password, dummyHash).catch(() => false);
    throw new Error('Credenciales inválidas. Comprobá tu correo y contraseña.');
  }

  const isPasswordValid = await verifyPassword(params.password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('Credenciales inválidas. Comprobá tu correo y contraseña.');
  }

  if (!user.is_superadmin || user.status !== 'ACTIVE') {
    throw new Error('Tu cuenta no tiene privilegios de superadministrador o está inactiva.');
  }

  // Éxito: limpiamos el rate limit
  checkAndRecordLoginAttempt(rateLimitKey, true);

  const token = createSignedAdminSessionToken({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    sessionVersion: user.session_version,
  });

  // Registramos en auditoría
  await withSuperadminContext(async (tx) => {
    await tx.query(
      `INSERT INTO audit_logs (
         actor_user_id, actor_role, action, entity_type, entity_id, after_state
       ) VALUES ($1::uuid, 'SUPERADMIN', 'SUPERADMIN_LOGIN_SUCCESS', 'user', $2, $3::jsonb)`,
      [user.id, String(user.id), JSON.stringify({ email: cleanEmail, ip: params.clientIp || null })]
    );
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      isSuperadmin: user.is_superadmin,
      status: user.status,
      sessionVersion: user.session_version,
      createdAt: user.created_at,
    },
    token,
  };
}

/**
 * Cambia la contraseña del superadministrador, incrementa session_version
 * (invalidando todas las sesiones anteriores) y emite un nuevo token activo.
 */
export async function changeSuperadminPassword(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}): Promise<{ user: SuperadminUserRecord; newToken: string }> {
  if (params.newPassword !== params.confirmNewPassword) {
    throw new Error('La nueva contraseña y su confirmación no coinciden.');
  }

  const strength = validatePasswordStrength(params.newPassword);
  if (!strength.valid) {
    throw new Error(strength.message || 'La nueva contraseña no cumple los requisitos de seguridad.');
  }

  return withSuperadminContext(async (tx) => {
    const res = await tx.query<{
      id: string;
      email: string;
      full_name: string;
      password_hash: string | null;
      is_superadmin: boolean;
      status: string;
      session_version: number;
      created_at: string;
    }>(
      `SELECT id, email, full_name, password_hash, is_superadmin, status, session_version, created_at
       FROM users
       WHERE id = $1 AND is_superadmin = true
       LIMIT 1`,
      [params.userId]
    );

    const user = res.rows[0];
    if (!user || !user.password_hash) {
      throw new Error('Usuario superadministrador no encontrado.');
    }

    const currentMatches = await verifyPassword(
      params.currentPassword,
      user.password_hash
    );
    if (!currentMatches) {
      throw new Error('La contraseña actual ingresada es incorrecta.');
    }

    const newHash = await hashPassword(params.newPassword);
    const newVersion = (user.session_version || 1) + 1;

    const updateRes = await tx.query<{
      id: string;
      email: string;
      full_name: string;
      is_superadmin: boolean;
      status: string;
      session_version: number;
      created_at: string;
    }>(
      `UPDATE users
       SET password_hash = $2, session_version = $3, updated_at = now()
       WHERE id = $1
       RETURNING id, email, full_name, is_superadmin, status, session_version, created_at`,
      [user.id, newHash, newVersion]
    );

    const updatedUser = updateRes.rows[0]!;

    // Auditoría
    await tx.query(
      `INSERT INTO audit_logs (
         actor_user_id, actor_role, action, entity_type, entity_id, after_state
       ) VALUES ($1::uuid, 'SUPERADMIN', 'SUPERADMIN_PASSWORD_CHANGED', 'user', $2, $3::jsonb)`,
      [
        user.id,
        String(user.id),
        JSON.stringify({
          email: user.email,
          newSessionVersion: newVersion,
        }),
      ]
    );

    const newToken = createSignedAdminSessionToken({
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.full_name,
      sessionVersion: updatedUser.session_version,
    });

    return {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.full_name,
        isSuperadmin: updatedUser.is_superadmin,
        status: updatedUser.status,
        sessionVersion: updatedUser.session_version,
        createdAt: updatedUser.created_at,
      },
      newToken,
    };
  });
}

/**
 * Cierra todas las demás sesiones activas incrementando session_version.
 */
export async function revokeAllOtherAdminSessions(
  userId: string
): Promise<{ user: SuperadminUserRecord; newToken: string }> {
  return withSuperadminContext(async (tx) => {
    const res = await tx.query<{
      id: string;
      email: string;
      full_name: string;
      is_superadmin: boolean;
      status: string;
      session_version: number;
      created_at: string;
    }>(
      `UPDATE users
       SET session_version = session_version + 1, updated_at = now()
       WHERE id = $1 AND is_superadmin = true
       RETURNING id, email, full_name, is_superadmin, status, session_version, created_at`,
      [userId]
    );

    const updatedUser = res.rows[0];
    if (!updatedUser) {
      throw new Error('Usuario superadministrador no encontrado.');
    }

    await tx.query(
      `INSERT INTO audit_logs (
         actor_user_id, actor_role, action, entity_type, entity_id, after_state
       ) VALUES ($1::uuid, 'SUPERADMIN', 'SUPERADMIN_SESSIONS_REVOKED', 'user', $2, $3::jsonb)`,
      [
        updatedUser.id,
        String(updatedUser.id),
        JSON.stringify({
          email: updatedUser.email,
          newSessionVersion: updatedUser.session_version,
        }),
      ]
    );

    const newToken = createSignedAdminSessionToken({
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.full_name,
      sessionVersion: updatedUser.session_version,
    });

    return {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.full_name,
        isSuperadmin: updatedUser.is_superadmin,
        status: updatedUser.status,
        sessionVersion: updatedUser.session_version,
        createdAt: updatedUser.created_at,
      },
      newToken,
    };
  });
}
