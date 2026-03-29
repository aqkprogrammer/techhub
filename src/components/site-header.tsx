'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';

import AccountMenu from './account-menu';
import { useAuth } from './auth-provider';
import ThemeToggle from './theme-toggle';
import UnlockModal from './unlock-modal';

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, hasPaidAccess, isSubscriptionLoading } = useAuth();
  const [pricingOpen, setPricingOpen] = useState(false);
  const isQuestions = pathname === '/interview-questions' || pathname?.startsWith('/interview-questions/');
  const hiring = isQuestions && searchParams.get('hiring') === 'true';

  const setHiring = useCallback(
    (value: boolean) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set('hiring', 'true');
      else next.delete('hiring');
      const query = next.toString();
      router.push(query ? `${pathname}?${query}` : pathname ?? '/');
    },
    [pathname, router, searchParams],
  );

  return (
    <header className="sticky top-0 z-50 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg))]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))]">
            <span className="text-sm font-semibold text-[rgb(var(--accent))]">th</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[rgb(var(--text))]">techhub.cafe</span>
            <span className="text-xs text-[rgb(var(--muted))]">Developer SaaS</span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {isQuestions && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[rgb(var(--muted))]">
              <span className="hidden sm:inline">I&apos;m Hiring Devs</span>
              <input
                type="checkbox"
                checked={hiring}
                onChange={(e) => setHiring(e.target.checked)}
                className="h-4 w-4 rounded border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--accent))] focus:ring-[rgb(var(--accent))]"
                aria-label="I'm Hiring Devs"
              />
            </label>
          )}
          {(!user || (!hasPaidAccess && !isSubscriptionLoading)) && (
            <button
              type="button"
              onClick={() => setPricingOpen(true)}
              className="rounded-full bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Unlock answers
            </button>
          )}
          <AccountMenu />
          <ThemeToggle />
        </div>
      </div>
      <UnlockModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
    </header>
  );
}
