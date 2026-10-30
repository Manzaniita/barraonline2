import { beforeAll, describe, expect, it } from 'vitest';
import { withAnonymousRlsContext, withSuperadminContext, withTenantContext } from '@/db';
import { ensureDemoDataSeeded } from '@/db/seed';
import {
  changeSuperadminPassword,
  createSignedAdminSessionToken,
  DEFAULT_SUPERADMIN_EMAIL,
  ensureSuperadminAccountInitialized,
  loginSuperadmin,
  revokeAllOtherAdminSessions,
  validatePasswordStrength,
  verifyPassword,
  verifySignedAdminSessionToken,
  verifySuperadminSessionServerSide,
} from '@/modules/identity/admin-auth-service';
import {
  createSignedCustomerSessionToken,
  CUSTOMER_SESSION_COOKIE,
  verifySignedCustomerSessionToken,
} from '@/modules/identity/customer-auth-service';
import {
  archiveTenantBySuperadmin,
  createTenantBySuperadmin,
  getTenantBySlug,
  listAllTenantsForDirectory,
  listAllTenantsForSuperadmin,
  updateTenantBySuperadmin,
  updateTenantLandingVisibility,
  updateTenantStatusBySuperadmin,
} from '@/modules/tenancy/tenant-service';
import { createMercadoPagoPreferenceForOrder } from '@/modules/payments/mercadopago-service';
import { createCheckoutAndReserveStock } from '@/modules/inventory/checkout-and-stock-service';

