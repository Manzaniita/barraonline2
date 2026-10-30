import { NextResponse, type NextRequest } from 'next/server';
import {
  buildGoogleOAuthAuthorizationFlow,
  createSignedGuestSessionToken,
  GOOGLE_OAUTH_STATE_COOKIE,
  GUEST_SESSION_COOKIE,
  isGoogleOAuthConfigured,
  verifySignedGuestSessionToken,
} from '@/modules/identity/customer-auth-service';

export async function GET(request: NextRequest) {
  const slug = (request.nextUrl.searchParams.get('slug') || '').trim().toLowerCase();
  const stepParam = Number.parseInt(
    request.nextUrl.searchParams.get('step') || '3',
    10
  );
  const returnStep = Number.isFinite(stepParam)
    ? Math.min(4, Math.max(1, stepParam))
    : 3;

  if (!slug || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return NextResponse.json(
      { error: 'INVALID_TENANT_SLUG', message: 'Establecimiento inválido.' },
      { status: 400 }
    );
  }

  const existingGuestSid = verifySignedGuestSessionToken(
    request.cookies.get(GUEST_SESSION_COOKIE)?.value
  );
  const newGuestCookie = existingGuestSid ? null : createSignedGuestSessionToken();

  if (!isGoogleOAuthConfigured()) {
    const fallbackUrl = new URL(`/b/${slug}`, request.url);
    fallbackUrl.searchParams.set('step', '2');
    fallbackUrl.searchParams.set('auth_notice', 'google_credentials_missing');
    const resp = NextResponse.redirect(fallbackUrl);
    if (newGuestCookie) {
      resp.cookies.set(GUEST_SESSION_COOKIE, newGuestCookie.signedCookieValue, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
    }
    return resp;
  }

  const oauthFlow = buildGoogleOAuthAuthorizationFlow({
    tenantSlug: slug,
    returnStep,
  });

  const response = NextResponse.redirect(oauthFlow.authorizationUrl);
  response.cookies.set(
    GOOGLE_OAUTH_STATE_COOKIE,
    oauthFlow.signedStateCookieValue,
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600,
    }
  );

  if (newGuestCookie) {
    response.cookies.set(GUEST_SESSION_COOKIE, newGuestCookie.signedCookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
  }

  return response;
}
