import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { jsonError, setAuthCookies } from '../../auth/_shared';
import { requireAuthenticatedUser } from '../_auth';

type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'inactive'
  | 'unknown';

type SubscriptionResponse = {
  id: string | null;
  plan: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  createdAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  hasActiveAccess: boolean;
  isPaid: boolean;
};

const ACTIVE_ACCESS_STATUSES = new Set<SubscriptionStatus>(['active']);

const FREE_PLAN: SubscriptionResponse = {
  id: null,
  plan: 'Free',
  status: 'inactive',
  currentPeriodEnd: null,
  createdAt: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  hasActiveAccess: false,
  isPaid: false,
};

function normalizeStatus(status: unknown): SubscriptionStatus {
  if (typeof status !== 'string') return 'inactive';
  const normalized = status.trim().toLowerCase();

  if (
    normalized === 'active' ||
    normalized === 'trialing' ||
    normalized === 'past_due' ||
    normalized === 'canceled' ||
    normalized === 'incomplete' ||
    normalized === 'incomplete_expired' ||
    normalized === 'unpaid' ||
    normalized === 'inactive'
  ) {
    return normalized;
  }

  return 'unknown';
}

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const admin = createSupabaseServerClient();
  const { data, error } = await admin
    .from('subscriptions')
    .select('id,user_id,current_period_end,created_at,plan,status,stripe_customer_id,stripe_subscription_id')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    const isMissingTable =
      error.code === 'PGRST205' ||
      error.code === '42P01' ||
      /relation .*subscriptions.* does not exist/i.test(error.message);
    if (!isMissingTable) {
      return jsonError('Failed to load subscription.', 500);
    }
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  const normalizedStatus = normalizeStatus(row?.status);
  const hasActiveAccess = ACTIVE_ACCESS_STATUSES.has(normalizedStatus);
  const plan = typeof row?.plan === 'string' && row.plan.trim() ? row.plan.trim() : 'Free';
  const isPaid = hasActiveAccess && plan.toLowerCase() !== 'free';

  const subscription: SubscriptionResponse = row
    ? {
        id: typeof row.id === 'string' ? row.id : null,
        plan,
        status: normalizedStatus,
        currentPeriodEnd: typeof row.current_period_end === 'string' ? row.current_period_end : null,
        createdAt: typeof row.created_at === 'string' ? row.created_at : null,
        stripeCustomerId: typeof row.stripe_customer_id === 'string' ? row.stripe_customer_id : null,
        stripeSubscriptionId:
          typeof row.stripe_subscription_id === 'string' ? row.stripe_subscription_id : null,
        hasActiveAccess,
        isPaid,
      }
    : FREE_PLAN;

  const response = NextResponse.json({
    subscription,
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }

  return response;
}
