'use client';

import { useMemo } from 'react';

import { useAuth } from '@/components/auth-provider';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'inactive'
  | 'unknown';

export function useSubscription() {
  const {
    user,
    isLoading: isAuthLoading,
    isSubscriptionLoading,
    subscription,
    hasPaidAccess,
  } = useAuth();

  return useMemo(() => {
    const status = (subscription?.status ?? 'inactive') as SubscriptionStatus;
    const isLoading = isAuthLoading || (Boolean(user) && isSubscriptionLoading);
    const hasActiveAccess = status === 'active' && hasPaidAccess;

    return {
      subscription,
      status,
      isLoading,
      hasActiveAccess,
      isPaid: hasActiveAccess,
    };
  }, [hasPaidAccess, isAuthLoading, isSubscriptionLoading, subscription, user]);
}