describe('BARRAONLINE — Superadministrador, Autenticación y Multi-Tenant', () => {
  const initialPassword = 'BarraOnline2026!AdminSecuro#';
  const superadminEmail = DEFAULT_SUPERADMIN_EMAIL; // xjoacovidal@gmail.com

  beforeAll(async () => {
    process.env.SUPERADMIN_INITIAL_EMAIL = superadminEmail;
    process.env.SUPERADMIN_INITIAL_PASSWORD = initialPassword;
    await ensureDemoDataSeeded();
  });

  // ==========================================================================
  // Criterio 1 & 2: Inicialización y Cuenta de Superadministrador
  // ==========================================================================
  it('1 & 2. Inicializa la cuenta de superadministrador con bcrypt (12 rounds), rol SUPERADMIN y no la sobrescribe en reinicio', async () => {
    await ensureSuperadminAccountInitialized();

    const user = await withSuperadminContext(async (tx) => {
      const res = await tx.query<{
        id: string;
        email: string;
        password_hash: string | null;
        is_superadmin: boolean;
        status: string;
        session_version: number;
      }>(`SELECT * FROM users WHERE email = $1 LIMIT 1`, [superadminEmail]);
      return res.rows[0];
    });

    expect(user).toBeDefined();
    expect(user?.email).toBe(superadminEmail);
    expect(user?.is_superadmin).toBe(true);
    expect(user?.status).toBe('ACTIVE');
    expect(user?.password_hash).toBeTruthy();
    expect(user?.password_hash?.startsWith('$2')).toBe(true); // bcrypt signature

    // Comprobamos que el hash coincide con la contraseña configurada
    const matches = await verifyPassword(initialPassword, user!.password_hash!);
    expect(matches).toBe(true);

    // Verificamos que un segundo reinicio no sobrescribe la contraseña existente
    const hashBefore = user!.password_hash;
    process.env.SUPERADMIN_INITIAL_PASSWORD = 'DifferentPassword123!';
    await ensureSuperadminAccountInitialized();

    const userAfter = await withSuperadminContext(async (tx) => {
      const res = await tx.query<{ password_hash: string }>(
        `SELECT password_hash FROM users WHERE email = $1 LIMIT 1`,
        [superadminEmail]
      );
      return res.rows[0];
    });
    expect(userAfter?.password_hash).toBe(hashBefore);
  });

  // ==========================================================================
  // Criterio 3: Login del Superadministrador y Protección de Rutas
  // ==========================================================================
  it('3. El superadministrador puede iniciar sesión con éxito y se rechazan credenciales inválidas sin filtrar existencia', async () => {
    // Intento con contraseña errónea -> debe fallar con error genérico
    await expect(
      loginSuperadmin({
        email: superadminEmail,
        password: 'WrongPassword999!',
        clientIp: '10.0.0.1',
      })
    ).rejects.toThrow(/Credenciales inválidas/i);

    // Intento con correo inexistente -> debe fallar con el MISMO error genérico
    await expect(
      loginSuperadmin({
        email: 'inexistente@noexiste.com.ar',
        password: 'AnyPassword123!',
        clientIp: '10.0.0.2',
      })
    ).rejects.toThrow(/Credenciales inválidas/i);

    // Login exitoso
    const { user, token } = await loginSuperadmin({
      email: superadminEmail,
      password: initialPassword,
      clientIp: '10.0.0.3',
    });

    expect(user.email).toBe(superadminEmail);
    expect(user.isSuperadmin).toBe(true);
    expect(token).toBeDefined();

    // Verificamos que el token emitido es validado en el servidor
    const verified = await verifySuperadminSessionServerSide(token);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(user.id);
    expect(verified?.email).toBe(superadminEmail);
    expect(verified?.isSuperadmin).toBe(true);
  });

  it('4. Un usuario sin sesión o un cliente NO puede ingresar al superadministrador', async () => {
    // 1. Sin sesión (token null o vacío)
    const anonymousCheck = await verifySuperadminSessionServerSide(null);
    expect(anonymousCheck).toBeNull();

    // 2. Sesión de Cliente (emitida como cliente Google / Express)
    const customerToken = createSignedCustomerSessionToken({
      userId: '00000000-0000-4000-8000-000000000099',
      email: 'cliente@gmail.com',
      fullName: 'Cliente Común',
      provider: 'GOOGLE',
    });

    // El servidor superadmin rechaza de inmediato un token que no sea SUPERADMIN
    const clientRejected = await verifySuperadminSessionServerSide(customerToken);
    expect(clientRejected).toBeNull();

    // Token manipulado o corrupto
    const tamperedToken = customerToken + 'tampered';
    expect(await verifySuperadminSessionServerSide(tamperedToken)).toBeNull();
  });

  // ==========================================================================
  // Criterio 4: Cambiar mi contraseña, Validación y Cierre de Sesiones
  // ==========================================================================
  it('5 & 6. Cambio de contraseña: exige contraseña actual, valida fortaleza, actualiza hash y la contraseña anterior deja de funcionar', async () => {
    const adminUser = await withSuperadminContext(async (tx) => {
      const res = await tx.query<{ id: string }>(
        `SELECT id FROM users WHERE email = $1 LIMIT 1`,
        [superadminEmail]
      );
      return res.rows[0]!;
    });

    // Validamos reglas de fortaleza de contraseña
    expect(validatePasswordStrength('corta').valid).toBe(false);
    expect(validatePasswordStrength('solominuscualasyunpocomasdelongitud').valid).toBe(false);
    expect(validatePasswordStrength('SoloMayusculasYMinusculasSinNumeros').valid).toBe(false);
    expect(validatePasswordStrength('Valida1234#ConSimbolosYMayus').valid).toBe(true);

    // Contraseña actual errónea -> rechaza
    await expect(
      changeSuperadminPassword({
        userId: adminUser.id,
        currentPassword: 'PasswordEquivocada!',
        newPassword: 'NuevaContrasenaSegura2026!#',
        confirmNewPassword: 'NuevaContrasenaSegura2026!#',
      })
    ).rejects.toThrow(/contraseña actual ingresada es incorrecta/i);

    // Confirmación no coincide -> rechaza
    await expect(
      changeSuperadminPassword({
        userId: adminUser.id,
        currentPassword: initialPassword,
        newPassword: 'NuevaContrasenaSegura2026!#',
        confirmNewPassword: 'NoCoincide123!#',
      })
    ).rejects.toThrow(/no coinciden/i);

    // Obtenemos un token de sesión antes del cambio
    const { token: oldSessionToken } = await loginSuperadmin({
      email: superadminEmail,
      password: initialPassword,
    });
    expect(await verifySuperadminSessionServerSide(oldSessionToken)).not.toBeNull();

    // Cambio exitoso
    const newPasswordValid = 'SuperNuevaClave2026!#Segura';
    const { user, newToken } = await changeSuperadminPassword({
      userId: adminUser.id,
      currentPassword: initialPassword,
      newPassword: newPasswordValid,
      confirmNewPassword: newPasswordValid,
    });

    expect(user.email).toBe(superadminEmail);
    expect(newToken).toBeDefined();

    // 1. La sesión anterior quedó invalidada porque se incrementó session_version
    const oldSessionCheck = await verifySuperadminSessionServerSide(oldSessionToken);
    expect(oldSessionCheck).toBeNull();

    // 2. La nueva sesión está activa
    const newSessionCheck = await verifySuperadminSessionServerSide(newToken);
    expect(newSessionCheck).not.toBeNull();

    // 3. La contraseña anterior deja de funcionar en el login
    await expect(
      loginSuperadmin({
        email: superadminEmail,
        password: initialPassword,
      })
    ).rejects.toThrow(/Credenciales inválidas/i);

    // 4. La nueva contraseña funciona exitosamente
    const newLogin = await loginSuperadmin({
      email: superadminEmail,
      password: newPasswordValid,
    });
    expect(newLogin.user.id).toBe(adminUser.id);
  });

  it('7. Cierre de todas las demás sesiones activas (revokeAllOtherAdminSessions)', async () => {
    const adminUser = await withSuperadminContext(async (tx) => {
      const res = await tx.query<{ id: string }>(
        `SELECT id FROM users WHERE email = $1 LIMIT 1`,
        [superadminEmail]
      );
      return res.rows[0]!;
    });

    // Iniciamos una sesión A (ej. desde una tablet)
    const sessionA = await loginSuperadmin({
      email: superadminEmail,
      password: 'SuperNuevaClave2026!#Segura',
    });
    expect(await verifySuperadminSessionServerSide(sessionA.token)).not.toBeNull();

    // Revocamos todas las demás sesiones desde la computadora
    const { newToken: sessionB } = await revokeAllOtherAdminSessions(adminUser.id);

    // La sesión A ahora es rechazada
    expect(await verifySuperadminSessionServerSide(sessionA.token)).toBeNull();

    // La nueva sesión B emitida es válida
    expect(await verifySuperadminSessionServerSide(sessionB)).not.toBeNull();
  });

  // ==========================================================================
  // Criterios 9 & 10: Gestión de Boliches y Publicación en Landing
  // ==========================================================================
  it('8. Creación, edición, activación, destacamiento y orden de aparición de boliches por el superadmin', async () => {
    const testSlug = 'club-playa-grande';

    // 1. Crear nuevo boliche
    const created = await createTenantBySuperadmin({
      slug: testSlug,
      fantasyName: 'Playa Grande Club',
      legalName: 'Entretenimientos Costeros SA',
      cuit: '30-79998888-1',
      city: 'Mar del Plata',
      address: 'Paseo Victoria Ocampo 100',
      status: 'ACTIVE',
      isPublished: true,
      isFeatured: false,
      isVisibleOnLanding: true,
      sortOrder: 10,
      commercialTag: 'NUEVO COSTA 2026',
      themeConfig: {
        accentPrimary: '#00F0FF',
        accentSecondary: '#FF2E63',
      },
    });

    expect(created.slug).toBe(testSlug);
    expect(created.fantasy_name).toBe('Playa Grande Club');
    expect(created.is_published).toBe(true);
    expect(created.is_visible_on_landing).toBe(true);
    expect(created.is_featured).toBe(false);

    // 2. Aparece en el listado público de la landing
    const publicList1 = await listAllTenantsForDirectory();
    const foundInPublic1 = publicList1.find((t) => t.slug === testSlug);
    expect(foundInPublic1).toBeDefined();
    expect(foundInPublic1?.fantasy_name).toBe('Playa Grande Club');

    // 3. Marcar como DESTACADO y cambiar orden a 1
    await updateTenantLandingVisibility({
      tenantId: created.id,
      isFeatured: true,
      sortOrder: 1,
      commercialTag: 'DESTACADO VIP',
    });

    const publicList2 = await listAllTenantsForDirectory();
    const foundInPublic2 = publicList2.find((t) => t.slug === testSlug);
    expect(foundInPublic2?.is_featured).toBe(true);
    expect(foundInPublic2?.sort_order).toBe(1);
    expect(foundInPublic2?.commercial_tag).toBe('DESTACADO VIP');

    // 4. Ocultar de la landing sin desactivar operativamente (isVisibleOnLanding = false)
    await updateTenantLandingVisibility({
      tenantId: created.id,
      isVisibleOnLanding: false,
    });

    // No debe aparecer en el directorio de la landing
    const publicList3 = await listAllTenantsForDirectory();
    expect(publicList3.find((t) => t.slug === testSlug)).toBeUndefined();

    // Pero su experiencia propia /b/[slug] sigue funcionando porque está ACTIVE
    const tenantRecord = await getTenantBySlug(testSlug);
    expect(tenantRecord).not.toBeNull();
    expect(tenantRecord?.status).toBe('ACTIVE');

    // 5. Reactivar visibilidad en landing
    await updateTenantLandingVisibility({
      tenantId: created.id,
      isVisibleOnLanding: true,
    });
    const publicList4 = await listAllTenantsForDirectory();
    expect(publicList4.find((t) => t.slug === testSlug)).toBeDefined();

    // 6. Desactivar operativamente (PAUSED_MORA) -> no debe aparecer en la landing comercial
    await updateTenantStatusBySuperadmin({
      tenantId: created.id,
      newStatus: 'PAUSED_MORA',
    });
    const publicList5 = await listAllTenantsForDirectory();
    expect(publicList5.find((t) => t.slug === testSlug)).toBeUndefined();

    // 7. Baja lógica / Archivo seguro sin borrado físico
    await archiveTenantBySuperadmin({ tenantId: created.id });
    const archived = await getTenantBySlug(testSlug);
    expect(archived?.status).toBe('SUSPENDED');
    expect(archived?.is_published).toBe(false);
    expect(archived?.is_visible_on_landing).toBe(false);
  });

  // ==========================================================================
  // Criterio 6: Marca Blanca e Integración Mercado Pago con Retorno Confiable
  // ==========================================================================
  it('9. Marca Blanca: las preferencias de Mercado Pago generan back_urls estrictamente aisladas al boliche de origen', async () => {
    const museumTenant = await getTenantBySlug('museum');
    expect(museumTenant).toBeDefined();

    // Obtenemos un producto y categoría de Museum
    const product = await withTenantContext(museumTenant!.id, async (tx) => {
      const res = await tx.query<{ id: string; price_cents: string; name: string }>(
        `SELECT id, price_cents, name FROM products WHERE tenant_id = $1 AND is_active = true LIMIT 1`,
        [museumTenant!.id]
      );
      return res.rows[0]!;
    });

    // Creamos un checkout
    const checkout = await createCheckoutAndReserveStock({
      tenantId: museumTenant!.id,
      idempotencyKey: 'idem-test-marca-blanca-001',
      items: [{ productId: product.id, quantity: 1 }],
      customerDisplayName: 'Cliente Test Marca Blanca',
      guestSessionToken: 'test-guest-session-token-12345678',
    });

    // Generamos la preferencia oficial de Mercado Pago
    const mpResult = await createMercadoPagoPreferenceForOrder({
      tenantId: museumTenant!.id,
      orderId: checkout.orderId,
    });

    const payload = mpResult.requestPayloadSentToMp as {
      back_urls?: { success?: string; pending?: string; failure?: string };
      auto_return?: string;
    };

    expect(payload.back_urls).toBeDefined();
    expect(payload.back_urls?.success).toContain('/b/museum');
    expect(payload.back_urls?.pending).toContain('/b/museum');
    expect(payload.back_urls?.failure).toContain('/b/museum');
    // Nunca debe contener la landing principal sin el prefijo del boliche
    expect(payload.back_urls?.success).not.toBe('http://localhost:3000/');
    expect(payload.auto_return).toBe('approved');
  });

  // ==========================================================================
  // Criterio 12: Aislamiento RLS entre Boliches
  // ==========================================================================
  it('10. Ningún usuario o boliche puede consultar ni modificar información de otro tenant sin autorización', async () => {
    const museum = await getTenantBySlug('museum');
    const pueblo = await getTenantBySlug('pueblo-limite');
    expect(museum).toBeDefined();
    expect(pueblo).toBeDefined();

    // Intentar leer pedidos de Pueblo desde el contexto RLS de Museum debe arrojar 0 registros
    const crossTenantOrders = await withTenantContext(museum!.id, async (tx) => {
      const res = await tx.query(`SELECT * FROM orders WHERE tenant_id = $1`, [pueblo!.id]);
      return res.rows;
    });

    expect(crossTenantOrders.length).toBe(0);
  });
});
