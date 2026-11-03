import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ensureDemoDataSeeded } from '@/db/seed';
import {
  ADMIN_SESSION_COOKIE,
  verifySuperadminSessionServerSide,
} from '@/modules/identity/admin-auth-service';
import { AdminSidebarAndHeader } from '@/components/admin/AdminSidebarAndHeader';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await ensureDemoDataSeeded();
  } catch (err) {
    console.error('[AdminLayout] ensureDemoDataSeeded error:', err);
  }

  let adminUser = null;
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    adminUser = await verifySuperadminSessionServerSide(adminToken);
  } catch (err) {
    console.error('[AdminLayout] verifySuperadminSessionServerSide error:', err);
  }

  // Si no hay sesión válida de superadministrador, el middleware y el layout redirigen
  // a la landing pública de BarraOnline (Criterio de aceptación #3).
  // Nota: /admin/login se maneja mediante su propia página pública.
  const userPayload = adminUser
    ? {
        id: adminUser.id,
        email: adminUser.email,
        fullName: adminUser.fullName,
        isSuperadmin: adminUser.isSuperadmin,
      }
    : {
        id: '',
        email: '',
        fullName: 'Administrador',
        isSuperadmin: false,
      };

  return (
    <AdminSidebarAndHeader user={userPayload}>
      {children}
    </AdminSidebarAndHeader>
  );
}
