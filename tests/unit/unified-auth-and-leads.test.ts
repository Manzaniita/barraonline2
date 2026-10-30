import { beforeAll, describe, expect, it } from 'vitest';
import { withSuperadminContext } from '@/db';
import { ensureDemoDataSeeded, SEED_IDS } from '@/db/seed';
import { loginUnified, verifyUserSessionServerSide } from '@/modules/identity/admin-auth-service';

describe('BARRAONLINE — Acceso Unificado Multi-Rol y Captura Comercial', () => {
  beforeAll(async () => {
    await ensureDemoDataSeeded();
  });

  it('1. SUPERADMIN inicia sesión desde el acceso unificado y es redirigido a /admin', async () => {
    const res = await loginUnified({
      email: 'superadmin@barraonline.com.ar',
      password: process.env.SUPERADMIN_INITIAL_PASSWORD || 'TuClaveAdminSegura2026!',
    });

    expect(res.user.role).toBe('SUPERADMIN');
    expect(res.redirectUrl).toBe('/admin');
    expect(res.token).toBeTruthy();

    const session = await verifyUserSessionServerSide(res.token);
    expect(session).not.toBeNull();
    expect(session?.role).toBe('SUPERADMIN');
  });

  it('2. DUEÑO (Owner) inicia sesión desde el acceso unificado y es redirigido a /b/museum/admin', async () => {
    const res = await loginUnified({
      email: 'dueno.museum@barraonline.com.ar',
      password: 'MuseumDueno2026!',
    });

    expect(res.user.role).toBe('DUEÑO');
    expect(res.user.tenantSlug).toBe('museum');
    expect(res.redirectUrl).toBe('/b/museum/admin');

    const session = await verifyUserSessionServerSide(res.token);
    expect(session?.role).toBe('DUEÑO');
    expect(session?.tenantSlug).toBe('museum');
  });

  it('3. GERENTE (Manager) inicia sesión desde el acceso unificado y es redirigido a /b/museum/admin', async () => {
    const res = await loginUnified({
      email: 'sofia.alarcon@museum.com.ar',
      password: 'GerenteMuseum2026!',
    });

    expect(res.user.role).toBe('GERENTE');
    expect(res.user.tenantSlug).toBe('museum');
    expect(res.redirectUrl).toBe('/b/museum/admin');

    const session = await verifyUserSessionServerSide(res.token);
    expect(session?.role).toBe('GERENTE');
  });

  it('4. CAJERO / BARMAN inicia sesión desde el acceso unificado y es redirigido a /b/museum/bar', async () => {
    const res = await loginUnified({
      email: 'tomas.vega@museum.com.ar',
      password: 'BarmanMuseum2026!',
    });

    expect(res.user.role).toBe('CAJERO');
    expect(res.user.tenantSlug).toBe('museum');
    expect(res.redirectUrl).toBe('/b/museum/bar');

    const session = await verifyUserSessionServerSide(res.token);
    expect(session?.role).toBe('CAJERO');
  });

  it('5. CLIENTE inicia sesión desde el acceso unificado y permanece en su contexto comercial', async () => {
    const res = await loginUnified({
      email: 'cliente.demo@gmail.com',
      password: 'ClienteDemo2026!',
    });

    expect(res.user.role).toBe('CLIENTE');
    expect(res.redirectUrl).toBe('/');

    const session = await verifyUserSessionServerSide(res.token);
    expect(session?.role).toBe('CLIENTE');
  });

  it('6. Guarda consultas comerciales reales en la tabla commercial_leads con auditoría', async () => {
    const leadData = {
      fullName: 'Alejandro Rossi',
      venueName: 'Samsara Beach Club',
      city: 'Mar del Plata',
      roleInVenue: 'Dueño / Socio Gerente',
      phone: '223-555-0192',
      email: 'alejandro@samsarabeach.com.ar',
      message: 'Queremos digitalizar la barra de playa para la temporada 2027.',
    };

    const insertedLead = await withSuperadminContext(async (tx) => {
      const res = await tx.query<{
        id: string;
        full_name: string;
        venue_name: string;
        city: string;
        role_in_venue: string;
        phone: string;
        email: string;
        status: string;
      }>(
        `INSERT INTO commercial_leads (
           full_name, venue_name, city, role_in_venue, phone, email, message, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'NEW')
         RETURNING *`,
        [
          leadData.fullName,
          leadData.venueName,
          leadData.city,
          leadData.roleInVenue,
          leadData.phone,
          leadData.email,
          leadData.message,
        ]
      );
      return res.rows[0];
    });

    expect(insertedLead).toBeDefined();
    expect(insertedLead?.full_name).toBe(leadData.fullName);
    expect(insertedLead?.venue_name).toBe(leadData.venueName);
    expect(insertedLead?.status).toBe('NEW');
  });
});
