'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { type CategoryId } from '@/app/interview-questions/topics-by-category';

type ProgressQuestion = {
  id: string;
  title: string;
  slug: string | null;
  difficulty: 'junior' | 'mid' | 'senior';
  freePreview: boolean;
  topicId: string;
  topic: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

type ProgressItem = {
  id: string;
  questionId: string;
  completed: boolean;
  bookmarked: boolean;
  lastViewed: string | null;
  question?: ProgressQuestion;
};

type ProgressResponse = {
  total?: number;
  completedCount?: number;
  bookmarkedCount?: number;
  items?: ProgressItem[];
  error?: string;
};

type CategoryLookupResponse = {
  items?: Array<{ slug?: string; category?: string | null }>;
};

function formatLastViewed(value: string | null): string {
  if (!value) return 'Not viewed yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getQuestionHref(item: ProgressItem, categoryByTopicSlug: Map<string, CategoryId>): string {
  const topicSlug = item.question?.topic?.slug;
  if (topicSlug) {
    const category = categoryByTopicSlug.get(topicSlug);
    if (category) {
      return `/interview-questions/${category}/${topicSlug}#questions`;
    }
  }

  if (item.question?.title) {
    return `/interview-questions?q=${encodeURIComponent(item.question.title)}#questions`;
  }

  return '/interview-questions#questions';
}

function ProgressList({
  title,
  emptyLabel,
  items,
  categoryByTopicSlug,
}: {
  title: string;
  emptyLabel: string;
  items: ProgressItem[];
  categoryByTopicSlug: Map<string, CategoryId>;
}) {
  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
      <p className="text-sm font-semibold text-[rgb(var(--text))]">{title}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[rgb(var(--muted))]">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 8).map((item) => (
            <li key={item.id} className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-3">
              <Link
                href={getQuestionHref(item, categoryByTopicSlug)}
                className="text-sm font-medium text-[rgb(var(--text))] hover:text-[rgb(var(--accent))] hover:underline"
              >
                {item.question?.title ?? 'View question'}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--muted))]">
                <span className="capitalize">{item.question?.difficulty ?? 'unknown'}</span>
                <span>•</span>
                <span>{item.question?.topic?.name ?? 'General topic'}</span>
                <span>•</span>
                <span>Viewed {formatLastViewed(item.lastViewed)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MyProgressPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ProgressItem[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [bookmarkedCount, setBookmarkedCount] = useState(0);
  const [categoryByTopicSlug, setCategoryByTopicSlug] = useState<Map<string, CategoryId>>(
    () => new Map(),
  );

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/progress?details=1&limit=200', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json()) as ProgressResponse;

        if (!isMounted) return;
        if (!response.ok) {
          setError(payload.error ?? 'Failed to load progress.');
          setItems([]);
          return;
        }

        const nextItems = Array.isArray(payload.items) ? payload.items : [];
        setItems(nextItems);
        setCompletedCount(
          typeof payload.completedCount === 'number'
            ? payload.completedCount
            : nextItems.filter((item) => item.completed).length,
        );
        setBookmarkedCount(
          typeof payload.bookmarkedCount === 'number'
            ? payload.bookmarkedCount
            : nextItems.filter((item) => item.bookmarked).length,
        );
      } catch {
        if (!isMounted) return;
        setError('Failed to load progress.');
        setItems([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void load();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadCategoryLookup = async () => {
      try {
        const response = await fetch('/api/categories', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) return;

        const payload = (await response.json()) as CategoryLookupResponse;
        if (!isMounted || !Array.isArray(payload.items)) return;

        const nextLookup = new Map<string, CategoryId>();
        payload.items.forEach((item) => {
          if (!item || typeof item.slug !== 'string' || typeof item.category !== 'string') {
            return;
          }
          if (
            item.category === 'fullstack' ||
            item.category === 'dsa' ||
            item.category === 'system-design' ||
            item.category === 'ml'
          ) {
            nextLookup.set(item.slug, item.category);
          }
        });

        setCategoryByTopicSlug(nextLookup);
      } catch {
        // Keep fallback routing when lookup fails.
      }
    };

    void loadCategoryLookup();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const completedItems = useMemo(() => items.filter((item) => item.completed), [items]);
  const bookmarkedItems = useMemo(() => items.filter((item) => item.bookmarked), [items]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5">
        <p className="text-sm text-[rgb(var(--muted))]">Loading your progress...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5">
        <h2 className="text-lg font-semibold text-[rgb(var(--text))]">My Progress</h2>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Track completed and bookmarked interview questions from your prep sessions.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-[rgb(var(--border))] px-3 py-1 text-[rgb(var(--muted))]">
            Total tracked: {items.length}
          </span>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-700 dark:text-emerald-400">
            Completed: {completedCount}
          </span>
          <span className="rounded-full border border-[rgb(var(--accent))]/40 bg-[rgb(var(--accent))]/10 px-3 py-1 text-[rgb(var(--accent))]">
            Bookmarked: {bookmarkedCount}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProgressList
          title="Completed Questions"
          emptyLabel="No completed questions yet."
          items={completedItems}
          categoryByTopicSlug={categoryByTopicSlug}
        />
        <ProgressList
          title="Bookmarked Questions"
          emptyLabel="No bookmarked questions yet."
          items={bookmarkedItems}
          categoryByTopicSlug={categoryByTopicSlug}
        />
      </div>
    </div>
  );
}
