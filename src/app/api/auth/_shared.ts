import { NextResponse } from 'next/server';
import type { Session, User } from '@supabase/supabase-js';

import {
  createSupabaseAuthServerClient,
  createSupabaseServerClient,
} from '@/lib/supabase/server';

export const ACCESS_COOKIE = 'th_access_token';
export const REFRESH_COOKIE = 'th_refresh_token';

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const parts = cookieHeader.split(';').map((part) => part.trim());
  const tokenCookie = parts.find((part) => part.startsWith(`${name}=`));
  if (!tokenCookie) return null;
  const value = tokenCookie.slice(name.length + 1).trim();
  return value || null;
}

export function getAccessTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  return getCookieValue(request, ACCESS_COOKIE);
}

export function getRefreshTokenFromRequest(request: Request): string | null {
  return getCookieValue(request, REFRESH_COOKIE);
}

export function setAuthCookies(response: NextResponse, session: Session) {
  const secure = process.env.NODE_ENV === 'production';

  response.cookies.set(ACCESS_COOKIE, session.access_token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: session.expires_in ?? 60 * 60,
  });
  response.cookies.set(REFRESH_COOKIE, session.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, '', { path: '/', maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, '', { path: '/', maxAge: 0 });
}

export async function ensureProfileRecord(user: User, fullName?: string | null) {
  try {
    const admin = createSupabaseServerClient();
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .eq('id', user.id)
      .maybeSingle();

    const inputFullName = fullName?.trim() ? fullName.trim() : null;
    const metadataFullName =
      typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()
        ? user.user_metadata.full_name.trim()
        : null;
    const metadataAvatarUrl =
      typeof user.user_metadata?.avatar_url === 'string' && user.user_metadata.avatar_url.trim()
        ? user.user_metadata.avatar_url.trim()
        : null;

    const profilePayload = {
      id: user.id,
      email: user.email ?? null,
      // Preserve stored values unless a non-empty value is explicitly available.
      full_name: inputFullName ?? existingProfile?.full_name ?? metadataFullName ?? null,
      avatar_url: existingProfile?.avatar_url ?? metadataAvatarUrl ?? null,
      role: existingProfile?.role ?? 'user',
    };

    await admin.from('profiles').upsert(profilePayload, { onConflict: 'id' });
  } catch (error) {
    console.warn('ensureProfileRecord failed:', error);
  }
}

export function getPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at,
    appMetadata: user.app_metadata,
    userMetadata: user.user_metadata,
  };
}

export async function getPublicProfile(userId: string) {
  try {
    const admin = createSupabaseServerClient();
    const { data } = await admin
      .from('profiles')
      .select('id, email, full_name, avatar_url, role, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (!data) return null;
    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
      role: data.role,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch {
    return null;
  }
}

export function getAuthClient() {
  return createSupabaseAuthServerClient();
}
