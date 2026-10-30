import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withSuperadminContext } from '@/db';
import { ensureDemoDataSeeded } from '@/db/seed';

const LeadSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Por favor ingresá tu nombre y apellido completo.')
    .max(160, 'El nombre no puede exceder 160 caracteres.'),
  venueName: z
    .string()
    .trim()
    .min(2, 'Por favor ingresá el nombre de tu boliche o bar.')
    .max(160, 'El nombre del establecimiento no puede exceder 160 caracteres.'),
  city: z
    .string()
    .trim()
    .min(2, 'Por favor ingresá la ciudad de tu establecimiento.')
    .max(100, 'La ciudad no puede exceder 100 caracteres.'),
  roleInVenue: z
    .string()
    .trim()
    .min(2, 'Por favor seleccioná o indicá tu cargo o relación con el establecimiento.')
    .max(80),
  phone: z
    .string()
    .trim()
    .min(6, 'Por favor ingresá un número de teléfono o WhatsApp válido.')
    .max(40, 'El teléfono no puede exceder 40 caracteres.'),
  email: z
    .string()
    .trim()
    .email('Por favor ingresá una dirección de correo electrónico válida.')
    .max(320),
  message: z
    .string()
    .trim()
    .max(2000, 'El mensaje no puede exceder 2000 caracteres.')
    .optional()
    .default(''),
});

export async function POST(request: NextRequest) {
  await ensureDemoDataSeeded();

  try {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json(
        { error: 'Por favor completá todos los campos requeridos.' },
        { status: 400 }
      );
    }

    const parsed = LeadSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Datos de formulario incompletos.';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { fullName, venueName, city, roleInVenue, phone, email, message } = parsed.data;

    const leadId = await withSuperadminContext(async (tx) => {
      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO commercial_leads (
           full_name, venue_name, city, role_in_venue, phone, email, message, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'NEW')
         RETURNING id`,
        [fullName, venueName, city, roleInVenue, phone, email, message || '']
      );

      const newId = inserted.rows[0]?.id;

      if (newId) {
        await tx.query(
          `INSERT INTO audit_logs (
             actor_role, action, entity_type, entity_id, after_state
           ) VALUES ('LEAD', 'COMMERCIAL_LEAD_SUBMITTED', 'commercial_lead', $1, $2::jsonb)`,
          [
            newId,
            JSON.stringify({
              venueName,
              city,
              fullName,
              email,
              phone,
              roleInVenue,
            }),
          ]
        );
      }

      return newId;
    });

    return NextResponse.json({
      success: true,
      leadId,
      message: '¡Consulta recibida! Nuestro equipo comercial se comunicará a la brevedad.',
    });
  } catch (error) {
    const msg =
      error instanceof Error
        ? error.message
        : 'Ocurrió un error al procesar la solicitud. Por favor contactanos por WhatsApp.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
