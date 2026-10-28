import { describe, expect, it } from 'vitest';
import {
  decryptTenantSecret,
  encryptTenantSecret,
  generatePkcePair,
  hashShiftPin,
  hmacSha256Hex,
  verifyMercadoPagoWebhookSignature,
  verifyShiftPin,
} from '@/modules/security/crypto-vault';
import {
  calculateWcagContrastRatio,
  computeBusinessDate,
  resolveTenantSlugFromHost,
  sanitizeAndValidateThemeConfig,
} from '@/modules/tenancy/tenant-service';

const TENANT_A_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_B_ID = '22222222-2222-4222-8222-222222222222';

describe('Bóveda Criptográfica AES-256-GCM y Firmas Mercado Pago', () => {
  it('cifra y descifra correctamente el access_token de Mercado Pago para el mismo boliche', () => {
    const rawAccessToken = 'APP_USR-89421598124-102819-secret-token-museum';
    const encrypted = encryptTenantSecret(TENANT_A_ID, rawAccessToken);

    expect(encrypted.ciphertext.toString('utf-8')).not.toContain('APP_USR');
    const decrypted = decryptTenantSecret(TENANT_A_ID, encrypted);
    expect(decrypted).toBe(rawAccessToken);
  });

  it('rechaza criptográficamente el descifrado si otro boliche intenta usar el ciphertext (protección AAD)', () => {
    const rawAccessToken = 'APP_USR-89421598124-102819-secret-token-museum';
    const encryptedForA = encryptTenantSecret(TENANT_A_ID, rawAccessToken);

    expect(() => decryptTenantSecret(TENANT_B_ID, encryptedForA)).toThrow();
  });

  it('valida firmas HMAC-SHA256 x-signature de Webhooks de Mercado Pago y bloquea replay attacks', () => {
    const webhookSecret = 'mp_prod_webhook_secret_key_2026';
    const dataId = '98765432109';
    const xRequestId = 'req-uuid-12345';
    const nowEpoch = 1761680000;

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${nowEpoch};`;
    const signatureHex = hmacSha256Hex(webhookSecret, manifest);
    const xSignature = `ts=${nowEpoch},v1=${signatureHex}`;

    const okResult = verifyMercadoPagoWebhookSignature({
      xSignatureHeader: xSignature,
      xRequestIdHeader: xRequestId,
      dataIdQueryParam: dataId,
      webhookSecret,
      nowEpochSeconds: nowEpoch + 15,
    });
    expect(okResult.valid).toBe(true);

    // Intento de alterar el payment_id en la URL manteniendo la firma
    const tamperedIdResult = verifyMercadoPagoWebhookSignature({
      xSignatureHeader: xSignature,
      xRequestIdHeader: xRequestId,
      dataIdQueryParam: '11111111111',
      webhookSecret,
      nowEpochSeconds: nowEpoch + 15,
    });
    expect(tamperedIdResult.valid).toBe(false);
    expect(tamperedIdResult.reason).toBe('HMAC_SIGNATURE_MISMATCH');

    // Intento de Replay Attack con timestamp de hace 20 minutos
    const replayResult = verifyMercadoPagoWebhookSignature({
      xSignatureHeader: xSignature,
      xRequestIdHeader: xRequestId,
      dataIdQueryParam: dataId,
      webhookSecret,
      nowEpochSeconds: nowEpoch + 1200,
    });
    expect(replayResult.valid).toBe(false);
    expect(replayResult.reason).toBe('TIMESTAMP_OUTSIDE_TOLERANCE_WINDOW');
  });

  it('genera pares PKCE S256 válidos y verifica PINs de barra aislados por tenant', () => {
    const pkce = generatePkcePair();
    expect(pkce.codeChallengeMethod).toBe('S256');
    expect(pkce.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(pkce.codeChallenge.length).toBeGreaterThanOrEqual(43);

    const pinHash = hashShiftPin(TENANT_A_ID, '482910');
    expect(verifyShiftPin(TENANT_A_ID, '482910', pinHash)).toBe(true);
    expect(verifyShiftPin(TENANT_A_ID, '000000', pinHash)).toBe(false);
    // El mismo hash copiado al Tenant B no valida porque la sal incluye el tenantId
    expect(verifyShiftPin(TENANT_B_ID, '482910', pinHash)).toBe(false);
  });
});

describe('Resolución de Subdominios, Noche Comercial y Guardarraíl WCAG', () => {
  it('extrae subdominios válidos y bloquea subdominios reservados', () => {
    expect(resolveTenantSlugFromHost('museum.barraonline.com.ar')).toBe('museum');
    expect(resolveTenantSlugFromHost('pueblo-limite.barraonline.com.ar:443')).toBe(
      'pueblo-limite'
    );
    expect(resolveTenantSlugFromHost('museum.localhost:3000')).toBe('museum');
    expect(resolveTenantSlugFromHost('barraonline.com.ar')).toBeNull();
    expect(resolveTenantSlugFromHost('www.barraonline.com.ar')).toBeNull();
    expect(resolveTenantSlugFromHost('superadmin.barraonline.com.ar')).toBeNull();
  });

  it('asigna las ventas de madrugada (04:30 AM Argentina) a la jornada nocturna iniciada la noche anterior', () => {
    // Domingo 1 de Noviembre 2026 a las 04:30 AM en Argentina (UTC-3) = 07:30 UTC
    const sunday430AmArgentina = new Date('2026-11-01T07:30:00.000Z');
    expect(computeBusinessDate(sunday430AmArgentina, 10)).toBe('2026-10-31');

    // Domingo 1 de Noviembre 2026 a las 11:30 AM en Argentina (UTC-3) = 14:30 UTC
    const sunday1130AmArgentina = new Date('2026-11-01T14:30:00.000Z');
    expect(computeBusinessDate(sunday1130AmArgentina, 10)).toBe('2026-11-01');
  });

  it('corrige colores inaccesibles y calcula texto contrastante automáticamente según WCAG', () => {
    // Un dueño intenta poner #0A0A0C (casi negro) sobre fondo #070709
    const sanitized = sanitizeAndValidateThemeConfig({
      accentPrimary: '#0A0A0C',
    });
    expect(sanitized.accentPrimary).toBe('#FF2E63');
    expect(
      calculateWcagContrastRatio(sanitized.accentPrimary, sanitized.accentOnPrimary)
    ).toBeGreaterThanOrEqual(4.0);
  });
});
