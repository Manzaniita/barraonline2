import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ensureDemoDataSeeded } from '@/db/seed';
import {
  createSignedGuestSessionToken,
  CUSTOMER_SESSION_COOKIE,
  GUEST_SESSION_COOKIE,
  isGoogleOAuthConfigured,
  upsertExpressCustomerSession,
  verifySignedCustomerSessionToken,
  verifySignedGuestSessionToken,
} from '@/modules/identity/customer-auth-service';
import {
  listAuthorizedCustomerOrders,
  recoverAndValidateOrderDraft,
} from '@/modules/inventory/checkout-and-stock-service';
import { getTenantBySlug } from '@/modules/tenancy/tenant-service';

export async function GET(
  request: NextRequest,
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

  const customerSession = verifySignedCustomerSessionToken(
    request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value
  );
  let guestSessionToken = verifySignedGuestSessionToken(
    request.cookies.get(GUEST_SESSION_COOKIE)?.value
  );
  let newGuestCookieValue: string | null = null;

  if (!guestSessionToken) {
    const generated = createSignedGuestSessionToken();
    guestSessionToken = generated.rawSessionId;
    newGuestCookieValue = generated.signedCookieValue;
  }

  const activeDraft = await recoverAndValidateOrderDraft({
    tenantId: tenant.id,
    customerUserId: customerSession?.userId ?? null,
    guestSessionToken,
  }).catch(() => null);

  const recentOrders = await listAuthorizedCustomerOrders({
    tenantId: tenant.id,
    customerUserId: customerSession?.userId ?? null,
    guestSessionToken,
  }).catch(() => []);

  const response = NextResponse.json(
    {
      authenticated: Boolean(customerSession),
      customer: customerSession
        ? {
            fullName: customerSession.fullName,
            email: customerSession.email,
            avatarUrl: customerSession.avatarUrl,
            provider: customerSession.provider,
          }
        : null,
      googleOAuthConfigured: isGoogleOAuthConfigured(),
      activeDraft,
      recentOrders,
    },
    {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    }
  );

  if (newGuestCookieValue) {
    response.cookies.set(GUEST_SESSION_COOKIE, newGuestCookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
  }

  return response;
}

const SessionPostSchema = z.object({
  action: z.enum(['IDENTIFY_SESSION', 'SIGN_OUT']),
  displayName: z.string().max(120).optional(),
  emailOrContact: z.string().max(160).optional(),
});

export async function POST(
  request: NextRequest,
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

  try {
    const body = SessionPostSchema.parse(await request.json());

    if (body.action === 'SIGN_OUT') {
      const resp = NextResponse.json({ authenticated: false, customer: null });
      resp.cookies.delete(CUSTOMER_SESSION_COOKIE);
      return resp;
    }

    let guestSessionToken = verifySignedGuestSessionToken(
      request.cookies.get(GUEST_SESSION_COOKIE)?.value
    );
    let newGuestCookieValue: string | null = null;
    if (!guestSessionToken) {
      const generated = createSignedGuestSessionToken();
      guestSessionToken = generated.rawSessionId;
      newGuestCookieValue = generated.signedCookieValue;
    }

    const sessionResult = await upsertExpressCustomerSession({
      displayName: body.displayName || '',
      emailOrContact: body.emailOrContact || null,
      tenantId: tenant.id,
      guestSessionToken,
    });

    const response = NextResponse.json({
      authenticated: true,
      customer: {
        fullName: sessionResult.fullName,
        email: sessionResult.email,
        avatarUrl: null,
        provider: 'EXPRESS_SESSION' as const,
      },
    });

    response.cookies.set(CUSTOMER_SESSION_COOKIE, sessionResult.sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    if (newGuestCookieValue) {
      response.cookies.set(GUEST_SESSION_COOKIE, newGuestCookieValue, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo iniciar la sesión.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
