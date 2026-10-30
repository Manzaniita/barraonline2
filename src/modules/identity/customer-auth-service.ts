import crypto from 'node:crypto';
import { withSuperadminContext, withTenantContext } from '@/db';
import {
  generateHighEntropyToken,
  generatePkcePair,
  hmacSha256Hex,
  sha256Hex,
} from '@/modules/security/crypto-vault';

export const CUSTOMER_SESSION_COOKIE = 'bo_customer_session';
export const GUEST_SESSION_COOKIE = 'bo_guest_session';
export const GOOGLE_OAUTH_STATE_COOKIE = 'bo_google_oauth_state';
export const ORDER_ACCESS_COOKIE_PREFIX = 'bo_order_tok_';
export const DRAFT_ACCESS_COOKIE_PREFIX = 'bo_draft_tok_';

export interface CustomerSessionPayload {
  userId: string;
  email: string | null;
  fullName: string;
  avatarUrl: string | null;
  provider: 'GOOGLE' | 'EXPRESS_SESSION';
  issuedAt: number;
  expiresAt: number;
}

export interface GoogleOAuthStateCookiePayload {
  csrfNonce: string;
  tenantSlug: string;
  returnStep: number;
  codeVerifier: string;
  issuedAt: number;
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

export function isGoogleOAuthConfigured(): boolean {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) return false;
  if (
    clientId === 'your-google-client-id.apps.googleusercontent.com' ||
    clientSecret === 'your-google-client-secret'
  ) {
    return false;
  }
  return true;
}

export function createSignedCustomerSessionToken(params: {
  userId: string;
  email: string | null;
  fullName: string;
  avatarUrl?: string | null;
  provider: 'GOOGLE' | 'EXPRESS_SESSION';
  ttlSeconds?: number;
  nowMs?: number;
}): string {
  const nowSec = Math.floor((params.nowMs ?? Date.now()) / 1000);
  const ttl = params.ttlSeconds ?? 7 * 24 * 60 * 60; // 7 days
  const payload: CustomerSessionPayload = {
    userId: params.userId,
    email: params.email,
    fullName: params.fullName,
    avatarUrl: params.avatarUrl ?? null,
    provider: params.provider,
    issuedAt: nowSec,
    expiresAt: nowSec + ttl,
  };
  return signJsonPayload(payload);
}

export function verifySignedCustomerSessionToken(
  token: string | null | undefined,
  nowMs: number = Date.now()
): CustomerSessionPayload | null {
  const payload = verifySignedJsonPayload<CustomerSessionPayload>(token);
  if (!payload || !payload.userId || !payload.fullName) return null;
  const nowSec = Math.floor(nowMs / 1000);
  if (payload.expiresAt <= nowSec) return null;
  return payload;
}

export function createSignedGuestSessionToken(): {
  rawSessionId: string;
  signedCookieValue: string;
} {
  const { rawToken } = generateHighEntropyToken(24);
  const signedCookieValue = signJsonPayload({
    sid: rawToken,
    iat: Math.floor(Date.now() / 1000),
  });
  return { rawSessionId: rawToken, signedCookieValue };
}

export function verifySignedGuestSessionToken(
  cookieValue: string | null | undefined
): string | null {
  const parsed = verifySignedJsonPayload<{ sid?: string }>(cookieValue);
  if (!parsed?.sid || typeof parsed.sid !== 'string' || parsed.sid.length < 16) {
    return null;
  }
  return parsed.sid;
}

/**
 * Construye la URL oficial de autorización Google OAuth 2.0 / OIDC con PKCE (S256)
 * y parámetro `state` firmado criptográficamente contra CSRF.
 */
