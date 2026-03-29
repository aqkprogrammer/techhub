import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPublicProfile, jsonError, setAuthCookies } from '../../auth/_shared';
import { requireAuthenticatedUser } from '../_auth';

const updateBodySchema = z
  .object({
    fullName: z.string().trim().min(1).max(120).optional().nullable(),
    avatarUrl: z
      .string()
      .trim()
      .max(500)
      .refine((value) => {
        if (value.startsWith('/uploads/')) return true;
        try {
          const parsed = new URL(value);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      }, 'Avatar URL must be an http(s) URL or /uploads path.')
      .optional()
      .nullable(),
  })
  .refine((value) => value.fullName !== undefined || value.avatarUrl !== undefined, {
    message: 'No fields to update.',
  });

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const profile = await getPublicProfile(auth.user.id);
  const response = NextResponse.json({
    profile,
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }

  return response;
}

export async function PATCH(request: Request) {
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

  const parsed = updateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid profile payload.');
  }

  const updates: Record<string, string | null> = {
    id: auth.user.id,
    email: auth.user.email ?? null,
  };
  if (parsed.data.fullName !== undefined) {
    updates.full_name = parsed.data.fullName === null ? null : parsed.data.fullName.trim();
  }
  if (parsed.data.avatarUrl !== undefined) {
    updates.avatar_url = parsed.data.avatarUrl === null ? null : parsed.data.avatarUrl.trim();
  }

  const admin = createSupabaseServerClient();
  const { error } = await admin.from('profiles').upsert(updates, { onConflict: 'id' });
  if (error) {
    return jsonError('Failed to update profile.', 500);
  }

  const profile = await getPublicProfile(auth.user.id);
  const response = NextResponse.json({
    profile,
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }

  return response;
}
