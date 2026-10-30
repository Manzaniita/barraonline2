import { NextResponse, type NextRequest } from 'next/server';
import { ensureDemoDataSeeded } from '@/db/seed';
import {
  CUSTOMER_SESSION_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  GUEST_SESSION_COOKIE,
  upsertAuthenticatedGoogleCustomer,
  verifyGoogleOAuthCallbackState,
  verifySignedGuestSessionToken,
} from '@/modules/identity/customer-auth-service';
import { getTenantBySlug } from '@/modules/tenancy/tenant-service';

export async function GET(request: NextRequest) {
  await ensureDemoDataSeeded();

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const oauthError = request.nextUrl.searchParams.get('error');
  const stateCookie = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

  const verification = verifyGoogleOAuthCallbackState({
    stateQueryParam: state,
    signedStateCookieValue: stateCookie,
  });

  if (!verification.valid || !verification.tenantSlug) {
    return NextResponse.json(
      {
        error: 'INVALID_OAUTH_STATE',
        message: 'La sesión de autenticación expiró o no pudo validarse.',
      },
      { status: 400 }
    );
  }

  const tenantSlug = verification.tenantSlug;
  const returnStep = verification.returnStep ?? 3;

  if (oauthError || !code) {
    const cancelUrl = new URL(`/b/${tenantSlug}`, request.url);
    cancelUrl.searchParams.set('step', '2');
    cancelUrl.searchParams.set('auth_notice', 'google_cancelled');
    const resp = NextResponse.redirect(cancelUrl);
    resp.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return resp;
  }

  try {
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const redirectUri =
      (process.env.GOOGLE_REDIRECT_URI || '').trim() ||
      `${appUrl}/api/auth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verification.codeVerifier ?? '',
      }),
    });

    if (!tokenRes.ok) {
      throw new Error('GOOGLE_TOKEN_EXCHANGE_FAILED');
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
    };

    if (!tokenData.access_token) {
      throw new Error('GOOGLE_ACCESS_TOKEN_MISSING');
    }

    const userInfoRes = await fetch(
      'https://openidconnect.googleapis.com/v1/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    if (!userInfoRes.ok) {
      throw new Error('GOOGLE_USERINFO_FAILED');
    }

    const profile = (await userInfoRes.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!profile.sub || !profile.email) {
      throw new Error('GOOGLE_PROFILE_INCOMPLETE');
    }

    const tenant = await getTenantBySlug(tenantSlug);
    const guestSessionToken = verifySignedGuestSessionToken(
      request.cookies.get(GUEST_SESSION_COOKIE)?.value
    );

    const authCustomer = await upsertAuthenticatedGoogleCustomer({
      googleSub: profile.sub,
      email: profile.email,
      fullName: profile.name || profile.email.split('@')[0] || 'Cliente',
      avatarUrl: profile.picture ?? null,
      tenantId: tenant?.id ?? null,
      guestSessionToken,
    });

    const destination = new URL(`/b/${tenantSlug}`, request.url);
    destination.searchParams.set('step', String(returnStep));
    destination.searchParams.set('auth', 'verified');

    const response = NextResponse.redirect(destination);
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    response.cookies.set(CUSTOMER_SESSION_COOKIE, authCustomer.sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch {
    const errUrl = new URL(`/b/${tenantSlug}`, request.url);
    errUrl.searchParams.set('step', '2');
    errUrl.searchParams.set('auth_notice', 'google_auth_failed');
    const resp = NextResponse.redirect(errUrl);
    resp.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return resp;
  }
}
