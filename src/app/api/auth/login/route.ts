import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ensureDemoDataSeeded } from '@/db/seed';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  loginUnified,
} from '@/modules/identity/admin-auth-service';
import {
  createSignedCustomerSessionToken,
  CUSTOMER_SESSION_COOKIE,
} from '@/modules/identity/customer-auth-service';

const LoginSchema = z.object({
  email: z.string().trim().email('Ingresá un correo electrónico válido.'),
  password: z.string().min(1, 'Ingresá tu contraseña.'),
  tenantSlug: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  await ensureDemoDataSeeded();

  try {
    const rawBody = await request.json().catch(() => ({}));
    const body = LoginSchema.parse(rawBody);

    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const { user, redirectUrl, token } = await loginUnified({
      email: body.email,
      password: body.password,
      clientIp,
      currentTenantSlug: body.tenantSlug,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        tenantSlug: user.tenantSlug ?? null,
        tenantFantasyName: user.tenantFantasyName ?? null,
      },
      redirectUrl,
    });

    // Sesión unificada en cookie HttpOnly segura
    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    });

    // Si es un cliente regular, emitimos también el customer token para compatibilidad total con pedidos
    if (user.role === 'CLIENTE') {
      const customerTok = createSignedCustomerSessionToken({
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        provider: 'EXPRESS_SESSION',
      });
      response.cookies.set(CUSTOMER_SESSION_COOKIE, customerTok, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
    const isRateLimit = message.includes('Demasiados intentos fallidos');
    return NextResponse.json(
      { error: message },
      { status: isRateLimit ? 429 : 401 }
    );
  }
}
