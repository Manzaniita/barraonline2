import crypto from 'node:crypto';
import { assertValidUuid } from '@/db';

export interface EncryptedSecretPayload {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
}

const DEFAULT_DEV_MASTER_KEY_HEX =
  '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

function getMasterKeyBuffer(keyVersion = 1): Buffer {
  const envVarName = `MP_CREDENTIALS_MASTER_KEY_V${keyVersion}`;
  const rawHex = process.env[envVarName] || DEFAULT_DEV_MASTER_KEY_HEX;
  if (!/^[0-9a-fA-F]{64}$/.test(rawHex)) {
    throw new Error(
      `Invalid master key ${envVarName}: must be a 64-character hex string (256 bits).`
    );
  }
  return Buffer.from(rawHex, 'hex');
}

/**
 * Cifra un secreto sensible (ej. access_token o refresh_token de Mercado Pago)
 * usando AES-256-GCM y vinculándolo criptográficamente al `tenantId` mediante AAD.
 */
export function encryptTenantSecret(
  tenantId: string,
  plaintext: string,
  keyVersion = 1
): EncryptedSecretPayload {
  assertValidUuid(tenantId, 'tenantId');
  if (!plaintext || plaintext.trim().length === 0) {
    throw new Error('Cannot encrypt an empty secret.');
  }

  const key = getMasterKeyBuffer(keyVersion);
  const iv = crypto.randomBytes(12); // 96-bit IV recomendado por NIST para AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, {
    authTagLength: 16,
  });

  // Vinculación criptográfica de contexto: el ciphertext solo es válido para este tenant_id
  cipher.setAAD(Buffer.from(`barraonline:tenant:${tenantId.toLowerCase()}`, 'utf-8'));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf-8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv,
    authTag,
    keyVersion,
  };
}

/**
 * Descifra un secreto previamente cifrado con `encryptTenantSecret`.
 * Si el `tenantId` no coincide exactamente con el AAD original o si el ciphertext/tag
 * fue alterado en la base de datos, lanza una excepción criptográfica.
 */
