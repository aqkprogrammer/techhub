import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  clearAuthCookies,
  ensureProfileRecord,
  getAuthClient,
  getPublicProfile,
  getPublicUser,
  jsonError,
  setAuthCookies,
} from '../../auth/_shared';

const bodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

async function parseLoginBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('application/json')) {
    return request.json();
  }

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const form = await request.formData();
    return {
      email: form.get('email'),
      password: form.get('password'),
    };
  }

  const raw = await request.text();
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await parseLoginBody(request);
  } catch {
    return jsonError('Invalid request body.');
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid login payload.',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const authClient = getAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
  });

  if (error || !data.user || !data.session) {
    const code =
      error && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
        ? ((error as { code: string }).code ?? undefined)
        : undefined;
    const status =
      code === 'invalid_credentials'
        ? 401
        : error?.status && error.status >= 400 && error.status < 600
          ? error.status
          : 401;
    const friendlyError =
      code === 'unexpected_failure' && (error?.message ?? '').toLowerCase().includes('schema')
        ? 'Auth schema/user record is inconsistent for this account. Recreate admin user via Supabase Admin API or dashboard.'
        : error?.message ?? 'Invalid email or password.';

    return NextResponse.json(
      {
        error: friendlyError,
        details: error
          ? {
              status: error.status,
              code,
              name: error.name,
            }
          : undefined,
      },
      { status },
    );
  }

  await ensureProfileRecord(data.user);
  const profile = await getPublicProfile(data.user.id);

  if (profile?.role !== 'admin') {
    const response = jsonError('This account does not have admin access.', 403);
    clearAuthCookies(response);
    return response;
  }

  const response = NextResponse.json({
    user: getPublicUser(data.user),
    profile,
  });
  setAuthCookies(response, data.session);
  return response;
}
