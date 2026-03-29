import { NextResponse } from 'next/server';

import {
  getPublicProfile,
  getPublicUser,
  jsonError,
  setAuthCookies,
} from '../../auth/_shared';
import { requireAuthenticatedUser } from '../../account/_auth';

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const profile = await getPublicProfile(auth.user.id);
  if (profile?.role !== 'admin') {
    return jsonError('Forbidden.', 403);
  }

  const response = NextResponse.json({
    user: getPublicUser(auth.user),
    profile,
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }

  return response;
}
