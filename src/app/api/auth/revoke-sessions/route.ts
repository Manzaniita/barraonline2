import { NextResponse, type NextRequest } from 'next/server';
import { ensureDemoDataSeeded } from '@/db/seed';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  revokeAllOtherAdminSessions,
  verifySuperadminSessionServerSide,
} from '@/modules/identity/admin-auth-service';

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
    const { user, newToken } = await revokeAllOtherAdminSessions(adminUser.id);

    const response = NextResponse.json({
      success: true,
      message: 'Todas las demás sesiones activas han sido invalidadas.',
      user: {
        id: user.id,
        email: user.email,
        sessionVersion: user.sessionVersion,
      },
    });

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
      error instanceof Error ? error.message : 'Error al revocar sesiones.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
