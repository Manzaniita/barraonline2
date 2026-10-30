import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ensureDemoDataSeeded } from '@/db/seed';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  loginSuperadmin,
} from '@/modules/identity/admin-auth-service';

const LoginSchema = z.object({
  email: z.string().email('Ingresá un correo electrónico válido.'),
  password: z.string().min(1, 'Ingresá tu contraseña.'),
});

export async function POST(request: NextRequest) {
  await ensureDemoDataSeeded();

  try {
    const body = LoginSchema.parse(await request.json());
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const { user, token } = await loginSuperadmin({
      email: body.email,
      password: body.password,
      clientIp,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: 'SUPERADMIN',
      },
    });

    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    });

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
