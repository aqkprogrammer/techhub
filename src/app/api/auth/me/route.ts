import { NextResponse } from 'next/server';

import {
  getAccessTokenFromRequest,
  getAuthClient,
  getRefreshTokenFromRequest,
  getPublicProfile,
  getPublicUser,
  jsonError,
  setAuthCookies,
} from '../_shared';

export async function GET(request: Request) {
  const supabase = getAuthClient();
  let accessToken = getAccessTokenFromRequest(request);
  const refreshToken = getRefreshTokenFromRequest(request);

  if (!accessToken && !refreshToken) {
    return jsonError('Unauthorized.', 401);
  }

  let refreshedSession = null;
  if (!accessToken && refreshToken) {
    const refreshResult = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (refreshResult.data.session) {
      refreshedSession = refreshResult.data.session;
      accessToken = refreshResult.data.session.access_token;
    }
  }

  const { data, error } = accessToken
    ? await supabase.auth.getUser(accessToken)
    : { data: { user: null }, error: new Error('Unauthorized') };

  if ((error || !data.user) && refreshToken) {
    const refreshResult = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (refreshResult.data.session) {
      refreshedSession = refreshResult.data.session;
      const next = await supabase.auth.getUser(refreshResult.data.session.access_token);
      if (!next.error && next.data.user) {
        const profile = await getPublicProfile(next.data.user.id);
        const response = NextResponse.json({
          user: getPublicUser(next.data.user),
          profile,
        });
        setAuthCookies(response, refreshResult.data.session);
        return response;
      }
    }
  }

  if (error || !data.user) {
    return jsonError('Unauthorized.', 401);
  }

  const profile = await getPublicProfile(data.user.id);

  const response = NextResponse.json({
    user: getPublicUser(data.user),
    profile,
  });

  if (refreshedSession) {
    setAuthCookies(response, refreshedSession);
  }

  return response;
}
