import { withSuperadminContext, withTenantContext } from '@/db';
import {
  configureTenantCommissionRule,
  configureTenantMonthlyPlan,
  generateWeeklySettlementForTenant,
} from '@/modules/billing-settlements/settlement-service';
import { assignBartenderShiftPin } from '@/modules/identity/rbac-service';
import { createCheckoutAndReserveStock } from '@/modules/inventory/checkout-and-stock-service';
import {
  confirmOrderPaymentAndIssueQr,
  saveTenantMercadoPagoOAuthCredentials,
} from '@/modules/payments/mercadopago-service';
import { sanitizeAndValidateThemeConfig } from '@/modules/tenancy/tenant-service';
import {
  ensureSuperadminAccountInitialized,
  hashPassword,
} from '@/modules/identity/admin-auth-service';

export const SEED_IDS = {
  SUPERADMIN_USER: '00000000-0000-4000-8000-000000000001',
  MUSEUM_TENANT: '11111111-1111-4111-8111-111111111111',
  PUEBLO_TENANT: '22222222-2222-4222-8222-222222222222',
  MUSEUM_OWNER: '11111111-9999-4111-8111-111111111111',
  MUSEUM_BARTENDER: '11111111-aaaa-4111-8111-111111111111',
  MUSEUM_MANAGER: '11111111-bbbb-4111-8111-111111111111',
  MUSEUM_STATION_MAIN: '11111111-cccc-4111-8111-111111111111',
  MUSEUM_STATION_VIP: '11111111-dddd-4111-8111-111111111111',
  PUEBLO_BARTENDER: '22222222-aaaa-4222-8222-222222222222',
  PUEBLO_STATION_MAIN: '22222222-cccc-4222-8222-222222222222',
  MUSEUM_OWNER_USER: '11111111-0000-4111-8111-111111111001',
  MUSEUM_MANAGER_USER: '11111111-0000-4111-8111-111111111002',
  MUSEUM_BARTENDER_USER: '11111111-0000-4111-8111-111111111003',
  DEMO_CUSTOMER_USER: '33333333-0000-4333-8333-333333333001',
};

const globalForSeed = globalThis as unknown as {
  __boSeededPromise?: Promise<void>;
};

export async function ensureDemoDataSeeded(): Promise<void> {
  if (!globalForSeed.__boSeededPromise) {
    globalForSeed.__boSeededPromise = (async () => {
      await runDemoSeed();
      await ensureSuperadminAccountInitialized();
    })().catch((err) => {
      globalForSeed.__boSeededPromise = undefined;
      throw err;
    });
  }
  return globalForSeed.__boSeededPromise;
}

