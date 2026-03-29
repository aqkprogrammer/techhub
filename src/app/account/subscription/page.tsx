'use client';

import { useEffect, useMemo, useState } from 'react';

import UnlockModal from '@/components/unlock-modal';

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

type Subscription = {
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

type SubscriptionResponse = {
  subscription?: Subscription;
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleDateString();
}

function maskIdentifier(value: string | null) {
  if (!value) return 'N/A';
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function statusBadgeClasses(status: SubscriptionStatus) {
  if (status === 'active' || status === 'trialing') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (status === 'past_due' || status === 'unpaid') {
    return 'bg-amber-100 text-amber-700';
  }
  if (status === 'canceled' || status === 'inactive') {
    return 'bg-slate-100 text-slate-700';
  }
  return 'bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent))]';
}

export default function AccountSubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pricingOpen, setPricingOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/account/subscription', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json()) as SubscriptionResponse;

        if (!isMounted) return;
        if (!response.ok) {
          setError(payload.error ?? 'Failed to load subscription.');
          setSubscription(null);
          return;
        }

        setSubscription(payload.subscription ?? null);
      } catch {
        if (!isMounted) return;
        setError('Failed to load subscription.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (!subscription) return 'inactive';
    return subscription.status.split('_').join(' ');
  }, [subscription]);

  if (isLoading) {
    return <p className="text-sm text-[rgb(var(--muted))]">Loading subscription...</p>;
  }

  if (error) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  if (!subscription) {
    return <p className="text-sm text-[rgb(var(--muted))]">No subscription data available.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[rgb(var(--text))]">Subscription</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Live billing details from your subscriptions table.
        </p>
      </div>

      <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[rgb(var(--muted))]">Current plan</p>
            <p className="mt-1 text-2xl font-semibold text-[rgb(var(--text))]">{subscription.plan}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusBadgeClasses(
              subscription.status,
            )}`}
          >
            {statusLabel}
          </span>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[rgb(var(--muted))]">Current period end</dt>
            <dd className="mt-1 text-sm font-medium text-[rgb(var(--text))]">
              {formatDate(subscription.currentPeriodEnd)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[rgb(var(--muted))]">Subscription created</dt>
            <dd className="mt-1 text-sm font-medium text-[rgb(var(--text))]">
              {formatDate(subscription.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[rgb(var(--muted))]">Access</dt>
            <dd className="mt-1 text-sm font-medium text-[rgb(var(--text))]">
              {subscription.hasActiveAccess ? 'Active access' : 'No active access'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[rgb(var(--muted))]">Stripe customer</dt>
            <dd className="mt-1 text-sm font-medium text-[rgb(var(--text))]">
              {maskIdentifier(subscription.stripeCustomerId)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[rgb(var(--muted))]">Stripe subscription</dt>
            <dd className="mt-1 text-sm font-medium text-[rgb(var(--text))]">
              {maskIdentifier(subscription.stripeSubscriptionId)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[rgb(var(--muted))]">Subscription record ID</dt>
            <dd className="mt-1 text-sm font-medium text-[rgb(var(--text))]">
              {maskIdentifier(subscription.id)}
            </dd>
          </div>
        </dl>
      </div>

      {!subscription.hasActiveAccess && (
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5">
          <h2 className="text-lg font-semibold text-[rgb(var(--text))]">Unlock full answers</h2>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            Upgrade to access premium deep explanations, follow-ups, and all senior-level question sets.
          </p>
          <button
            type="button"
            onClick={() => setPricingOpen(true)}
            className="mt-4 inline-flex rounded-lg bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white"
          >
            View pricing
          </button>
        </div>
      )}
      <UnlockModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
    </div>
  );
}
