'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';

type DailyQuestionPayload = {
  date: string;
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
  error?: string;
};

export default function DailyQuestionPage() {
  const { user, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daily, setDaily] = useState<DailyQuestionPayload | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setLoading(false);
      setError('Sign in to view your daily question.');
      return;
    }

    let active = true;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/daily-question', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as DailyQuestionPayload | null;
        if (!active) return;
        if (!response.ok) {
          setError(payload?.error ?? 'Failed to load daily question.');
          setDaily(null);
          return;
        }

        setDaily(payload);
      } catch {
        if (!active) return;
        setError('Failed to load daily question.');
        setDaily(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [isLoading, user]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[rgb(var(--text))]">Daily Question</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          One focused interview question each day to build consistency.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
          <p className="text-sm text-[rgb(var(--muted))]">Loading today&apos;s question...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : daily ? (
        <article className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
          <p className="text-xs uppercase tracking-wide text-[rgb(var(--muted))]">{daily.date}</p>
          <h2 className="mt-2 text-xl font-semibold text-[rgb(var(--text))]">{daily.question.title}</h2>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">
            {daily.question.topic.name} · {daily.question.difficulty} ·{' '}
            {daily.question.freePreview ? 'Free preview' : 'Premium'}
          </p>
          <div className="mt-5">
            <Link
              href={`/interview-questions?q=${encodeURIComponent(daily.question.title)}#questions`}
              className="inline-flex rounded-lg bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white"
            >
              Open in question bank
            </Link>
          </div>
        </article>
      ) : (
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
          <p className="text-sm text-[rgb(var(--muted))]">No daily question available.</p>
        </div>
      )}
    </main>
  );
}