export function buildGoogleOAuthAuthorizationFlow(params: {
  tenantSlug: string;
  returnStep?: number;
  clientId?: string;
  redirectUri?: string;
  nowMs?: number;
}): {
  authorizationUrl: string;
  state: string;
  signedStateCookieValue: string;
  codeVerifier: string;
} {
  const clientId = (params.clientId ?? process.env.GOOGLE_CLIENT_ID ?? '').trim();
  if (!clientId || clientId === 'your-google-client-id.apps.googleusercontent.com') {
    throw new Error(
      'GOOGLE_OAUTH_NOT_CONFIGURED: Faltan configurar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET válidos en el entorno.'
    );
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(
    /\/$/,
    ''
  );
  const redirectUri =
    (params.redirectUri ?? process.env.GOOGLE_REDIRECT_URI ?? '').trim() ||
    `${appUrl}/api/auth/google/callback`;

  const { codeVerifier, codeChallenge, codeChallengeMethod } = generatePkcePair();
  const { rawToken: csrfNonce } = generateHighEntropyToken(18);
  const issuedAt = Math.floor((params.nowMs ?? Date.now()) / 1000);
  const returnStep = Math.min(4, Math.max(1, params.returnStep ?? 3));
  const cleanSlug = params.tenantSlug.trim().toLowerCase();

  const statePayload = `${csrfNonce}.${cleanSlug}.${returnStep}.${issuedAt}`;
  const stateSig = hmacSha256Hex(getSessionHmacSecret(), statePayload);
  const state = `${statePayload}.${stateSig}`;

  const cookiePayload: GoogleOAuthStateCookiePayload = {
    csrfNonce,
    tenantSlug: cleanSlug,
    returnStep,
    codeVerifier,
    issuedAt,
  };
  const signedStateCookieValue = signJsonPayload(cookiePayload);

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', codeChallengeMethod);
  url.searchParams.set('prompt', 'select_account');

  return {
    authorizationUrl: url.toString(),
    state,
    signedStateCookieValue,
    codeVerifier,
  };
}

/**
 * Verifica el parámetro `state` devuelto por Google contra la cookie HttpOnly firmada,
 * previniendo CSRF, manipulación de redirección y replay fuera de ventana (10 min).
 */
export function verifyGoogleOAuthCallbackState(params: {
  stateQueryParam: string | null | undefined;
  signedStateCookieValue: string | null | undefined;
  nowMs?: number;
  maxAgeSeconds?: number;
}): {
  valid: boolean;
  reason?: string;
  tenantSlug?: string;
  returnStep?: number;
  codeVerifier?: string;
} {
  const {
    stateQueryParam,
    signedStateCookieValue,
    nowMs = Date.now(),
    maxAgeSeconds = 600,
  } = params;

  if (!stateQueryParam || !signedStateCookieValue) {
    return { valid: false, reason: 'MISSING_STATE_OR_COOKIE' };
  }

  const cookieData = verifySignedJsonPayload<GoogleOAuthStateCookiePayload>(
    signedStateCookieValue
  );
  if (!cookieData) {
    return { valid: false, reason: 'INVALID_STATE_COOKIE_SIGNATURE' };
  }

  const parts = stateQueryParam.split('.');
  if (parts.length !== 5) {
    return { valid: false, reason: 'MALFORMED_STATE_PARAM' };
  }

  const [csrfNonce, tenantSlug, returnStepStr, issuedAtStr, sig] = parts;
  if (
    !csrfNonce ||
    !tenantSlug ||
    !returnStepStr ||
    !issuedAtStr ||
    !sig ||
    !/^[0-9a-fA-F]{64}$/.test(sig)
  ) {
    return { valid: false, reason: 'MALFORMED_STATE_PARAM' };
  }

  const statePayload = `${csrfNonce}.${tenantSlug}.${returnStepStr}.${issuedAtStr}`;
  const expectedSig = hmacSha256Hex(getSessionHmacSecret(), statePayload);
  const actualBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (
    actualBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(actualBuf, expectedBuf)
  ) {
    return { valid: false, reason: 'STATE_HMAC_MISMATCH' };
  }

  if (
    cookieData.csrfNonce !== csrfNonce ||
    cookieData.tenantSlug !== tenantSlug
  ) {
    return { valid: false, reason: 'CSRF_NONCE_MISMATCH' };
  }

  const nowSec = Math.floor(nowMs / 1000);
  if (Math.abs(nowSec - cookieData.issuedAt) > maxAgeSeconds) {
    return { valid: false, reason: 'STATE_EXPIRED' };
  }

  return {
    valid: true,
    tenantSlug: cookieData.tenantSlug,
    returnStep: cookieData.returnStep,
    codeVerifier: cookieData.codeVerifier,
  };
}

/**
 * Registra o actualiza la identidad verificada por Google OIDC en la tabla `users`
 * y vincula automáticamente cualquier borrador activo de la sesión del navegador
 * sin duplicar pedidos.
 */
export async function upsertAuthenticatedGoogleCustomer(params: {
  googleSub: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  tenantId?: string | null;
  guestSessionToken?: string | null;
}): Promise<{
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  sessionToken: string;
}> {
  if (!params.googleSub || params.googleSub.trim().length < 3) {
    throw new Error('INVALID_GOOGLE_SUB: Identificador OIDC de Google inválido.');
  }

  const cleanEmail = params.email.trim().toLowerCase();
  const cleanName = params.fullName.trim().slice(0, 160) || 'Cliente Google';
  const cleanAvatar = params.avatarUrl?.trim() || null;

  const userRow = await withSuperadminContext(async (tx) => {
    const res = await tx.query<{
      id: string;
      email: string;
      full_name: string;
      avatar_url: string | null;
    }>(
      `INSERT INTO users (google_sub, email, full_name, avatar_url, is_superadmin, updated_at)
       VALUES ($1, $2, $3, $4, false, now())
       ON CONFLICT (google_sub) DO UPDATE SET
         email = EXCLUDED.email,
         full_name = EXCLUDED.full_name,
         avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
         updated_at = now()
       RETURNING id, email, full_name, avatar_url`,
      [params.googleSub.trim(), cleanEmail, cleanName, cleanAvatar]
    );
    return res.rows[0]!;
  });

  // Si el cliente tenía un borrador o pedido en curso en su sesión antes de volver de Google,
  // lo vinculamos a su cuenta autenticada sin duplicar pedidos.
  if (params.tenantId && params.guestSessionToken) {
    const guestSessionHash = sha256Hex(params.guestSessionToken);
    await withTenantContext(params.tenantId, async (tx) => {
      await tx.query(
        `UPDATE order_drafts
         SET customer_user_id = $1,
             customer_display_name = $2,
             updated_at = now()
         WHERE guest_session_hash = $3
           AND status = 'SAVED'
           AND (customer_user_id IS NULL OR customer_user_id = $1)`,
        [userRow.id, userRow.full_name, guestSessionHash]
      );

      await tx.query(
        `UPDATE orders
         SET customer_user_id = $1,
             customer_display_name = $2,
             updated_at = now()
         WHERE guest_session_hash = $3
           AND customer_user_id IS NULL`,
        [userRow.id, userRow.full_name, guestSessionHash]
      );
    });
  }

  const sessionToken = createSignedCustomerSessionToken({
    userId: userRow.id,
    email: userRow.email,
    fullName: userRow.full_name,
    avatarUrl: userRow.avatar_url,
    provider: 'GOOGLE',
  });

  return {
    userId: userRow.id,
    email: userRow.email,
    fullName: userRow.full_name,
    avatarUrl: userRow.avatar_url,
    sessionToken,
  };
}

/**
 * Crea o recupera una sesión válida de comprador vinculada a `users` y a la sesión actual
 * (sin simular que fue autenticada por Google).
 */
export async function upsertExpressCustomerSession(params: {
  displayName: string;
  emailOrContact?: string | null;
  tenantId?: string | null;
  guestSessionToken: string;
}): Promise<{
  userId: string;
  email: string | null;
  fullName: string;
  sessionToken: string;
}> {
  const cleanName = params.displayName.trim().slice(0, 120);
  if (cleanName.length < 2) {
    throw new Error('Indicá tu nombre o apodo para identificar tu pedido.');
  }

  const rawContact = (params.emailOrContact ?? '').trim().toLowerCase();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawContact);
  const emailValue = isEmail ? rawContact : null;
  const guestSessionHash = sha256Hex(params.guestSessionToken);

  const userRow = await withSuperadminContext(async (tx) => {
    if (emailValue) {
      const existingByEmail = await tx.query<{
        id: string;
        email: string | null;
        full_name: string;
        google_sub: string | null;
      }>(`SELECT id, email, full_name, google_sub FROM users WHERE email = $1 LIMIT 1`, [
        emailValue,
      ]);

      // Si el email no pertenece a una cuenta Google existente, reutilizamos o actualizamos
      if (existingByEmail.rows[0] && !existingByEmail.rows[0].google_sub) {
        const updated = await tx.query<{
          id: string;
          email: string | null;
          full_name: string;
        }>(
          `UPDATE users SET full_name = $2, updated_at = now() WHERE id = $1 RETURNING id, email, full_name`,
          [existingByEmail.rows[0].id, cleanName]
        );
        return updated.rows[0]!;
      }
    }

    const inserted = await tx.query<{
      id: string;
      email: string | null;
      full_name: string;
    }>(
      `INSERT INTO users (email, full_name, is_superadmin)
       VALUES ($1, $2, false)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, full_name`,
      [emailValue, cleanName]
    );

    if (inserted.rows[0]) {
      return inserted.rows[0];
    }

    const fallback = await tx.query<{
      id: string;
      email: string | null;
      full_name: string;
    }>(
      `INSERT INTO users (full_name, is_superadmin)
       VALUES ($1, false)
       RETURNING id, email, full_name`,
      [cleanName]
    );
    return fallback.rows[0]!;
  });

  if (params.tenantId) {
    await withTenantContext(params.tenantId, async (tx) => {
      await tx.query(
        `UPDATE order_drafts
         SET customer_user_id = $1,
             customer_display_name = $2,
             updated_at = now()
         WHERE guest_session_hash = $3
           AND status = 'SAVED'`,
        [userRow.id, userRow.full_name, guestSessionHash]
      );
    });
  }

  const sessionToken = createSignedCustomerSessionToken({
    userId: userRow.id,
    email: userRow.email,
    fullName: userRow.full_name,
    provider: 'EXPRESS_SESSION',
  });

  return {
    userId: userRow.id,
    email: userRow.email,
    fullName: userRow.full_name,
    sessionToken,
  };
}