export function decryptTenantSecret(
  tenantId: string,
  payload: EncryptedSecretPayload
): string {
  assertValidUuid(tenantId, 'tenantId');
  const key = getMasterKeyBuffer(payload.keyVersion);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, payload.iv, {
    authTagLength: 16,
  });
  decipher.setAAD(Buffer.from(`barraonline:tenant:${tenantId.toLowerCase()}`, 'utf-8'));
  decipher.setAuthTag(payload.authTag);

  const decrypted = Buffer.concat([
    decipher.update(payload.ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf-8');
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf-8').digest('hex');
}

export function hmacSha256Hex(secret: string, message: string): string {
  return crypto.createHmac('sha256', secret).update(message, 'utf-8').digest('hex');
}

/**
 * Genera un token de alta entropía (192 bits por defecto = 24 bytes random en base64url)
 * para códigos QR de retiro o tokens de acceso a órdenes de invitados.
 */
export function generateHighEntropyToken(byteLength = 24): {
  rawToken: string;
  tokenHash: string;
  shortCode: string;
} {
  const randomBytes = crypto.randomBytes(byteLength);
  const rawToken = randomBytes.toString('base64url');
  const tokenHash = sha256Hex(rawToken);
  // Código alfanumérico sin caracteres ambiguos (sin 0/O/1/I) para visualización en barra
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let shortCode = '';
  for (let i = 0; i < 6; i++) {
    const byte = randomBytes[i] ?? 0;
    shortCode += alphabet[byte % alphabet.length];
  }
  return { rawToken, tokenHash, shortCode };
}

/**
 * Genera el par PKCE (code_verifier y code_challenge S256) según RFC 7636
 * requerido por Mercado Pago OAuth 2.0 Authorization Code flow.
 */
export function generatePkcePair(): {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
} {
  const codeVerifier = crypto.randomBytes(48).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier, 'ascii')
    .digest('base64url');
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
}

/**
 * Verifica la cabecera `x-signature` de los Webhooks de Mercado Pago (HMAC-SHA256)
 * siguiendo la especificación oficial de Mercado Pago Developers:
 * Manifest = `id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];`
 */
export function verifyMercadoPagoWebhookSignature(params: {
  xSignatureHeader: string | null | undefined;
  xRequestIdHeader: string | null | undefined;
  dataIdQueryParam: string | null | undefined;
  webhookSecret: string;
  nowEpochSeconds?: number;
  toleranceSeconds?: number;
}): { valid: boolean; reason?: string; timestamp?: number } {
  const {
    xSignatureHeader,
    xRequestIdHeader,
    dataIdQueryParam,
    webhookSecret,
    nowEpochSeconds = Math.floor(Date.now() / 1000),
    toleranceSeconds = 300,
  } = params;

  if (!xSignatureHeader || !xRequestIdHeader || !dataIdQueryParam) {
    return { valid: false, reason: 'MISSING_SIGNATURE_HEADERS_OR_DATA_ID' };
  }

  let tsStr: string | undefined;
  let v1Hex: string | undefined;

  for (const part of xSignatureHeader.split(',')) {
    const [k, v] = part.trim().split('=', 2);
    if (k === 'ts' && v) tsStr = v.trim();
    if (k === 'v1' && v) v1Hex = v.trim();
  }

  if (!tsStr || !v1Hex || !/^\d+$/.test(tsStr) || !/^[0-9a-fA-F]{64}$/.test(v1Hex)) {
    return { valid: false, reason: 'MALFORMED_X_SIGNATURE_HEADER' };
  }

  const ts = Number.parseInt(tsStr, 10);
  if (Math.abs(nowEpochSeconds - ts) > toleranceSeconds) {
    return { valid: false, reason: 'TIMESTAMP_OUTSIDE_TOLERANCE_WINDOW', timestamp: ts };
  }

  // Según documentación oficial de MP: si data.id es alfanumérico debe ir en minúsculas
  const normalizedDataId = dataIdQueryParam.toLowerCase();
  const manifest = `id:${normalizedDataId};request-id:${xRequestIdHeader};ts:${tsStr};`;
  const expectedHex = hmacSha256Hex(webhookSecret, manifest);

  const actualBuf = Buffer.from(v1Hex, 'hex');
  const expectedBuf = Buffer.from(expectedHex, 'hex');

  if (
    actualBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(actualBuf, expectedBuf)
  ) {
    return { valid: false, reason: 'HMAC_SIGNATURE_MISMATCH', timestamp: ts };
  }

  return { valid: true, timestamp: ts };
}

/**
 * Hash seguro con derivación scrypt y sal vinculada al tenant para PINs operativos de barra.
 */
export function hashShiftPin(tenantId: string, pin: string): string {
  assertValidUuid(tenantId, 'tenantId');
  if (!/^\d{6}$/.test(pin)) {
    throw new Error('El PIN de turno debe tener exactamente 6 dígitos numéricos.');
  }
  const randomSalt = crypto.randomBytes(16).toString('hex');
  const contextualSalt = `${tenantId.toLowerCase()}:${randomSalt}`;
  const derived = crypto.scryptSync(pin, contextualSalt, 32).toString('hex');
  return `scrypt$${randomSalt}$${derived}`;
}

export function verifyShiftPin(
  tenantId: string,
  pin: string,
  storedHash: string | null | undefined
): boolean {
  if (!storedHash || !/^\d{6}$/.test(pin)) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const randomSalt = parts[1];
  const expectedHex = parts[2];
  if (!randomSalt || !expectedHex) return false;

  const contextualSalt = `${tenantId.toLowerCase()}:${randomSalt}`;
  const actualBuf = crypto.scryptSync(pin, contextualSalt, 32);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}
