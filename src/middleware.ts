import { NextResponse, type NextRequest } from 'next/server';
import { resolveTenantSlugFromHost } from '@/modules/tenancy/host-resolver';
import {
  ADMIN_SESSION_COOKIE,
  verifySignedAdminSessionTokenEdge,
} from '@/modules/identity/admin-session-edge';

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  const slug = resolveTenantSlugFromHost(host);
  const { pathname } = request.nextUrl;

  // Redirección de compatibilidad desde ruta previa /superadmin hacia /admin
  if (pathname === '/superadmin' || pathname.startsWith('/superadmin/')) {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = pathname.replace(/^\/superadmin/, '/admin');
    return NextResponse.redirect(targetUrl);
  }

  // Protección perimetral de rutas administrativas /admin/*
  if (pathname === '/admin' || (pathname.startsWith('/admin/') && pathname !== '/admin/login')) {
    const adminSessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const sessionPayload = await verifySignedAdminSessionTokenEdge(adminSessionCookie);

    // Criterio de aceptación #3:
    // "Si alguien intenta ingresar a /admin sin sesión válida, redirigir automáticamente a la landing pública de BarraOnline."
    if (!sessionPayload || sessionPayload.role !== 'SUPERADMIN') {
      const publicLandingUrl = new URL('/', request.url);
      return NextResponse.redirect(publicLandingUrl);
    }
  }

  // Si el superadministrador ya está autenticado e intenta ir a /admin/login, lo enviamos directo al panel
  if (pathname === '/admin/login') {
    const adminSessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const sessionPayload = await verifySignedAdminSessionTokenEdge(adminSessionCookie);
    if (sessionPayload && sessionPayload.role === 'SUPERADMIN') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // Si la petición entra por subdominio de boliche (ej. museum.barraonline.com.ar o museum.localhost:3000)
  // y no es un recurso interno de Next ni una ruta ya reescrita a /b/[slug], reescribimos de forma transparente.
  if (
    slug &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/b/') &&
    !pathname.includes('.')
  ) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/b/${slug}${pathname === '/' ? '' : pathname}`;
    const response = NextResponse.rewrite(rewriteUrl);
    response.headers.set('x-barraonline-tenant-slug', slug);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
