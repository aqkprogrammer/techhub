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
  password: z.string().min(1),
});

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError('Invalid login payload.');
  }

  const { email, password } = parsed.data;
  const supabase = getAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user || !data.session) {
    return jsonError(error?.message ?? 'Invalid email or password.', 401);
  }

  await ensureProfileRecord(data.user);
  const profile = await getPublicProfile(data.user.id);

  const response = NextResponse.json({
    user: getPublicUser(data.user),
    profile,
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      expiresAt: data.session.expires_at,
    },
  });

  setAuthCookies(response, data.session);
  return response;
}