async function runDemoSeed(): Promise<void> {
  const alreadyExists = await withSuperadminContext(async (tx) => {
    const check = await tx.query<{ id: string }>(
      `SELECT id FROM tenants WHERE slug = 'museum' LIMIT 1`
    );
    return check.rows.length > 0;
  });

  if (alreadyExists) return;

  const museumTheme = sanitizeAndValidateThemeConfig({
    accentPrimary: '#FF2E63',
    accentSecondary: '#00F0FF',
    tagline: 'Main Stage & Terraza Frente al Mar — Retirá sin fila con QR Único',
    heroBadge: 'TEMPORADA COSTA ARGENTINA',
    logoText: 'MUSEUM CLUB',
  });

  const puebloTheme = sanitizeAndValidateThemeConfig({
    accentPrimary: '#00F5D4',
    accentSecondary: '#A855F7',
    tagline: 'Complejo Megadisco Villa Gesell — 4 Pistas, 8 Barras Rápidas',
    heroBadge: 'ACCESO EXPRÉS BARRA',
    logoText: 'PUEBLO LÍMITE',
  });

  const superadminHash = await hashPassword('TuClaveAdminSegura2026!');
  const ownerHash = await hashPassword('MuseumDueno2026!');
  const managerHash = await hashPassword('GerenteMuseum2026!');
  const bartenderHash = await hashPassword('BarmanMuseum2026!');
  const customerHash = await hashPassword('ClienteDemo2026!');

  await withSuperadminContext(async (tx) => {
    await tx.query(
      `INSERT INTO users (id, google_sub, email, full_name, password_hash, is_superadmin)
       VALUES
         ($1, 'google-superadmin-001', 'superadmin@barraonline.com.ar', 'Dirección BarraOnline', $2, true)
       ON CONFLICT (id) DO UPDATE SET password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash)`,
      [SEED_IDS.SUPERADMIN_USER, superadminHash]
    );

    await tx.query(
      `INSERT INTO users (id, email, full_name, password_hash, is_superadmin, status)
       VALUES
         ($1, 'dueno.museum@barraonline.com.ar', 'Mateo Benítez (Dueño)', $5, false, 'ACTIVE'),
         ($2, 'sofia.alarcon@museum.com.ar', 'Sofía Alarcón (Encargada General)', $6, false, 'ACTIVE'),
         ($3, 'tomas.vega@museum.com.ar', 'Tomás Vega (Barman Pista Central)', $7, false, 'ACTIVE'),
         ($4, 'cliente.demo@gmail.com', 'Valentina Gómez (Cliente Demo)', $8, false, 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [
        SEED_IDS.MUSEUM_OWNER_USER,
        SEED_IDS.MUSEUM_MANAGER_USER,
        SEED_IDS.MUSEUM_BARTENDER_USER,
        SEED_IDS.DEMO_CUSTOMER_USER,
        ownerHash,
        managerHash,
        bartenderHash,
        customerHash,
      ]
    );

    await tx.query(
      `INSERT INTO tenants (
         id, slug, legal_name, fantasy_name, cuit, city, address,
         status, business_day_cutoff_hour, alcohol_cutoff_hour,
         reservation_ttl_seconds, allow_bartender_conflict_resolution, theme_config,
         is_published, is_featured, is_visible_on_landing, sort_order, commercial_tag
       ) VALUES
         ($1, 'museum', 'Complejo Nocturno Costanera S.A.', 'Museum Ocean Club', '30-71548921-9', 'Mar del Plata', 'Complejo Playa Grande Sector 4', 'ACTIVE', 10, 5, 420, true, $3::jsonb, true, true, true, 1, 'TEMPORADA 2026'),
         ($2, 'pueblo-limite', 'Entretenimientos Gesell S.R.L.', 'Pueblo Límite', '30-71892340-4', 'Villa Gesell', 'Av. Buenos Aires 2600', 'ACTIVE', 10, 5, 420, true, $4::jsonb, true, false, true, 2, 'VILLA GESELL')
       ON CONFLICT (id) DO NOTHING`,
      [
        SEED_IDS.MUSEUM_TENANT,
        SEED_IDS.PUEBLO_TENANT,
        JSON.stringify(museumTheme),
        JSON.stringify(puebloTheme),
      ]
    );
  });

  // Configuramos reglas comerciales iniciales (configurables desde Superadmin)
  await configureTenantCommissionRule({
    tenantId: SEED_IDS.MUSEUM_TENANT,
    commissionBps: 500, // 5.00%
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    notes: 'Acuerdo comercial lanzamiento temporada — 5,00% sobre ventas aprobadas',
    superadminUserId: SEED_IDS.SUPERADMIN_USER,
  });

  await configureTenantCommissionRule({
    tenantId: SEED_IDS.PUEBLO_TENANT,
    commissionBps: 600, // 6.00%
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    notes: 'Acuerdo comercial alto volumen — 6,00% sobre ventas aprobadas',
    superadminUserId: SEED_IDS.SUPERADMIN_USER,
  });

  const museumPlan = await configureTenantMonthlyPlan({
    tenantId: SEED_IDS.MUSEUM_TENANT,
    planName: 'Plan Club Pro Temporada',
    monthlyFeeCents: 35000000, // $350.000,00 ARS / mes
    billingDayOfMonth: 5,
    superadminUserId: SEED_IDS.SUPERADMIN_USER,
  });

  const puebloPlan = await configureTenantMonthlyPlan({
    tenantId: SEED_IDS.PUEBLO_TENANT,
    planName: 'Plan Megadisco Enterprise',
    monthlyFeeCents: 48000000, // $480.000,00 ARS / mes
    billingDayOfMonth: 5,
    superadminUserId: SEED_IDS.SUPERADMIN_USER,
  });

  // Emitimos facturas de abono mensual independientes de la comisión semanal
  await withSuperadminContext(async (tx) => {
    await tx.query(
      `INSERT INTO subscription_invoices (
         tenant_id, plan_id, billing_period, amount_cents, paid_amount_cents, status, due_date, paid_at, payment_reference
       ) VALUES
         ($1, $2, '2026-10', 35000000, 35000000, 'PAID', '2026-10-05', now() - interval '15 days', 'TRF-ABONO-MUSEUM-10'),
         ($3, $4, '2026-10', 48000000, 0, 'PENDING', '2026-11-05', NULL, NULL)
       ON CONFLICT (tenant_id, billing_period) DO NOTHING`,
      [
        SEED_IDS.MUSEUM_TENANT,
        museumPlan.planId,
        SEED_IDS.PUEBLO_TENANT,
        puebloPlan.planId,
      ]
    );
  });

  // Vinculamos cuentas de Mercado Pago aisladas y cifradas en AES-256-GCM por boliche
  await saveTenantMercadoPagoOAuthCredentials({
    tenantId: SEED_IDS.MUSEUM_TENANT,
    actorRole: 'OWNER',
    actorUserId: SEED_IDS.SUPERADMIN_USER,
    mpUserId: 148920311,
    mpPublicKey: 'APP_USR-museum-pk-live-8891',
    accessToken: 'APP_USR-148920311-102826-museum-direct-seller-token',
    refreshToken: 'TG-671f89a0c12-museum-refresh',
    expiresInSeconds: 15552000,
  });

  await saveTenantMercadoPagoOAuthCredentials({
    tenantId: SEED_IDS.PUEBLO_TENANT,
    actorRole: 'OWNER',
    actorUserId: SEED_IDS.SUPERADMIN_USER,
    mpUserId: 294810522,
    mpPublicKey: 'APP_USR-pueblo-pk-live-4412',
    accessToken: 'APP_USR-294810522-102826-pueblo-direct-seller-token',
    refreshToken: 'TG-992b10e4d88-pueblo-refresh',
    expiresInSeconds: 15552000,
  });

  // Catálogo, Staff y Terminales de Barra de MUSEUM OCEAN CLUB
  const museumCatTragos = '11111111-1000-4111-8111-111111111101';
  const museumCatBotellas = '11111111-1000-4111-8111-111111111102';
  const museumCatCervezas = '11111111-1000-4111-8111-111111111103';
  const museumCatSinAlcohol = '11111111-1000-4111-8111-111111111104';

  const museumProdFernet = '11111111-2000-4111-8111-111111111201';
  const museumProdGin = '11111111-2000-4111-8111-111111111202';
  const museumProdVodkaSpeed = '11111111-2000-4111-8111-111111111203';
  const museumProdComboAbsolut = '11111111-2000-4111-8111-111111111204';
  const museumProdComboBranca = '11111111-2000-4111-8111-111111111205';
  const museumProdCorona = '11111111-2000-4111-8111-111111111206';
  const museumProdAgua = '11111111-2000-4111-8111-111111111207';
  const museumProdSpeed = '11111111-2000-4111-8111-111111111208';

  await withTenantContext(SEED_IDS.MUSEUM_TENANT, async (tx) => {
    await tx.query(
      `INSERT INTO tenant_users (id, tenant_id, user_id, staff_display_name, role)
       VALUES
         ($1, $4, $5, 'Mateo Benítez (Dueño)', 'OWNER'),
         ($2, $4, $6, 'Sofía Alarcón (Encargada General)', 'MANAGER'),
         ($3, $4, $7, 'Tomás Vega (Barman Pista Central)', 'BARTENDER')
       ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, role = EXCLUDED.role`,
      [
        SEED_IDS.MUSEUM_OWNER,
        SEED_IDS.MUSEUM_MANAGER,
        SEED_IDS.MUSEUM_BARTENDER,
        SEED_IDS.MUSEUM_TENANT,
        SEED_IDS.MUSEUM_OWNER_USER,
        SEED_IDS.MUSEUM_MANAGER_USER,
        SEED_IDS.MUSEUM_BARTENDER_USER,
      ]
    );

    await tx.query(
      `INSERT INTO bar_stations (id, tenant_id, name, sector, device_token_hash, expires_at)
       VALUES
         ($1, $3, 'Barra Pista Central — Terminal 1', 'Pista Central', 'museum-station-1', now() + interval '60 days'),
         ($2, $3, 'Barra Terraza VIP — Terminal 2', 'Terraza Mar', 'museum-station-2', now() + interval '60 days')
       ON CONFLICT (id) DO NOTHING`,
      [SEED_IDS.MUSEUM_STATION_MAIN, SEED_IDS.MUSEUM_STATION_VIP, SEED_IDS.MUSEUM_TENANT]
    );

    await tx.query(
      `INSERT INTO categories (id, tenant_id, name, badge_text, sort_order)
       VALUES
         ($1, $5, 'Tragos & Medidas XL', 'MÁS PEDIDOS', 1),
         ($2, $5, 'Combos & Botellas VIP', 'AHORRÁ EN GRUPO', 2),
         ($3, $5, 'Cervezas Importadas', NULL, 3),
         ($4, $5, 'Sin Alcohol & Energizantes', 'HIDRATACIÓN', 4)
       ON CONFLICT (id) DO NOTHING`,
      [
        museumCatTragos,
        museumCatBotellas,
        museumCatCervezas,
        museumCatSinAlcohol,
        SEED_IDS.MUSEUM_TENANT,
      ]
    );

    await tx.query(
      `INSERT INTO products (
         id, tenant_id, category_id, name, description, is_alcoholic,
         price_cents, promo_price_cents, promo_label, stock_total, max_per_order, sort_order
       ) VALUES
         ($1, $9, $10, 'Fernet Branca + Coca-Cola XL (750ml)', 'Vaso rígido reusable 750ml con hielo rolito y proporción clásica 30/70.', true, 1400000, 1200000, 'PROMO NOCHE -14%', 280, 6, 1),
         ($2, $9, $10, 'Gin Tonic Beefeater Pink & Pomelo XL', 'Medida doble de Beefeater, tónica Schweppes bien fría y rodaja de pomelo rosado.', true, 1550000, NULL, NULL, 180, 6, 2),
         ($3, $9, $10, 'Skyy Vodka + Speed Unlimited XL', 'Doble medida de Vodka Skyy macerado en frío + lata entera de Speed.', true, 1450000, NULL, NULL, 220, 6, 3),
         ($4, $9, $11, 'Combo Botella Absolut 700ml + 4 Speed', 'Incluye frapera con hielo ilimitado y 4 latas de Speed Unlimited.', true, 9800000, 8500000, 'COMBO VIP', 45, 2, 1),
         ($5, $9, $11, 'Combo Fernet Branca 750ml + 2 Coca-Cola 1.5L', 'Botella cerrada de Branca 750ml + 2 botellas de línea Coca-Cola + frapera.', true, 7600000, NULL, NULL, 60, 2, 2),
         ($6, $9, $12, 'Corona Porrón 330ml Bien Helada', 'Servida a -2°C con gajo de lima.', true, 750000, NULL, NULL, 350, 10, 1),
         ($7, $9, $13, 'Agua Mineral Eco de los Andes 500ml', 'Agua sin gas bien fría para hidratarse toda la noche.', false, 420000, NULL, NULL, 500, 10, 1),
         ($8, $9, $13, 'Lata Speed Unlimited 250ml', 'Energizante bien frío listo para tomar o mezclar.', false, 520000, NULL, NULL, 400, 10, 2)
       ON CONFLICT (id) DO NOTHING`,
      [
        museumProdFernet,
        museumProdGin,
        museumProdVodkaSpeed,
        museumProdComboAbsolut,
        museumProdComboBranca,
        museumProdCorona,
        museumProdAgua,
        museumProdSpeed,
        SEED_IDS.MUSEUM_TENANT,
        museumCatTragos,
        museumCatBotellas,
        museumCatCervezas,
        museumCatSinAlcohol,
      ]
    );
  });

  await assignBartenderShiftPin({
    tenantId: SEED_IDS.MUSEUM_TENANT,
    actorRole: 'MANAGER',
    tenantUserId: SEED_IDS.MUSEUM_BARTENDER,
    pin: '482910',
    shiftDurationHours: 48,
  });

  // Catálogo, Staff y Terminales de Barra de PUEBLO LÍMITE
  const puebloCatCombos = '22222222-1000-4222-8222-222222222101';
  const puebloCatTragos = '22222222-1000-4222-8222-222222222102';
  const puebloProdSmirnoff = '22222222-2000-4222-8222-222222222201';
  const puebloProdFernet = '22222222-2000-4222-8222-222222222202';
  const puebloProdAgua = '22222222-2000-4222-8222-222222222203';

  await withTenantContext(SEED_IDS.PUEBLO_TENANT, async (tx) => {
    await tx.query(
      `INSERT INTO tenant_users (id, tenant_id, staff_display_name, role)
       VALUES ($1, $2, 'Nicolás Duarte (Barman Main Stage)', 'BARTENDER')
       ON CONFLICT (id) DO NOTHING`,
      [SEED_IDS.PUEBLO_BARTENDER, SEED_IDS.PUEBLO_TENANT]
    );

    await tx.query(
      `INSERT INTO bar_stations (id, tenant_id, name, sector, device_token_hash, expires_at)
       VALUES ($1, $2, 'Barra Domo Electrónico — Terminal 1', 'Domo Electrónico', 'pueblo-station-1', now() + interval '60 days')
       ON CONFLICT (id) DO NOTHING`,
      [SEED_IDS.PUEBLO_STATION_MAIN, SEED_IDS.PUEBLO_TENANT]
    );

    await tx.query(
      `INSERT INTO categories (id, tenant_id, name, badge_text, sort_order)
       VALUES
         ($1, $3, 'Combos Botella Pista', 'EXCLUSIVO APP', 1),
         ($2, $3, 'Tragos & Hidratación', NULL, 2)
       ON CONFLICT (id) DO NOTHING`,
      [puebloCatCombos, puebloCatTragos, SEED_IDS.PUEBLO_TENANT]
    );

    await tx.query(
      `INSERT INTO products (
         id, tenant_id, category_id, name, description, is_alcoholic,
         price_cents, promo_price_cents, promo_label, stock_total, max_per_order, sort_order
       ) VALUES
         ($1, $4, $5, 'Combo Smirnoff Red + 4 Speed', 'Botella 700ml + 4 energizantes Speed + hielo.', true, 7800000, 6900000, 'HAPPY HOUR QR', 60, 3, 1),
         ($2, $4, $6, 'Fernet Branca XL + Coca-Cola', 'Vaso de litro reutilizable Pueblo Límite.', true, 1300000, NULL, NULL, 400, 6, 1),
         ($3, $4, $6, 'Agua Villavicencio 500ml', 'Botella cerrada bien fría.', false, 400000, NULL, NULL, 600, 10, 2)
       ON CONFLICT (id) DO NOTHING`,
      [
        puebloProdSmirnoff,
        puebloProdFernet,
        puebloProdAgua,
        SEED_IDS.PUEBLO_TENANT,
        puebloCatCombos,
        puebloCatTragos,
      ]
    );
  });

  // Creamos 2 pedidos reales de demostración en Museum y generamos una liquidación semanal para visualizar en los paneles
  const demoOrder1 = await createCheckoutAndReserveStock({
    tenantId: SEED_IDS.MUSEUM_TENANT,
    idempotencyKey: 'seed-museum-order-1',
    customerDisplayName: 'Valentina Gómez',
    guestRecoveryContact: 'valentina@ejemplo.com.ar',
    items: [
      { productId: museumProdFernet, quantity: 2 },
      { productId: museumProdAgua, quantity: 1 },
    ],
  });

  await confirmOrderPaymentAndIssueQr({
    tenantId: SEED_IDS.MUSEUM_TENANT,
    orderId: demoOrder1.orderId,
    mpPaymentId: 9900112233,
    grossAmountCents: demoOrder1.totalCents,
  });

  const demoOrder2 = await createCheckoutAndReserveStock({
    tenantId: SEED_IDS.MUSEUM_TENANT,
    idempotencyKey: 'seed-museum-order-2',
    customerDisplayName: 'Martín Quiroga',
    guestRecoveryContact: '11-5544-3322',
    items: [{ productId: museumProdComboAbsolut, quantity: 1 }],
  });

  await confirmOrderPaymentAndIssueQr({
    tenantId: SEED_IDS.MUSEUM_TENANT,
    orderId: demoOrder2.orderId,
    mpPaymentId: 9900112244,
    grossAmountCents: demoOrder2.totalCents,
  });

  // Generamos una primera liquidación semanal en Museum lista para conciliar en Superadmin y ver en el Panel del Dueño
  await generateWeeklySettlementForTenant({
    tenantId: SEED_IDS.MUSEUM_TENANT,
    periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    periodEnd: new Date(Date.now() + 60 * 1000),
    dueDate: '2026-11-05',
    settlementCode: 'LIQ-MUSEUM-2026-W44',
    superadminUserId: SEED_IDS.SUPERADMIN_USER,
  });
}
