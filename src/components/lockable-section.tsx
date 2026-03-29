'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import { useAuth } from './auth-provider';

type LockableSectionProps = {
  title: string;
  locked: boolean;
  children: ReactNode;
  className?: string;
};

export default function LockableSection({ title, locked, children, className = '' }: LockableSectionProps) {
  const { user, isLoading, hasPaidAccess, isSubscriptionLoading } = useAuth();
  const isLocked = locked && (isLoading || isSubscriptionLoading || !hasPaidAccess);

  if (!isLocked) {
    return (
      <section className={`w-full min-w-0 max-w-full ${className}`}>
        <h3 className="text-lg font-semibold text-[rgb(var(--text))]">{title}</h3>
        <div className="mt-3 w-full min-w-0 max-w-full overflow-hidden">{children}</div>
      </section>
    );
  }

  return (
    <section className={`relative w-full min-w-0 max-w-full ${className}`}>
      <h3 className="text-lg font-semibold text-[rgb(var(--text))]">{title}</h3>
      <div className="relative mt-3 w-full min-w-0 max-w-full">
        <div className="select-none overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] blur-sm [filter:blur(8px)]">
          {children}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))]/90 backdrop-blur-sm">
          <span className="text-4xl" aria-hidden>
            🔒
          </span>
          <p className="text-center text-sm font-medium text-[rgb(var(--muted))]">
            Unlock with a Pro subscription to view this section.
          </p>
          <Link
            href={user ? '/pricing' : '/login'}
            className="rounded-full bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {user ? 'View pricing' : 'Upgrade to Pro'}
          </Link>
        </div>
      </div>
    </section>
  );
}
