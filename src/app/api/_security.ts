import type { Session, User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { jsonError, setAuthCookies } from './auth/_shared';
import { requireAuthenticatedUser } from './account/_auth';

type RequireAuthResult =
  | {
      ok: true;
      user: User;
      session: Session | null;
      supabase: ReturnType<typeof createSupabaseServerClient>;
    }
  | {
      ok: false;
      response: NextResponse;
    };

type SubscriptionRow = {
  status?: string | null;
  plan?: string | null;
  is_lifetime?: boolean | null;
  expires_at?: string | null;
  current_period_end?: string | null;
};

export async function requireApiUser(request: Request): Promise<RequireAuthResult> {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return { ok: false, response: auth.response };

  return {
    ok: true,
    user: auth.user,
    session: auth.session,
    supabase: createSupabaseServerClient(),
  };
}

function normalizeStatus(value: unknown): string {
  if (typeof value !== 'string') return 'inactive';
  return value.trim().toLowerCase();
}

export function hasPaidSubscription(row: SubscriptionRow | null): boolean {
  if (!row) return false;

  const status = normalizeStatus(row.status);
  const activeByStatus = status === 'active';
  const plan = typeof row.plan === 'string' ? row.plan.trim().toLowerCase() : '';
  const nonFreePlan = plan !== '' && plan !== 'free' && plan !== 'trial';

  return activeByStatus && nonFreePlan;
}

export async function requirePaidApiUser(request: Request): Promise<RequireAuthResult> {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth;

  const { data, error } = await auth.supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    return {
      ok: false,
      response: jsonError('Failed to verify subscription.', 500),
    };
  }

  const subscriptionRow = (Array.isArray(data) ? data[0] : null) as SubscriptionRow | null;
  if (!hasPaidSubscription(subscriptionRow)) {
    const response = jsonError('Active paid subscription required.', 402);
    if (auth.session) {
      setAuthCookies(response, auth.session);
    }
    return {
      ok: false,
      response,
    };
  }

  return auth;
}
