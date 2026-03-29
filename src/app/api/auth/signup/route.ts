import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ensureProfileRecord,
  getAuthClient,
  getPublicProfile,
  getPublicUser,
  jsonError,
  setAuthCookies,
} from '../_shared';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(1).max(120).optional(),
});

function getBaseUrl(request: Request) {
  const url = new URL(request.url);
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    url.host;
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  return `${proto}://${host}`;
}

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError('Invalid signup payload.');
  }

  const { email, password, fullName } = parsed.data;
  const supabase = getAuthClient();
  const emailRedirectTo = `${getBaseUrl(request)}/auth/callback`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: fullName ? { full_name: fullName } : undefined,
    },
  });

  if (error) {
    const isDatabaseSignupError = /database error saving new user/i.test(error.message);
    const authCode = (error as { code?: string }).code ?? null;
    const isEmailRateLimitError = authCode === 'over_email_send_rate_limit';
    const isEmailValidationOrAuthorizationError =
      authCode === 'email_address_invalid' || authCode === 'email_address_not_authorized';
    const status =
      typeof (error as { status?: unknown }).status === 'number'
        ? ((error as { status: number }).status ?? 400)
        : isDatabaseSignupError
          ? 500
          : 400;

    return NextResponse.json(
      {
        error: isDatabaseSignupError
          ? 'Signup failed due to database profile trigger/schema mismatch. Run apps/web/supabase/auth_profiles.sql in Supabase SQL editor and retry.'
          : isEmailRateLimitError
            ? 'Signup email rate limit reached for this Supabase project. Wait for cooldown or disable email confirmation for local development.'
          : isEmailValidationOrAuthorizationError
            ? 'Supabase rejected this email for this project. In Supabase Dashboard configure Email auth properly: set custom SMTP or disable email confirmation for local dev, and check allowed email-domain restrictions.'
          : error.message,
        ...(process.env.NODE_ENV !== 'production'
          ? {
              details: {
                status: (error as { status?: number }).status ?? null,
                code: authCode,
                name: error.name,
                originalMessage: error.message,
              },
            }
          : {}),
      },
      { status }
    );
  }
  if (!data.user) {
    return jsonError('Signup failed.', 400);
  }

  await ensureProfileRecord(data.user, fullName);
  const profile = await getPublicProfile(data.user.id);

  const response = NextResponse.json({
    user: getPublicUser(data.user),
    profile,
    session: data.session
      ? {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresIn: data.session.expires_in,
          expiresAt: data.session.expires_at,
        }
      : null,
    emailConfirmationRequired: !data.session,
  });

  if (data.session) {
    setAuthCookies(response, data.session);
  }

  return response;
}
