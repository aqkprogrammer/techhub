import 'server-only';

import type { Session, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  getAuthClient,
} from '@/app/api/auth/_shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type AdminContext = {
  user: User;
  profile: {
    id: string;
    email: string | null;
    full_name: string | null;
    role: string | null;
  };
  refreshedSession: Session | null;
};

export async function setSessionCookies(session: Session) {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === 'production';

  cookieStore.set(ACCESS_COOKIE, session.access_token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: session.expires_in ?? 60 * 60,
  });
  cookieStore.set(REFRESH_COOKIE, session.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookies() {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, '', { path: '/', maxAge: 0 });
  cookieStore.set(REFRESH_COOKIE, '', { path: '/', maxAge: 0 });
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value ?? null;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value ?? null;
  if (!accessToken && !refreshToken) return null;

  const authClient = getAuthClient();
  let refreshedSession: Session | null = null;

  if (!accessToken && refreshToken) {
    const refreshed = await authClient.auth.refreshSession({ refresh_token: refreshToken });
    if (refreshed.data.session) {
      refreshedSession = refreshed.data.session;
      accessToken = refreshed.data.session.access_token;
    }
  }

  if (!accessToken) return null;

  let userResult = await authClient.auth.getUser(accessToken);
  if ((userResult.error || !userResult.data.user) && refreshToken) {
    const refreshed = await authClient.auth.refreshSession({ refresh_token: refreshToken });
    if (refreshed.data.session) {
      refreshedSession = refreshed.data.session;
      accessToken = refreshed.data.session.access_token;
      userResult = await authClient.auth.getUser(accessToken);
    }
  }

  const user = userResult.data.user;
  if (!user) return null;

  const admin = createSupabaseServerClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile) return null;
  if (profile.role !== 'admin') return null;

  return {
    user,
    profile,
    refreshedSession,
  };
}

export async function requireAdminPage() {
  const admin = await getAdminContext();
  if (!admin) {
    redirect('/admin/login');
  }
  return admin;
}

export async function requireAdminAction() {
  const admin = await getAdminContext();
  if (!admin) {
    throw new Error('Unauthorized');
  }
  return admin;
}
