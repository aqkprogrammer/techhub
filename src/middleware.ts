import { createClient, type Session } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const ACCESS_COOKIE = 'th_access_token';
const REFRESH_COOKIE = 'th_refresh_token';
const ADMIN_ROOT = '/admin';
const ADMIN_LOGIN = '/admin/login';

function getSupabaseUrl() {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
}

function getAnonKey() {
  return (
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    ''
  );
}

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

function withAdminHeaders(request: NextRequest, isLoginPath: boolean) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-admin-route', '1');
  if (isLoginPath) {
    requestHeaders.set('x-admin-login', '1');
  } else {
    requestHeaders.delete('x-admin-login');
  }
  return requestHeaders;
}

function applySessionCookies(response: NextResponse, session: Session | null) {
  if (!session) return;
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

async function getAuthenticatedUserId(request: NextRequest) {
  const url = getSupabaseUrl();
  const anonKey = getAnonKey();
  if (!url || !anonKey) return { userId: null, refreshedSession: null as Session | null };

  const authClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value ?? null;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value ?? null;
  let refreshedSession: Session | null = null;

  if (!accessToken && refreshToken) {
    const refreshed = await authClient.auth.refreshSession({ refresh_token: refreshToken });
    if (refreshed.data.session) {
      refreshedSession = refreshed.data.session;
      accessToken = refreshed.data.session.access_token;
    }
  }

  if (!accessToken) {
    return { userId: null, refreshedSession };
  }

  let userResult = await authClient.auth.getUser(accessToken);
  if ((userResult.error || !userResult.data.user) && refreshToken) {
    const refreshed = await authClient.auth.refreshSession({ refresh_token: refreshToken });
    if (refreshed.data.session) {
      refreshedSession = refreshed.data.session;
      userResult = await authClient.auth.getUser(refreshed.data.session.access_token);
    }
  }

  return {
    userId: userResult.data.user?.id ?? null,
    refreshedSession,
  };
}

async function isAdmin(userId: string) {
  const url = getSupabaseUrl();
  const serviceKey = getServiceRoleKey();
  if (!url || !serviceKey) return false;

  const adminClient = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) return false;
  return data?.role === 'admin';
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!pathname.startsWith(ADMIN_ROOT)) {
    return NextResponse.next();
  }

  const isLoginPath = pathname === ADMIN_LOGIN;
  const requestHeaders = withAdminHeaders(request, isLoginPath);
  const { userId, refreshedSession } = await getAuthenticatedUserId(request);

  if (!userId) {
    if (isLoginPath) {
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      applySessionCookies(response, refreshedSession);
      return response;
    }
    const loginUrl = new URL(ADMIN_LOGIN, request.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    const response = NextResponse.redirect(loginUrl);
    applySessionCookies(response, refreshedSession);
    return response;
  }

  const admin = await isAdmin(userId);
  if (!admin) {
    const response = NextResponse.redirect(new URL('/', request.url));
    applySessionCookies(response, refreshedSession);
    return response;
  }

  if (isLoginPath) {
    const response = NextResponse.redirect(new URL('/admin', request.url));
    applySessionCookies(response, refreshedSession);
    return response;
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applySessionCookies(response, refreshedSession);
  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
