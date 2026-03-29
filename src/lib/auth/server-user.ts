import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';

import { createSupabaseAuthServerClient } from '@/lib/supabase/server';

export type ServerAuthResult = {
  user: User | null;
};

export async function getServerUserFromCookies(): Promise<ServerAuthResult> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('th_access_token')?.value ?? null;
  const refreshToken = cookieStore.get('th_refresh_token')?.value ?? null;

  if (!accessToken && !refreshToken) {
    return { user: null };
  }

  const authClient = createSupabaseAuthServerClient();
  let resolvedAccessToken = accessToken;

  if (!resolvedAccessToken && refreshToken) {
    const refreshed = await authClient.auth.refreshSession({
      refresh_token: refreshToken,
    });
    resolvedAccessToken = refreshed.data.session?.access_token ?? null;
  }

  if (!resolvedAccessToken) {
    return { user: null };
  }

  const userResult = await authClient.auth.getUser(resolvedAccessToken);
  if (userResult.error || !userResult.data.user) {
    if (!refreshToken) return { user: null };

    const refreshed = await authClient.auth.refreshSession({
      refresh_token: refreshToken,
    });
    const fallbackAccessToken = refreshed.data.session?.access_token ?? null;
    if (!fallbackAccessToken) return { user: null };

    const fallbackUserResult = await authClient.auth.getUser(fallbackAccessToken);
    if (fallbackUserResult.error || !fallbackUserResult.data.user) {
      return { user: null };
    }

    return { user: fallbackUserResult.data.user };
  }

  return { user: userResult.data.user };
}
