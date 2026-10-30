import { NextResponse } from 'next/server';
import { ensureDemoDataSeeded } from '@/db/seed';
import { getPublicCatalogForTenant } from '@/modules/catalog/catalog-service';
import { getTenantBySlug } from '@/modules/tenancy/tenant-service';

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  await ensureDemoDataSeeded();
  const { slug } = await context.params;
  const tenant = await getTenantBySlug(slug);

  if (!tenant) {
    return NextResponse.json(
      { error: 'TENANT_NOT_FOUND', message: 'Establecimiento no encontrado.' },
      { status: 404 }
    );
  }

  const catalog = await getPublicCatalogForTenant(tenant.id);

  // El frontend público del cliente solo recibe los datos necesarios para consultar la carta y comprar
  return NextResponse.json(
    {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        fantasy_name: tenant.fantasy_name,
        city: tenant.city,
        address: tenant.address,
        status: tenant.status,
        reservation_ttl_seconds: tenant.reservation_ttl_seconds,
        theme_config: tenant.theme_config,
      },
      categories: catalog.categories,
      products: catalog.products,
    },
    {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Cache-Tag': `catalog-${tenant.id}`,
      },
    }
  );
}
