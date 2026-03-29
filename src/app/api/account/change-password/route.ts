import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAuthClient, jsonError, setAuthCookies } from '../../auth/_shared';
import { requireAuthenticatedUser } from '../_auth';

const bodySchema = z
  .object({
    currentPassword: z.string().min(8).max(128),
    newPassword: z.string().min(8).max(128),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'New password must be different from current password.',
    path: ['newPassword'],
  });

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid password payload.');
  }

  if (!auth.user.email) {
    return jsonError('User email is missing for password verification.', 400);
  }

  const authClient = getAuthClient();
  const verify = await authClient.auth.signInWithPassword({
    email: auth.user.email,
    password: parsed.data.currentPassword,
  });
  if (verify.error || !verify.data.user) {
    return jsonError('Current password is incorrect.', 400);
  }

  const admin = createSupabaseServerClient();
  const { error } = await admin.auth.admin.updateUserById(auth.user.id, {
    password: parsed.data.newPassword,
  });

  if (error) {
    return jsonError(error.message || 'Failed to update password.', 500);
  }

  const response = NextResponse.json({
    success: true,
    message: 'Password updated successfully.',
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }

  return response;
}
