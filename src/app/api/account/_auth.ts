import type { Session, User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import {
  getAccessTokenFromRequest,
  getAuthClient,
  getRefreshTokenFromRequest,
  jsonError,
} from '../auth/_shared';

type AuthenticatedUserResult =
  | {
      ok: true;
      user: User;
      session: Session | null;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireAuthenticatedUser(request: Request): Promise<AuthenticatedUserResult> {
  const authClient = getAuthClient();
  let accessToken = getAccessTokenFromRequest(request);
  const refreshToken = getRefreshTokenFromRequest(request);
  let refreshedSession: Session | null = null;

  if (!accessToken && !refreshToken) {
    return { ok: false, response: jsonError('Unauthorized.', 401) };
  }

  if (!accessToken && refreshToken) {
    const refreshed = await authClient.auth.refreshSession({ refresh_token: refreshToken });
    if (refreshed.data.session) {
      refreshedSession = refreshed.data.session;
      accessToken = refreshed.data.session.access_token;
    }
  }

  if (!accessToken) {
    return { ok: false, response: jsonError('Unauthorized.', 401) };
  }

  let userResult = await authClient.auth.getUser(accessToken);

  if ((userResult.error || !userResult.data.user) && refreshToken) {
    const refreshed = await authClient.auth.refreshSession({ refresh_token: refreshToken });
    if (refreshed.data.session) {
      refreshedSession = refreshed.data.session;
      userResult = await authClient.auth.getUser(refreshed.data.session.access_token);
    }
  }

  if (userResult.error || !userResult.data.user) {
    return { ok: false, response: jsonError('Unauthorized.', 401) };
  }

  return {
    ok: true,
    user: userResult.data.user,
    session: refreshedSession,
  };
}
