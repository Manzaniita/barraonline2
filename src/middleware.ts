import { NextResponse, type NextRequest } from 'next/server';
import { resolveTenantSlugFromHost } from '@/modules/tenancy/host-resolver';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  const slug = resolveTenantSlugFromHost(host);
  const { pathname } = request.nextUrl;

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
