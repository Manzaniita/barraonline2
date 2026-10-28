const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'superadmin',
  'admin',
  'auth',
  'cdn',
  'assets',
  'mail',
  'webhooks',
]);

/**
 * Extrae y valida el subdominio del boliche desde el header Host confiable.
 * Libre de dependencias Node/DB para ejecutarse en Edge Middleware (< 0.1 ms).
 */
export function resolveTenantSlugFromHost(
  hostHeader: string | null | undefined
): string | null {
  if (!hostHeader) return null;
  const cleanHost = (hostHeader.split(':')[0] ?? '').trim().toLowerCase();
  if (!cleanHost) return null;

  const rootDomain = (
    process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'barraonline.com.ar'
  ).toLowerCase();

  let candidate: string | null = null;
  if (cleanHost.endsWith(`.${rootDomain}`)) {
    candidate = cleanHost.slice(0, -(rootDomain.length + 1));
  } else if (cleanHost.endsWith('.localhost')) {
    candidate = cleanHost.slice(0, -'.localhost'.length);
  }

  if (!candidate || candidate.includes('.')) return null;
  if (RESERVED_SUBDOMAINS.has(candidate)) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(candidate)) return null;

  return candidate;
}
