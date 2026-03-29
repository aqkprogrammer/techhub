'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export type AuthUser = {
  id: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  appMetadata: Record<string, unknown> | null;
  userMetadata: Record<string, unknown> | null;
};

export type AuthProfile = {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  role: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthSubscription = {
  id: string | null;
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  hasActiveAccess: boolean;
  isPaid: boolean;
};

type MeResponse = {
  user?: AuthUser | null;
  profile?: AuthProfile | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  profile: AuthProfile | null;
  subscription: AuthSubscription | null;
  isLoading: boolean;
  hasPaidAccess: boolean;
  isSubscriptionLoading: boolean;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  subscription: null,
  isLoading: true,
  hasPaidAccess: false,
  isSubscriptionLoading: false,
  refreshAuth: async () => undefined,
  signOut: async () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [subscription, setSubscription] = useState<AuthSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPaidAccess, setHasPaidAccess] = useState(false);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);

  const refreshAuth = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'same-origin',
        signal,
      });

      if (!response.ok) {
        setUser(null);
        setProfile(null);
        return;
      }

      const payload = (await response.json()) as MeResponse;
      setUser(payload.user ?? null);
      setProfile(payload.profile ?? null);
    } catch {
      setUser(null);
      setProfile(null);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      // Ignore network errors and clear local session regardless.
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSubscription(null);
    setHasPaidAccess(false);
    setIsSubscriptionLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const load = async () => {
      await refreshAuth(controller.signal);
      if (isMounted) setIsLoading(false);
    };

    load();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [refreshAuth]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setSubscription(null);
      setHasPaidAccess(false);
      setIsSubscriptionLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const loadSubscription = async () => {
      setIsSubscriptionLoading(true);
      try {
        const response = await fetch('/api/account/subscription', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          if (isMounted) setHasPaidAccess(false);
          return;
        }

        const payload = (await response.json().catch(() => null)) as
          | {
              subscription?: {
                id?: string | null;
                plan?: string;
                status?: string;
                currentPeriodEnd?: string | null;
                hasActiveAccess?: boolean;
                isPaid?: boolean;
              };
            }
          | null;

        if (!isMounted) return;
        const nextSubscription: AuthSubscription | null = payload?.subscription
          ? {
              id:
                typeof payload.subscription.id === 'string' ||
                payload.subscription.id === null
                  ? payload.subscription.id
                  : null,
              plan:
                typeof payload.subscription.plan === 'string'
                  ? payload.subscription.plan
                  : 'Free',
              status:
                typeof payload.subscription.status === 'string'
                  ? payload.subscription.status
                  : 'inactive',
              currentPeriodEnd:
                typeof payload.subscription.currentPeriodEnd === 'string' ||
                payload.subscription.currentPeriodEnd === null
                  ? payload.subscription.currentPeriodEnd
                  : null,
              hasActiveAccess: Boolean(payload.subscription.hasActiveAccess),
              isPaid: Boolean(payload.subscription.isPaid),
            }
          : null;

        setSubscription(nextSubscription);
        setHasPaidAccess(
          Boolean(nextSubscription?.hasActiveAccess) &&
            Boolean(nextSubscription?.isPaid),
        );
      } catch {
        if (isMounted) {
          setSubscription(null);
          setHasPaidAccess(false);
        }
      } finally {
        if (isMounted) {
          setIsSubscriptionLoading(false);
        }
      }
    };

    void loadSubscription();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isLoading, user?.id]);

  const value = useMemo(
    () => ({
      user,
      profile,
      subscription,
      isLoading,
      hasPaidAccess,
      isSubscriptionLoading,
      refreshAuth: async () => {
        await refreshAuth();
      },
      signOut,
    }),
    [
      user,
      profile,
      subscription,
      isLoading,
      hasPaidAccess,
      isSubscriptionLoading,
      refreshAuth,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
