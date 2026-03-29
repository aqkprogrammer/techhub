'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/auth-provider';

import type { QuestionListEntry } from '../data';

import QuestionCard from './question-card';

type QuestionProgressItem = {
  id: string;
  questionId: string;
  completed: boolean;
  bookmarked: boolean;
  lastViewed: string | null;
};

type QuestionProgressPayload = {
  completed?: boolean;
  bookmarked?: boolean;
  touchViewed?: boolean;
};

type QuestionsWithProgressProps = {
  questions: QuestionListEntry[];
  totalQuestions: number;
  hiring?: boolean;
};

function normalizeProgressItem(value: unknown): QuestionProgressItem | null {
  if (!value || typeof value !== 'object') return null;

  const row = value as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  const questionId =
    typeof row.questionId === 'string'
      ? row.questionId
      : typeof row.question_id === 'string'
        ? row.question_id
        : '';

  if (!id || !questionId) return null;

  return {
    id,
    questionId,
    completed: Boolean(row.completed),
    bookmarked: Boolean(row.bookmarked),
    lastViewed:
      typeof row.lastViewed === 'string'
        ? row.lastViewed
        : typeof row.last_viewed === 'string'
          ? row.last_viewed
          : null,
  };
}

function createProgressMap(items: unknown): Record<string, QuestionProgressItem> {
  if (!Array.isArray(items)) return {};

  return items.reduce<Record<string, QuestionProgressItem>>((acc, item) => {
    const normalized = normalizeProgressItem(item);
    if (!normalized) return acc;
    acc[normalized.questionId] = normalized;
    return acc;
  }, {});
}

export default function QuestionsWithProgress({
  questions,
  totalQuestions,
  hiring = false,
}: QuestionsWithProgressProps) {
  const { user } = useAuth();
  const [progressByQuestionId, setProgressByQuestionId] = useState<
    Record<string, QuestionProgressItem>
  >({});
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [pendingQuestionIds, setPendingQuestionIds] = useState<
    Record<string, boolean>
  >({});

  const questionIds = useMemo(() => questions.map((question) => question.id), [questions]);

  useEffect(() => {
    if (!user || questionIds.length === 0) {
      setProgressByQuestionId({});
      setLoadingProgress(false);
      return;
    }

    const controller = new AbortController();
    const loadProgress = async () => {
      setLoadingProgress(true);
      try {
        const params = new URLSearchParams();
        if (questionIds.length <= 120) {
          params.set('questionIds', questionIds.join(','));
        }

        const response = await fetch(`/api/progress?${params.toString()}`, {
          method: 'GET',
          credentials: 'same-origin',
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 401) {
            setProgressByQuestionId({});
            return;
          }
          throw new Error('Failed to load question progress.');
        }

        const payload = (await response.json()) as { items?: unknown };
        setProgressByQuestionId(createProgressMap(payload.items));
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setProgressByQuestionId({});
        }
      } finally {
        setLoadingProgress(false);
      }
    };

    void loadProgress();

    return () => {
      controller.abort();
    };
  }, [user, questionIds]);

  const updateProgress = useCallback(
    async (questionId: string, payload: QuestionProgressPayload) => {
      if (!user) return;

      const previous = progressByQuestionId[questionId];
      const optimistic: QuestionProgressItem = {
        id: previous?.id ?? `optimistic-${questionId}`,
        questionId,
        completed: payload.completed ?? previous?.completed ?? false,
        bookmarked: payload.bookmarked ?? previous?.bookmarked ?? false,
        lastViewed: payload.touchViewed
          ? new Date().toISOString()
          : previous?.lastViewed ?? null,
      };

      setPendingQuestionIds((current) => ({ ...current, [questionId]: true }));
      setProgressByQuestionId((current) => ({ ...current, [questionId]: optimistic }));

      try {
        const response = await fetch('/api/progress', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            questionId,
            completed: payload.completed,
            bookmarked: payload.bookmarked,
            touchViewed: payload.touchViewed ?? false,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save question progress.');
        }

        const result = (await response.json()) as { item?: unknown };
        const mapped = normalizeProgressItem(result.item);
        if (!mapped) {
          throw new Error('Invalid progress response.');
        }

        setProgressByQuestionId((current) => ({
          ...current,
          [questionId]: mapped,
        }));
      } catch {
        setProgressByQuestionId((current) => {
          const next = { ...current };
          if (previous) {
            next[questionId] = previous;
          } else {
            delete next[questionId];
          }
          return next;
        });
      } finally {
        setPendingQuestionIds((current) => ({
          ...current,
          [questionId]: false,
        }));
      }
    },
    [user, progressByQuestionId]
  );

  const completedCount = useMemo(
    () =>
      questionIds.reduce(
        (count, questionId) =>
          count + (progressByQuestionId[questionId]?.completed ? 1 : 0),
        0
      ),
    [questionIds, progressByQuestionId]
  );
  const bookmarkedCount = useMemo(
    () =>
      questionIds.reduce(
        (count, questionId) =>
          count + (progressByQuestionId[questionId]?.bookmarked ? 1 : 0),
        0
      ),
    [questionIds, progressByQuestionId]
  );

  if (loadingProgress) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading questions">
        {/* Stats row skeleton */}
        <div className="flex items-center gap-2">
          <div className="h-6 w-28 animate-pulse rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))]" />
          <div className="h-6 w-24 animate-pulse rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))]" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--accent))]/30 bg-[rgb(var(--accent))]/10 px-3 py-1 text-xs text-[rgb(var(--accent))]">
            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Syncing progress
          </span>
        </div>

        {/* Skeleton question cards */}
        <div className="grid min-w-0 max-w-full gap-6">
          {questions.map((question) => (
            <div
              key={question.id}
              className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-14 animate-pulse rounded-full bg-[rgb(var(--border))]/80" />
                    <div className="h-5 w-20 animate-pulse rounded-full bg-[rgb(var(--border))]/60" />
                  </div>
                  <div className="h-5 w-3/4 animate-pulse rounded bg-[rgb(var(--border))]/80" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-[rgb(var(--border))]/50" />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="h-8 w-8 animate-pulse rounded border border-[rgb(var(--border))] bg-[rgb(var(--border))]/50" />
                  <div className="h-8 w-8 animate-pulse rounded border border-[rgb(var(--border))] bg-[rgb(var(--border))]/50" />
                  <div className="h-8 w-8 animate-pulse rounded border border-[rgb(var(--border))] bg-[rgb(var(--border))]/50" />
                  <div className="h-8 w-16 animate-pulse rounded-lg bg-[rgb(var(--accent))]/20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {user ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--muted))]">
          <span className="rounded-full border border-[rgb(var(--border))] px-3 py-1">
            Completed {completedCount}/{questions.length}
          </span>
          <span className="rounded-full border border-[rgb(var(--border))] px-3 py-1">
            Bookmarked {bookmarkedCount}
          </span>
        </div>
      ) : (
        <p className="text-xs text-[rgb(var(--muted))]">
          Sign in to save question progress and bookmarks.
        </p>
      )}

      <div className="grid min-w-0 max-w-full gap-6">
        {questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            index={index}
            totalQuestions={totalQuestions}
            hiring={hiring}
            isAuthenticated={Boolean(user)}
            progress={progressByQuestionId[question.id]}
            progressPending={Boolean(pendingQuestionIds[question.id])}
            onProgressUpdate={updateProgress}
          />
        ))}
      </div>
    </div>
  );
}
