import { NextResponse } from 'next/server';

import { setAuthCookies } from '@/app/api/auth/_shared';
import { requireApiUser } from '@/app/api/_security';
import { getLearningDashboardData } from '@/lib/learning-dashboard';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', auth.user.id)
    .maybeSingle();

  const dashboard = await getLearningDashboardData(auth.supabase, auth.user.id);

  const response = NextResponse.json({
    user: {
      id: auth.user.id,
      email: auth.user.email ?? null,
      fullName:
        (typeof profile?.full_name === 'string' && profile.full_name.trim()) ||
        auth.user.user_metadata?.full_name ||
        null,
    },
    ...dashboard,
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }

  return response;
}
