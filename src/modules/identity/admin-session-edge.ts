export const ADMIN_SESSION_COOKIE = 'bo_admin_session';
export const DEFAULT_SUPERADMIN_EMAIL = 'xjoacovidal@gmail.com';
export const ADMIN_SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 horas

export interface AdminSessionPayload {
  userId: string;
  email: string;
  fullName: string;
  role: 'SUPERADMIN';
  sessionVersion: number;
  issuedAt: number;
  expiresAt: number;
}

function getSessionHmacSecret(): string {
  return (
    process.env.SESSION_HMAC_SECRET ||
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  message?: string;
  score: number; // 0 to 4
} {
  let score = 0;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (password.length < 10) {
    return {
      valid: false,
      message: 'La contraseña debe tener al menos 10 caracteres.',
      score,
    };
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
    return {
      valid: false,
      message: 'La contraseña debe contener letras mayúsculas y minúsculas.',
      score,
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: 'La contraseña debe incluir al menos un número.',
      score,
    };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      valid: false,
      message: 'La contraseña debe incluir al menos un símbolo o carácter especial.',
      score,
    };
  }

  return { valid: true, score: Math.min(4, score) };
}

/**
 * Validador criptográfico de tokens de sesión para el Edge Runtime / Middleware.
 * No depende de módulos de Node.js (fs, path, etc.) ni de la base de datos.
 */
export async function verifySignedAdminSessionTokenEdge(
  token: string | null | undefined,
  nowMs: number = Date.now()
): Promise<AdminSessionPayload | null> {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, sigHex] = parts;
  if (!encoded || !sigHex || !/^[0-9a-fA-F]{64}$/.test(sigHex)) {
    return null;
  }

  try {
    const encoder = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(getSessionHmacSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = new Uint8Array(
      sigHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

    const isValid = await crypto.subtle.verify(
      'HMAC',
      secretKey,
      sigBytes,
      encoder.encode(encoded)
    );

    if (!isValid) return null;

    // Decodificación base64url compatible con Edge
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = atob(base64);
    const payload = JSON.parse(jsonStr) as AdminSessionPayload;

    if (!payload || !payload.userId || payload.role !== 'SUPERADMIN') {
      return null;
    }

    const nowSec = Math.floor(nowMs / 1000);
    if (payload.expiresAt <= nowSec) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
