import { withTenantContext } from '@/db';
import { assertRolePermission, type TenantRole } from '@/modules/identity/rbac-service';

export interface CategoryRecord {
  id: string;
  tenant_id: string;
  name: string;
  badge_text: string | null;
  sort_order: number;
  is_visible: boolean;
}

export interface ProductCatalogItem {
  id: string;
  tenant_id: string;
  category_id: string;
  category_name: string;
  name: string;
  description: string;
  image_url: string | null;
  is_alcoholic: boolean;
  price_cents: number;
  promo_price_cents: number | null;
  effective_price_cents: number;
  promo_label: string | null;
  stock_total: number;
  stock_reserved: number;
  stock_sold: number;
  available_stock: number;
  in_stock: boolean;
  max_per_order: number;
  is_active: boolean;
  sort_order: number;
}

export async function getPublicCatalogForTenant(tenantId: string): Promise<{
  categories: CategoryRecord[];
  products: ProductCatalogItem[];
}> {
  return withTenantContext(tenantId, async (tx) => {
    const catRes = await tx.query<CategoryRecord>(
      `SELECT id, tenant_id, name, badge_text, sort_order, is_visible
       FROM categories
       WHERE is_visible = true
       ORDER BY sort_order ASC, name ASC`
    );

    const prodRes = await tx.query<{
      id: string;
      tenant_id: string;
      category_id: string;
      category_name: string;
      name: string;
      description: string;
      image_url: string | null;
      is_alcoholic: boolean;
      price_cents: string;
      promo_price_cents: string | null;
      promo_label: string | null;
      stock_total: number;
      stock_reserved: number;
      stock_sold: number;
      max_per_order: number;
      is_active: boolean;
      sort_order: number;
    }>(
      `SELECT p.id, p.tenant_id, p.category_id, c.name AS category_name,
              p.name, p.description, p.image_url, p.is_alcoholic,
              p.price_cents, p.promo_price_cents, p.promo_label,
              p.stock_total, p.stock_reserved, p.stock_sold,
              p.max_per_order, p.is_active, p.sort_order
       FROM products p
       INNER JOIN categories c ON c.tenant_id = p.tenant_id AND c.id = p.category_id
       WHERE p.is_active = true AND c.is_visible = true
       ORDER BY c.sort_order ASC, p.sort_order ASC, p.name ASC`
    );

    const products: ProductCatalogItem[] = prodRes.rows.map((row) => {
      const priceCents = Number(row.price_cents);
      const promoPriceCents =
        row.promo_price_cents !== null ? Number(row.promo_price_cents) : null;
      const availableStock = Math.max(
        0,
        Number(row.stock_total) - Number(row.stock_reserved) - Number(row.stock_sold)
      );
      return {
        id: row.id,
        tenant_id: row.tenant_id,
        category_id: row.category_id,
        category_name: row.category_name,
        name: row.name,
        description: row.description,
        image_url: row.image_url,
        is_alcoholic: row.is_alcoholic,
        price_cents: priceCents,
        promo_price_cents: promoPriceCents,
        effective_price_cents: promoPriceCents ?? priceCents,
        promo_label: row.promo_label,
        stock_total: Number(row.stock_total),
        stock_reserved: Number(row.stock_reserved),
        stock_sold: Number(row.stock_sold),
        available_stock: availableStock,
        in_stock: availableStock > 0,
        max_per_order: Number(row.max_per_order),
        is_active: row.is_active,
        sort_order: Number(row.sort_order),
      };
    });

    return {
      categories: catRes.rows,
      products,
    };
  });
}

export async function updateProductStockOrPrice(params: {
  tenantId: string;
  actorRole: TenantRole;
  actorUserId?: string;
  productId: string;
  priceCents?: number;
  promoPriceCents?: number | null;
  stockTotal?: number;
  isActive?: boolean;
}): Promise<void> {
  if (params.priceCents !== undefined || params.promoPriceCents !== undefined) {
    assertRolePermission(params.actorRole, 'catalog:write');
  }
  if (params.stockTotal !== undefined) {
    assertRolePermission(params.actorRole, 'stock:write');
  }

  await withTenantContext(params.tenantId, async (tx) => {
    const existingRes = await tx.query<{
      id: string;
      price_cents: string;
      promo_price_cents: string | null;
      stock_total: number;
      stock_reserved: number;
      stock_sold: number;
      is_active: boolean;
    }>(
      `SELECT id, price_cents, promo_price_cents, stock_total, stock_reserved, stock_sold, is_active
       FROM products
       WHERE id = $1
       FOR UPDATE`,
      [params.productId]
    );

    const current = existingRes.rows[0];
    if (!current) {
      throw new Error('Producto no encontrado en el catálogo de este boliche.');
    }

    const newPriceCents = params.priceCents ?? Number(current.price_cents);
    const newPromoCents =
      params.promoPriceCents !== undefined
        ? params.promoPriceCents
        : current.promo_price_cents !== null
          ? Number(current.promo_price_cents)
          : null;
    const newStockTotal = params.stockTotal ?? Number(current.stock_total);
    const newIsActive = params.isActive ?? current.is_active;

    const minRequiredStock = Number(current.stock_reserved) + Number(current.stock_sold);
    if (newStockTotal < minRequiredStock) {
      throw new Error(
        `No se puede fijar un stock total (${newStockTotal}) menor a la suma ya vendida + reservada (${minRequiredStock}).`
      );
    }

    await tx.query(
      `UPDATE products
       SET price_cents = $2,
           promo_price_cents = $3,
           stock_total = $4,
           is_active = $5,
           version = version + 1,
           updated_at = now()
       WHERE id = $1`,
      [params.productId, newPriceCents, newPromoCents, newStockTotal, newIsActive]
    );

    await tx.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, actor_role, action, entity_type, entity_id, before_state, after_state)
       VALUES ($1, $2, $3, 'PRODUCT_UPDATED', 'product', $4, $5::jsonb, $6::jsonb)`,
      [
        params.tenantId,
        params.actorUserId ?? null,
        params.actorRole,
        params.productId,
        JSON.stringify(current),
        JSON.stringify({
          price_cents: newPriceCents,
          promo_price_cents: newPromoCents,
          stock_total: newStockTotal,
          is_active: newIsActive,
        }),
      ]
    );
  });
}
