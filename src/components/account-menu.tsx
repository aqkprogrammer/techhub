'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from './auth-provider';

function getDisplayName(email: string | null, fullName: string | null) {
  if (fullName?.trim()) return fullName.trim();
  if (email) return email.split('@')[0];
  return 'Account';
}

function getInitial(displayName: string) {
  const trimmed = displayName.trim();
  if (!trimmed) return 'A';
  return trimmed[0]?.toUpperCase() ?? 'A';
}

export default function AccountMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, isLoading, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const displayName = useMemo(
    () => getDisplayName(user?.email ?? null, profile?.fullName ?? null),
    [profile?.fullName, user?.email],
  );

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      const target = event.target;
      if (target instanceof Node && !wrapperRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const onSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
    setIsOpen(false);
    router.push('/login');
    router.refresh();
  };

  if (isLoading) {
    return (
      <div className="h-10 w-10 animate-pulse rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))]" />
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-2 rounded-full border border-[rgb(var(--border))] px-4 py-2 text-sm font-semibold text-[rgb(var(--text))] transition hover:border-[rgb(var(--accent))]"
      >
        <span className="text-base font-normal">G</span> Sign in
      </Link>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-2 py-1.5 transition hover:border-[rgb(var(--accent))]"
      >
        {profile?.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={displayName}
            className="h-7 w-7 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgb(var(--accent-soft))] text-xs font-bold text-[rgb(var(--accent))]">
            {getInitial(displayName)}
          </span>
        )}
        <span className="hidden max-w-[9rem] truncate pr-1 text-sm font-semibold text-[rgb(var(--text))] sm:inline">
          {displayName}
        </span>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-1 shadow-lg"
        >
          <div className="border-b border-[rgb(var(--border))] px-3 py-2">
            <p className="truncate text-sm font-semibold text-[rgb(var(--text))]">{displayName}</p>
            <p className="truncate text-xs text-[rgb(var(--muted))]">{user.email}</p>
          </div>
          <Link
            href="/dashboard"
            role="menuitem"
            className="block rounded-lg px-3 py-2 text-sm text-[rgb(var(--text))] transition hover:bg-[rgb(var(--accent-soft))]"
          >
            Dashboard
          </Link>
          <Link
            href="/bookmarks"
            role="menuitem"
            className="block rounded-lg px-3 py-2 text-sm text-[rgb(var(--text))] transition hover:bg-[rgb(var(--accent-soft))]"
          >
            Bookmarks
          </Link>
          <Link
            href="/daily-question"
            role="menuitem"
            className="block rounded-lg px-3 py-2 text-sm text-[rgb(var(--text))] transition hover:bg-[rgb(var(--accent-soft))]"
          >
            Daily question
          </Link>
          <Link
            href="/ai-interview"
            role="menuitem"
            className="block rounded-lg px-3 py-2 text-sm text-[rgb(var(--text))] transition hover:bg-[rgb(var(--accent-soft))]"
          >
            AI interview
          </Link>
          <Link
            href="/account/settings"
            role="menuitem"
            className="block rounded-lg px-3 py-2 text-sm text-[rgb(var(--text))] transition hover:bg-[rgb(var(--accent-soft))]"
          >
            Settings
          </Link>
          <Link
            href="/account/subscription"
            role="menuitem"
            className="block rounded-lg px-3 py-2 text-sm text-[rgb(var(--text))] transition hover:bg-[rgb(var(--accent-soft))]"
          >
            Subscription
          </Link>
          <Link
            href="/account/change-password"
            role="menuitem"
            className="block rounded-lg px-3 py-2 text-sm text-[rgb(var(--text))] transition hover:bg-[rgb(var(--accent-soft))]"
          >
            Change password
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={onSignOut}
            disabled={isSigningOut}
            className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
          >
            {isSigningOut ? 'Signing out...' : 'Logout'}
          </button>
        </div>
      )}
    </div>
  );
}
