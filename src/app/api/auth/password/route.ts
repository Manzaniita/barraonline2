import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ensureDemoDataSeeded } from '@/db/seed';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  changeSuperadminPassword,
  verifySuperadminSessionServerSide,
} from '@/modules/identity/admin-auth-service';

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresá tu contraseña actual.'),
  newPassword: z.string().min(10, 'La nueva contraseña debe tener al menos 10 caracteres.'),
  confirmNewPassword: z.string().min(10, 'Confirmá tu nueva contraseña.'),
});

export async function POST(request: NextRequest) {
  await ensureDemoDataSeeded();

  const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const adminUser = await verifySuperadminSessionServerSide(adminToken);

  if (!adminUser || !adminUser.isSuperadmin) {
    return NextResponse.json(
      { error: 'No autorizado. Iniciá sesión como superadministrador.' },
      { status: 401 }
    );
  }

  try {
    const body = ChangePasswordSchema.parse(await request.json());

    const { user, newToken } = await changeSuperadminPassword({
      userId: adminUser.id,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      confirmNewPassword: body.confirmNewPassword,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Contraseña actualizada exitosamente. Se invalidaron las sesiones anteriores.',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
    });

    // Actualizamos la cookie con el nuevo token rotado para continuar la sesión actual sin interrupciones
    response.cookies.set(ADMIN_SESSION_COOKIE, newToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
