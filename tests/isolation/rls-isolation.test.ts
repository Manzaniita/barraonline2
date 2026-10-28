import { beforeAll, describe, expect, it } from 'vitest';
import {
  withAnonymousRlsContext,
  withSuperadminContext,
  withTenantContext,
} from '@/db';
import {
  consumeCrossSubdomainAuthTicket,
  issueCrossSubdomainAuthTicket,
} from '@/modules/identity/rbac-service';
import { encryptTenantSecret } from '@/modules/security/crypto-vault';

const MUSEUM_ID = 'aaaa1111-1111-4111-8111-111111111111';
const PUEBLO_ID = 'bbbb2222-2222-4222-8222-222222222222';
const CATEGORY_MUSEUM_ID = 'cccc1111-1111-4111-8111-111111111111';
const CATEGORY_PUEBLO_ID = 'cccc2222-2222-4222-8222-222222222222';
const PRODUCT_MUSEUM_ID = 'dddd1111-1111-4111-8111-111111111111';
const PRODUCT_PUEBLO_ID = 'dddd2222-2222-4222-8222-222222222222';
const USER_OWNER_MUSEUM = 'eeee1111-1111-4111-8111-111111111111';

describe('PostgreSQL 16 Row Level Security (RLS) — Aislamiento Estricto Multi-Tenant', () => {
  beforeAll(async () => {
    await withSuperadminContext(async (tx) => {
      await tx.query(
        `INSERT INTO tenants (id, slug, legal_name, fantasy_name, cuit, status)
         VALUES
           ($1, 'museum-test', 'Museum SA', 'Museum Club', '30-71111111-9', 'ACTIVE'),
           ($2, 'pueblo-test', 'Pueblo Limite SRL', 'Pueblo Límite', '30-72222222-9', 'ACTIVE')
         ON CONFLICT (id) DO NOTHING`,
        [MUSEUM_ID, PUEBLO_ID]
      );

      await tx.query(
        `INSERT INTO users (id, email, full_name, is_superadmin)
         VALUES ($1, 'owner@museum.com.ar', 'Dueño Museum', false)
         ON CONFLICT (id) DO NOTHING`,
        [USER_OWNER_MUSEUM]
      );
    });

    // Cargamos catálogo y credenciales OAuth de Mercado Pago en Museum
    await withTenantContext(MUSEUM_ID, async (tx) => {
      await tx.query(
        `INSERT INTO categories (id, tenant_id, name, sort_order)
         VALUES ($1, $2, 'Tragos Clásicos Museum', 1)
         ON CONFLICT (id) DO NOTHING`,
        [CATEGORY_MUSEUM_ID, MUSEUM_ID]
      );

      await tx.query(
        `INSERT INTO products (id, tenant_id, category_id, name, price_cents, stock_total)
         VALUES ($1, $2, $3, 'Fernet Branca + Coca 750ml', 1400000, 100)
         ON CONFLICT (id) DO NOTHING`,
        [PRODUCT_MUSEUM_ID, MUSEUM_ID, CATEGORY_MUSEUM_ID]
      );

      const encAccess = encryptTenantSecret(MUSEUM_ID, 'APP_USR-MUSEUM-SECRET');
      const encRefresh = encryptTenantSecret(MUSEUM_ID, 'TG-MUSEUM-REFRESH');
      await tx.query(
        `INSERT INTO tenant_mp_credentials (
           tenant_id, mp_user_id, mp_public_key,
           access_token_ciphertext, access_token_iv, access_token_tag,
           refresh_token_ciphertext, refresh_token_iv, refresh_token_tag,
           token_expires_at
         ) VALUES ($1, 100001, 'APP_USR-PUB-MUSEUM', $2, $3, $4, $5, $6, $7, now() + interval '180 days')
         ON CONFLICT (tenant_id) DO NOTHING`,
        [
          MUSEUM_ID,
          encAccess.ciphertext,
          encAccess.iv,
          encAccess.authTag,
          encRefresh.ciphertext,
          encRefresh.iv,
          encRefresh.authTag,
        ]
      );
    });

    // Cargamos catálogo y credenciales OAuth de Mercado Pago en Pueblo Límite
    await withTenantContext(PUEBLO_ID, async (tx) => {
      await tx.query(
        `INSERT INTO categories (id, tenant_id, name, sort_order)
         VALUES ($1, $2, 'Botellas VIP Pueblo', 1)
         ON CONFLICT (id) DO NOTHING`,
        [CATEGORY_PUEBLO_ID, PUEBLO_ID]
      );

      await tx.query(
        `INSERT INTO products (id, tenant_id, category_id, name, price_cents, stock_total)
         VALUES ($1, $2, $3, 'Combo Absolut + 4 Speed', 8500000, 25)
         ON CONFLICT (id) DO NOTHING`,
        [PRODUCT_PUEBLO_ID, PUEBLO_ID, CATEGORY_PUEBLO_ID]
      );

      const encAccess = encryptTenantSecret(PUEBLO_ID, 'APP_USR-PUEBLO-SECRET');
      const encRefresh = encryptTenantSecret(PUEBLO_ID, 'TG-PUEBLO-REFRESH');
      await tx.query(
        `INSERT INTO tenant_mp_credentials (
           tenant_id, mp_user_id, mp_public_key,
           access_token_ciphertext, access_token_iv, access_token_tag,
           refresh_token_ciphertext, refresh_token_iv, refresh_token_tag,
           token_expires_at
         ) VALUES ($1, 200002, 'APP_USR-PUB-PUEBLO', $2, $3, $4, $5, $6, $7, now() + interval '180 days')
         ON CONFLICT (tenant_id) DO NOTHING`,
        [
          PUEBLO_ID,
          encAccess.ciphertext,
          encAccess.iv,
          encAccess.authTag,
          encRefresh.ciphertext,
          encRefresh.iv,
          encRefresh.authTag,
        ]
      );
    });
  });

  it('garantiza que un SELECT sin WHERE desde Museum jamás vea productos ni tokens MP de Pueblo Límite', async () => {
    await withTenantContext(MUSEUM_ID, async (tx) => {
      const products = await tx.query<{ id: string; tenant_id: string; name: string }>(
        `SELECT id, tenant_id, name FROM products`
      );
      expect(products.rows.length).toBeGreaterThanOrEqual(1);
      expect(products.rows.every((p) => p.tenant_id === MUSEUM_ID)).toBe(true);
      expect(products.rows.some((p) => p.id === PRODUCT_PUEBLO_ID)).toBe(false);

      // Intento de consulta directa por ID exacto del otro boliche (ataque IDOR)
      const idorAttempt = await tx.query(
        `SELECT * FROM products WHERE id = $1`,
        [PRODUCT_PUEBLO_ID]
      );
      expect(idorAttempt.rows.length).toBe(0);

      // Intento de leer las credenciales de Mercado Pago de todos los boliches
      const mpCreds = await tx.query<{ tenant_id: string }>(
        `SELECT tenant_id FROM tenant_mp_credentials`
      );
      expect(mpCreds.rows).toEqual([{ tenant_id: MUSEUM_ID }]);
    });
  });

  it('impide que un boliche modifique o elimine registros de otro boliche aún conociendo su UUID', async () => {
    await withTenantContext(MUSEUM_ID, async (tx) => {
      const updateAttempt = await tx.query(
        `UPDATE products SET price_cents = 100 WHERE id = $1 RETURNING id`,
        [PRODUCT_PUEBLO_ID]
      );
      expect(updateAttempt.rowCount).toBe(0);

      const deleteAttempt = await tx.query(
        `DELETE FROM products WHERE id = $1 RETURNING id`,
        [PRODUCT_PUEBLO_ID]
      );
      expect(deleteAttempt.rowCount).toBe(0);
    });

    // Verificamos en Pueblo Límite que su precio sigue intacto ($85.000,00 = 8500000 centavos)
    await withTenantContext(PUEBLO_ID, async (tx) => {
      const check = await tx.query<{ price_cents: string }>(
        `SELECT price_cents FROM products WHERE id = $1`,
        [PRODUCT_PUEBLO_ID]
      );
      expect(Number(check.rows[0]?.price_cents)).toBe(8500000);
    });
  });

  it('bloquea con error de política RLS (WITH CHECK) si una sesión de Museum intenta insertar datos con tenant_id de Pueblo Límite', async () => {
    await expect(
      withTenantContext(MUSEUM_ID, async (tx) => {
        await tx.query(
          `INSERT INTO categories (tenant_id, name, sort_order)
           VALUES ($1, 'Categoría Inyectada Maliciosamente', 99)`,
          [PUEBLO_ID]
        );
      })
    ).rejects.toThrow(/row-level security policy/i);
  });

  it('devuelve 0 filas en tablas de negocio cuando se consulta sin contexto de tenant activo', async () => {
    await withAnonymousRlsContext(async (tx) => {
      const products = await tx.query(`SELECT * FROM products`);
      const creds = await tx.query(`SELECT * FROM tenant_mp_credentials`);
      expect(products.rows.length).toBe(0);
      expect(creds.rows.length).toBe(0);
    });
  });

  it('protege el intercambio de sesión cross-subdomain contra uso en otro subdominio y contra repetición (Replay)', async () => {
    const { rawTicket } = await issueCrossSubdomainAuthTicket({
      userId: USER_OWNER_MUSEUM,
      targetTenantId: MUSEUM_ID,
    });

    // 1. Intento de canjear el ticket de Museum en el subdominio de Pueblo Límite -> Falla
    await expect(
      consumeCrossSubdomainAuthTicket({
        rawTicket,
        expectedTenantId: PUEBLO_ID,
      })
    ).rejects.toThrow(/inválido, expirado o ya utilizado/i);

    // 2. Canje legítimo en el subdominio de Museum -> Éxito
    const consumed = await consumeCrossSubdomainAuthTicket({
      rawTicket,
      expectedTenantId: MUSEUM_ID,
    });
    expect(consumed.userId).toBe(USER_OWNER_MUSEUM);
    expect(consumed.targetTenantId).toBe(MUSEUM_ID);

    // 3. Intento de reusar el mismo ticket 1 milisegundo después (Replay Attack) -> Falla
    await expect(
      consumeCrossSubdomainAuthTicket({
        rawTicket,
        expectedTenantId: MUSEUM_ID,
      })
    ).rejects.toThrow(/inválido, expirado o ya utilizado/i);
  });
});
