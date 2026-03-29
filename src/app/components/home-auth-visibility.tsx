'use client';

import type { ReactNode } from 'react';

import { useAuth } from '@/components/auth-provider';

export function ShowWhenLoggedOut({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading || user) {
    return null;
  }
  return <>{children}</>;
}

export function ShowWhenLoggedIn({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading || !user) {
    return null;
  }
  return <>{children}</>;
}

export function ShowWhenNotPaid({ children }: { children: ReactNode }) {
  const { user, isLoading, hasPaidAccess, isSubscriptionLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <>{children}</>;
  if (isSubscriptionLoading) return null;
  if (hasPaidAccess) return null;

  return <>{children}</>;
}
