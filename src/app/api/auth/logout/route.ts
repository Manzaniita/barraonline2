import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '@/modules/identity/admin-auth-service';
import { CUSTOMER_SESSION_COOKIE } from '@/modules/identity/customer-auth-service';

export async function POST(request: NextRequest) {
  let targetRedirect = '/';

  try {
    const body = (await request.json().catch(() => ({}))) as {
      redirectTo?: string;
    };

    if (body.redirectTo && typeof body.redirectTo === 'string') {
      const sanitized = body.redirectTo.trim();
      // Prevención estricta de Open Redirects:
      // Debe comenzar con / pero no con // ni contener protocolos externos
      if (
        sanitized.startsWith('/') &&
        !sanitized.startsWith('//') &&
        !sanitized.includes('://')
      ) {
        targetRedirect = sanitized;
      }
    }
  } catch {
    targetRedirect = '/';
  }

  const response = NextResponse.json({
    success: true,
    redirectTo: targetRedirect,
  });

  // Limpieza estricta de cookies de sesión
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  response.cookies.delete(CUSTOMER_SESSION_COOKIE);

  // Aseguramos invalidación con maxAge 0 explícito
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  response.cookies.set(CUSTOMER_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
