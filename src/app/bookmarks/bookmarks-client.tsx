'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/auth-provider';

type BookmarkItem = {
  id: string;
  questionId: string;
  createdAt: string | null;
  question: {
    id: string;
    title: string;
    slug: string | null;
    difficulty: string;
    freePreview: boolean;
    topic: {
      id: string;
      name: string;
      slug: string;
    };
  };
};

type BookmarkResponse = {
  total?: number;
  items?: BookmarkItem[];
  error?: string;
};

export default function BookmarksClient() {
  const { user, isLoading } = useAuth();
  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingQuestionId, setRemovingQuestionId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setLoading(false);
      setItems([]);
      return;
    }

    let active = true;
    const controller = new AbortController();

    const loadBookmarks = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/bookmarks?limit=100', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as BookmarkResponse | null;
        if (!active) return;
        if (!response.ok) {
          setError(payload?.error ?? 'Failed to load bookmarks.');
          setItems([]);
          return;
        }

        setItems(Array.isArray(payload?.items) ? payload!.items : []);
      } catch {
        if (!active) return;
        setError('Failed to load bookmarks.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadBookmarks();

    return () => {
      active = false;
      controller.abort();
    };
  }, [isLoading, user]);

  const removeBookmark = async (questionId: string) => {
    setRemovingQuestionId(questionId);
    setError(null);
    try {
      const response = await fetch(`/api/bookmarks?questionId=${encodeURIComponent(questionId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Failed to remove bookmark.');
      }
      setItems((current) => current.filter((item) => item.questionId !== questionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove bookmark.');
    } finally {
      setRemovingQuestionId(null);
    }
  };

  const emptyState = useMemo(() => {
    if (isLoading || loading) return 'Loading bookmarks...';
    if (!user) return 'Sign in to view your bookmarks.';
    return 'You have no bookmarked questions yet.';
  }, [isLoading, loading, user]);

  if (isLoading || loading) {
    return (
      <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
        <p className="text-sm text-[rgb(var(--muted))]">Loading bookmarks...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
        <p className="text-sm text-[rgb(var(--muted))]">{emptyState}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
          <p className="text-sm text-[rgb(var(--muted))]">{emptyState}</p>
        </div>
      ) : (
        items.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[rgb(var(--muted))]">
                  {item.question.topic.name} · {item.question.difficulty}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[rgb(var(--text))]">
                  {item.question.title}
                </h2>
              </div>
              <span
                className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                  item.question.freePreview
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                }`}
              >
                {item.question.freePreview ? 'Free' : 'Premium'}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href={`/interview-questions?q=${encodeURIComponent(item.question.title)}#questions`}
                className="rounded-lg bg-[rgb(var(--accent))] px-3 py-2 text-sm font-semibold text-white"
              >
                Open question
              </Link>
              <button
                type="button"
                onClick={() => void removeBookmark(item.questionId)}
                disabled={removingQuestionId === item.questionId}
                className="rounded-lg border border-[rgb(var(--border))] px-3 py-2 text-sm font-medium text-[rgb(var(--text))] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removingQuestionId === item.questionId ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
