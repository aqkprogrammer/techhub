'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

type SocialProofItem = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  countryCode: string | null;
  countryFlag: string | null;
  planLabel: string;
  provider: string;
  purchasedAt: string | null;
  isSynthetic?: boolean;
};

type SocialProofResponse = {
  items?: SocialProofItem[];
};

const FALLBACK_NAMES = ['Giovanna', 'Arjun', 'Maya', 'Luca', 'Riya', 'Noah'];
const FALLBACK_COUNTRIES = [
  { code: 'PT', flag: '🇵🇹' },
  { code: 'IN', flag: '🇮🇳' },
  { code: 'US', flag: '🇺🇸' },
  { code: 'DE', flag: '🇩🇪' },
  { code: 'CA', flag: '🇨🇦' },
];
const FALLBACK_PLANS = ['Lifetime', 'Pro', 'Premium', 'Pro+'];
const FALLBACK_PROVIDERS = ['Stripe', 'Razorpay', 'PayPal'];
const STORAGE_LAST_SEEN_REAL_PURCHASE_MS = 'th_social_proof_last_seen_real_purchase_ms';
const SHOW_WINDOW_MS = 60_000;
const POLL_INTERVAL_MS = 45_000;
const DISPLAY_MS = 5200;
const HIDE_MS = 900;

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function createFallbackItems(size = 6): SocialProofItem[] {
  return Array.from({ length: size }, (_, index) => {
    const country = randomFrom(FALLBACK_COUNTRIES);
    const minutesAgo = Math.floor(Math.random() * (5 * 24 * 60)) + 2;
    return {
      id: `local-fallback-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      displayName: randomFrom(FALLBACK_NAMES),
      avatarUrl: null,
      countryCode: country.code,
      countryFlag: country.flag,
      planLabel: randomFrom(FALLBACK_PLANS),
      provider: randomFrom(FALLBACK_PROVIDERS),
      purchasedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
      isSynthetic: true,
    };
  });
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

function toEpoch(value: string | null): number | null {
  if (!value) return null;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? epoch : null;
}

function getNewestRealPurchaseMs(items: SocialProofItem[]): number | null {
  return items.reduce<number | null>((latest, item) => {
    if (item.isSynthetic) return latest;
    const epoch = toEpoch(item.purchasedAt);
    if (epoch === null) return latest;
    if (latest === null || epoch > latest) return epoch;
    return latest;
  }, null);
}

function createRotationPool(items: SocialProofItem[]): SocialProofItem[] {
  if (items.length <= 4) return [...items];
  return shuffle(items).slice(0, 4);
}

function formatAgo(timestamp: string | null): string {
  if (!timestamp) return 'recently';

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'recently';

  const diffMs = Date.now() - date.getTime();
  if (diffMs <= 0) return 'just now';

  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

function pickNextIndex(length: number, current: number): number {
  if (length <= 1) return 0;
  let next = Math.floor(Math.random() * length);
  while (next === current) {
    next = Math.floor(Math.random() * length);
  }
  return next;
}

export default function PurchaseSocialProofToast() {
  const pathname = usePathname();
  const [items, setItems] = useState<SocialProofItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [rotationItems, setRotationItems] = useState<SocialProofItem[]>([]);
  const [windowExpiresAt, setWindowExpiresAt] = useState<number | null>(null);
  const [isWindowActive, setIsWindowActive] = useState(false);
  const [lastSeenRealPurchaseMs, setLastSeenRealPurchaseMs] = useState<number | null>(null);
  const hasShownInitialRef = useRef(false);

  const hideOnPath = useMemo(() => {
    if (!pathname) return false;
    return (
      pathname.startsWith('/admin') ||
      pathname.startsWith('/account') ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/signup') ||
      pathname.startsWith('/auth/callback')
    );
  }, [pathname]);

  const startDisplayWindow = useCallback((nextItems: SocialProofItem[]) => {
    const pool = createRotationPool(nextItems);
    if (pool.length === 0) return;
    setItems(nextItems);
    setRotationItems(pool);
    setActiveIndex(Math.floor(Math.random() * pool.length));
    setVisible(true);
    setIsWindowActive(true);
    setWindowExpiresAt(Date.now() + SHOW_WINDOW_MS);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(STORAGE_LAST_SEEN_REAL_PURCHASE_MS);
    const parsed = raw ? Number(raw) : Number.NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      setLastSeenRealPurchaseMs(parsed);
    }
  }, []);

  useEffect(() => {
    if (!hideOnPath) return;
    setVisible(false);
    setIsWindowActive(false);
  }, [hideOnPath]);

  useEffect(() => {
    if (hideOnPath || dismissed) return;

    let cancelled = false;

    const fetchItems = async () => {
      try {
        const response = await fetch('/api/social-proof?limit=10', {
          method: 'GET',
          cache: 'no-store',
        });

        if (!response.ok) {
          const localFallback = createFallbackItems(6);
          if (cancelled) return;
          if (!hasShownInitialRef.current) {
            hasShownInitialRef.current = true;
            startDisplayWindow(localFallback);
          } else if (isWindowActive) {
            setItems(localFallback);
            setRotationItems(createRotationPool(localFallback));
          }
          return;
        }

        const payload = (await response.json()) as SocialProofResponse;
        const nextItems = Array.isArray(payload.items) ? payload.items : [];
        const safeItems =
          nextItems.length >= 4
            ? nextItems
            : [...nextItems, ...createFallbackItems(6)].slice(0, 10);
        if (cancelled) return;
        const newestRealPurchaseMs = getNewestRealPurchaseMs(safeItems);
        const hasNewRealPurchase =
          newestRealPurchaseMs !== null &&
          (lastSeenRealPurchaseMs === null ||
            newestRealPurchaseMs > lastSeenRealPurchaseMs);

        if (hasNewRealPurchase) {
          setLastSeenRealPurchaseMs(newestRealPurchaseMs);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(
              STORAGE_LAST_SEEN_REAL_PURCHASE_MS,
              String(newestRealPurchaseMs)
            );
          }
          startDisplayWindow(safeItems);
          return;
        }

        if (!hasShownInitialRef.current) {
          hasShownInitialRef.current = true;
          if (newestRealPurchaseMs !== null) {
            setLastSeenRealPurchaseMs(newestRealPurchaseMs);
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(
                STORAGE_LAST_SEEN_REAL_PURCHASE_MS,
                String(newestRealPurchaseMs)
              );
            }
          }
          startDisplayWindow(safeItems);
          return;
        }

        if (isWindowActive) {
          setItems(safeItems);
          setRotationItems(createRotationPool(safeItems));
        }
      } catch {
        if (cancelled) return;
        if (!hasShownInitialRef.current) {
          hasShownInitialRef.current = true;
          startDisplayWindow(createFallbackItems(6));
        }
      }
    };

    void fetchItems();
    const refreshInterval = window.setInterval(() => {
      void fetchItems();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [
    hideOnPath,
    dismissed,
    isWindowActive,
    lastSeenRealPurchaseMs,
    startDisplayWindow,
  ]);

  useEffect(() => {
    if (hideOnPath || dismissed || !isWindowActive || items.length === 0) return;

    const pool = createRotationPool(items);
    setRotationItems(pool);
    setActiveIndex(Math.floor(Math.random() * pool.length));
    setVisible(true);
  }, [hideOnPath, dismissed, isWindowActive, items]);

  useEffect(() => {
    if (!isWindowActive || windowExpiresAt === null) return;

    const remainingMs = windowExpiresAt - Date.now();
    let deactivateTimerId: number | null = null;
    if (remainingMs <= 0) {
      setVisible(false);
      const quickHideTimer = window.setTimeout(() => {
        setIsWindowActive(false);
      }, 300);
      return () => {
        window.clearTimeout(quickHideTimer);
      };
    }

    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      deactivateTimerId = window.setTimeout(() => {
        setIsWindowActive(false);
      }, 320);
    }, remainingMs);

    return () => {
      window.clearTimeout(hideTimer);
      if (deactivateTimerId !== null) {
        window.clearTimeout(deactivateTimerId);
      }
    };
  }, [isWindowActive, windowExpiresAt]);

  useEffect(() => {
    if (hideOnPath || dismissed || !isWindowActive || rotationItems.length === 0) return;

    const cycleMs = DISPLAY_MS + HIDE_MS;

    const intervalId = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setActiveIndex((current) => pickNextIndex(rotationItems.length, current));
        setVisible(true);
      }, HIDE_MS);
    }, cycleMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hideOnPath, dismissed, isWindowActive, rotationItems.length]);

  if (hideOnPath || dismissed || !isWindowActive || rotationItems.length === 0) return null;

  const active = rotationItems[activeIndex];
  if (!active) return null;

  const initials = active.displayName.trim().slice(0, 1).toUpperCase() || 'U';

  return (
    <div
      className={`pointer-events-none fixed bottom-6 left-6 z-[70] max-w-[min(92vw,520px)] transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="pointer-events-auto relative rounded-2xl border border-white/10 bg-[#2f3136] px-4 py-3 text-white shadow-2xl">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-2 rounded p-1 text-xs text-white/70 transition hover:text-white"
          aria-label="Dismiss social proof notification"
        >
          ✕
        </button>
        <div className="flex items-center gap-3 pr-5">
          {active.avatarUrl ? (
            <img
              src={active.avatarUrl}
              alt={active.displayName}
              className="h-16 w-16 rounded-full border-2 border-white/80 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/80 bg-white/10 text-xl font-bold">
              {initials}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-1 text-[11px] font-semibold text-amber-300">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              New purchase
            </p>
            <p className="text-lg font-semibold leading-snug">
              <span className="font-bold">{active.displayName}</span>
              <span className="font-normal text-white/85"> from </span>
              <span className="font-normal">
                {active.countryFlag ? `${active.countryFlag} ` : ''}
                {active.countryCode || 'global'}
              </span>
              <span className="font-normal text-white/85"> unlocked </span>
              <span className="font-bold">{active.planLabel}</span>
              <span className="font-normal text-white/85"> access {formatAgo(active.purchasedAt)}!</span>
            </p>
            <p className="mt-2 text-sm italic text-white/75">
              Verified by <span className="font-semibold not-italic">{active.provider}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
