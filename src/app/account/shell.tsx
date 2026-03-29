'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { useAuth } from '@/components/auth-provider';

const NAV_ITEMS = [
  { href: '/account', label: 'Overview' },
  { href: '/account/settings', label: 'Settings' },
  { href: '/account/subscription', label: 'Subscription' },
  { href: '/account/change-password', label: 'Change password' },
];

export default function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || user) return;
    const next = pathname && pathname.startsWith('/') ? pathname : '/account/settings';
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [isLoading, pathname, router, user]);

  if (isLoading || !user) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8">
          <p className="text-sm text-[rgb(var(--muted))]">Loading account...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4">
          <div className="border-b border-[rgb(var(--border))] px-2 pb-3">
            <p className="text-sm font-semibold text-[rgb(var(--text))]">{profile?.fullName || 'Account'}</p>
            <p className="truncate text-xs text-[rgb(var(--muted))]">{user.email}</p>
          </div>
          <nav className="mt-3 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? 'bg-[rgb(var(--accent-soft))] font-semibold text-[rgb(var(--accent))]'
                      : 'text-[rgb(var(--text))] hover:bg-[rgb(var(--accent-soft))]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
          {children}
        </section>
      </div>
    </main>
  );
}
