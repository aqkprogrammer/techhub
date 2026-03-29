'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bookmark, Check, FileText, Plus, Sparkles } from 'lucide-react';

import RichContent from '@/components/rich-content';
import UnlockModal from '@/components/unlock-modal';

import type { QuestionListEntry } from '../data';

import QuestionTitleHighlight from './question-title-highlight';
import { usePdfExport } from './pdf-export-context';

const difficultyStyles: Record<QuestionListEntry['difficulty'], string> = {
  junior: 'border-[rgb(var(--border))] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  mid: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  senior: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

type ApiQuestionAnswers = {
  locked?: boolean;
  freePreview?: boolean;
  count?: number;
  items?: ApiAnswerItem[];
};

type ApiAnswerItem = {
  shortAnswer?: string | null;
  short_answer?: string | null;
  deepExplanation?: string | null;
  deep_explanation?: string | null;
  realWorldExample?: string | null;
  real_world_example?: string | null;
  commonMistakes?: unknown;
  common_mistakes?: unknown;
  commonMistakesText?: string | null;
  common_mistakes_text?: string | null;
  followUps?: unknown;
  follow_ups?: unknown;
  follow_up_questions?: unknown;
};

type AnswerDetails = {
  shortAnswer: string | null;
  deepExplanation: string | null;
  realWorldExample: string | null;
  commonMistakes: string[];
  followUps: Array<{ question: string; answer: string }>;
};

type AiEvaluation = {
  score: number;
  strengths: string[];
  missingConcepts: string[];
  improvements: string[];
  summary?: string;
};

type QuestionProgress = {
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

function ActionTooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium leading-none text-white opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
      {label}
    </span>
  );
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(/\n|;/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

function toFollowUps(value: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        const question = entry.trim();
        if (!question) return null;
        return { question, answer: '' };
      }

      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const question = typeof row.question === 'string' ? row.question.trim() : '';
      const answer = typeof row.answer === 'string' ? row.answer.trim() : '';
      if (!question && !answer) return null;
      return { question, answer };
    })
    .filter((entry): entry is { question: string; answer: string } => Boolean(entry));
}

function mapAnswerItem(item: ApiAnswerItem): AnswerDetails {
  const followUpsPrimary = toFollowUps(item.followUps ?? item.follow_ups);
  const followUpsLegacy = toFollowUps(item.follow_up_questions);
  const followUps = followUpsPrimary.length ? followUpsPrimary : followUpsLegacy;

  return {
    shortAnswer: item.shortAnswer ?? item.short_answer ?? null,
    deepExplanation: item.deepExplanation ?? item.deep_explanation ?? null,
    realWorldExample: item.realWorldExample ?? item.real_world_example ?? null,
    commonMistakes: toStringArray(
      item.commonMistakesText ??
        item.common_mistakes_text ??
        item.commonMistakes ??
        item.common_mistakes ??
        [],
    ),
    followUps: followUps.length
      ? followUps
      : toStringArray(item.follow_up_questions).map((question) => ({ question, answer: '' })),
  };
}

export default function QuestionCard({
  question,
  index,
  totalQuestions = 0,
  hiring = false,
  progress,
  progressPending = false,
  isAuthenticated = false,
  onProgressUpdate,
}: {
  question: QuestionListEntry;
  index: number;
  totalQuestions?: number;
  hiring?: boolean;
  progress?: QuestionProgress;
  progressPending?: boolean;
  isAuthenticated?: boolean;
  onProgressUpdate?: (questionId: string, payload: QuestionProgressPayload) => Promise<void>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isSelected, toggleQuestion, hasPaidAccess, isSubscriptionLoading } = usePdfExport();
  const isUnlocked = question.isFreePreview || hasPaidAccess;
  const [expanded, setExpanded] = useState(false);
  const [answer, setAnswer] = useState<AnswerDetails | null>(
    question.shortAnswer
      ? {
          shortAnswer: question.shortAnswer,
          deepExplanation: null,
          realWorldExample: null,
          commonMistakes: [],
          followUps: [],
        }
      : null
  );
  const [loading, setLoading] = useState(false);
  const [fetchTried, setFetchTried] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [aiEvaluation, setAiEvaluation] = useState<AiEvaluation | null>(null);
  const [generatedFollowUps, setGeneratedFollowUps] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isGeneratingFollowUps, setIsGeneratingFollowUps] = useState(false);
  const addedToPlan = isSelected(question.id);
  const addedToPdf = isSelected(question.id);
  const canAddToPdf = question.isFreePreview || hasPaidAccess;
  const hasAnyAnswer = Boolean(
    answer?.shortAnswer ||
      answer?.deepExplanation ||
      answer?.realWorldExample ||
      answer?.commonMistakes.length ||
      answer?.followUps.length
  );

  const redirectToLogin = useCallback(() => {
    const query = searchParams.toString();
    const nextPath = query ? `${pathname}?${query}` : pathname;
    const href = `/login?next=${encodeURIComponent(nextPath)}`;
    router.push(href);
  }, [router, pathname, searchParams]);

  const updateProgress = useCallback(
    (payload: QuestionProgressPayload, requireAuth: boolean) => {
      if (!isAuthenticated || !onProgressUpdate) {
        if (requireAuth) {
          redirectToLogin();
        }
        return;
      }
      void onProgressUpdate(question.id, payload);
    },
    [isAuthenticated, onProgressUpdate, question.id, redirectToLogin]
  );

  const toggleExpand = useCallback(() => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    updateProgress({ touchViewed: true }, false);
    if (!question.isFreePreview && isAuthenticated && isSubscriptionLoading) {
      return;
    }
    if (!question.isFreePreview && !hasPaidAccess) {
      setPricingOpen(true);
      return;
    }
    setExpanded(true);
    if (question.shortAnswer && !answer?.shortAnswer) {
      setAnswer({
        shortAnswer: question.shortAnswer,
        deepExplanation: null,
        realWorldExample: null,
        commonMistakes: [],
        followUps: [],
      });
    }
    if (fetchTried) return;
    setFetchTried(true);
    setLoading(true);
    fetch(`/api/questions/${question.id}/answers`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ApiQuestionAnswers | null) => {
        if (data?.locked) {
          setExpanded(false);
          setPricingOpen(true);
          setAnswer(null);
          return;
        }
        const first = data?.items?.[0];
        if (!first) {
          setAnswer(null);
          return;
        }
        setAnswer(mapAnswerItem(first));
      })
      .catch(() => setAnswer(null))
      .finally(() => setLoading(false));
  }, [
    expanded,
    question.id,
    question.shortAnswer,
    question.isFreePreview,
    isAuthenticated,
    isSubscriptionLoading,
    hasPaidAccess,
    fetchTried,
    answer,
    updateProgress,
  ]);

  const handlePdfToggle = useCallback(() => {
    if (addedToPdf) {
      toggleQuestion(question.id);
      return;
    }

    if (!question.isFreePreview && isAuthenticated && isSubscriptionLoading) {
      return;
    }

    if (canAddToPdf) {
      toggleQuestion(question.id);
      return;
    }

    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }

    setPricingOpen(true);
  }, [
    addedToPdf,
    canAddToPdf,
    isAuthenticated,
    isSubscriptionLoading,
    question.id,
    question.isFreePreview,
    redirectToLogin,
    toggleQuestion,
  ]);

  const pdfTooltipLabel = addedToPdf
    ? 'Added to PDF pack'
    : !question.isFreePreview && isAuthenticated && isSubscriptionLoading
      ? 'Checking your access...'
      : canAddToPdf
        ? 'Add to PDF pack'
    : isAuthenticated
      ? 'Upgrade to include paid questions in PDF'
      : 'Sign in and upgrade to include paid questions in PDF';

  const evaluateMyAnswer = useCallback(async () => {
    const userAnswer = candidateAnswer.trim();
    if (!userAnswer) return;

    setIsEvaluating(true);
    setAiError(null);
    try {
      const response = await fetch('/api/ai/evaluate', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          question: question.title,
          userAnswer,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { evaluation?: AiEvaluation; error?: string }
        | null;

      if (!response.ok) {
        setAiError(payload?.error ?? 'Failed to evaluate answer.');
        return;
      }

      setAiEvaluation(payload?.evaluation ?? null);
    } catch {
      setAiError('Failed to evaluate answer.');
    } finally {
      setIsEvaluating(false);
    }
  }, [candidateAnswer, question.id, question.title]);

  const generateFollowUpQuestions = useCallback(async () => {
    setIsGeneratingFollowUps(true);
    setAiError(null);
    try {
      const response = await fetch('/api/ai/followups', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.title,
          topic: question.topic.name,
          difficulty: question.difficulty,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { questions?: string[]; error?: string }
        | null;

      if (!response.ok) {
        setAiError(payload?.error ?? 'Failed to generate follow-up questions.');
        return;
      }

      setGeneratedFollowUps(Array.isArray(payload?.questions) ? payload!.questions : []);
    } catch {
      setAiError('Failed to generate follow-up questions.');
    } finally {
      setIsGeneratingFollowUps(false);
    }
  }, [question.difficulty, question.title, question.topic.name]);

  return (
    <div className="relative w-full min-w-0 max-w-full overflow-visible rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-5 py-4 transition hover:border-[rgb(var(--accent))]/50">
      {/* Question row */}
      <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap sm:gap-4">
        <span className="shrink-0 pt-1 text-sm font-semibold text-[rgb(var(--accent))]">Q{index + 1}:</span>
        <div className="group relative order-2 min-w-0 w-full flex-1 hover:z-20 focus-within:z-20 sm:order-none sm:w-auto">
          <button
            type="button"
            onClick={toggleExpand}
            className="w-full min-w-0 text-left text-sm text-[rgb(var(--text))] hover:underline focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]/50 focus:ring-offset-2 rounded"
            aria-expanded={expanded ? 'true' : 'false'}
            aria-label={expanded ? 'Collapse answer' : 'Show answer'}
            title={expanded ? 'Hide full answer' : 'Open full answer'}
          >
            <QuestionTitleHighlight title={question.title} />
          </button>
          <ActionTooltip label={expanded ? 'Hide full answer' : 'Open full answer'} />
        </div>
        <div className="order-3 ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:order-none sm:w-auto sm:shrink-0">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${difficultyStyles[question.difficulty]}`}
          >
            {question.difficulty}
          </span>
          {hiring ? (
            <div className="group relative hover:z-20 focus-within:z-20">
              <button
                type="button"
                onClick={() => toggleQuestion(question.id)}
                className={`inline-flex h-8 w-8 items-center justify-center rounded border transition ${
                  addedToPlan
                    ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]'
                    : 'border-[rgb(var(--accent))] bg-[rgb(var(--bg))] text-[rgb(var(--text))] hover:border-[rgb(var(--accent))]'
                }`}
                aria-label={addedToPlan ? `Question ${index + 1} in plan` : `Add question ${index + 1} to screening plan`}
                title={addedToPlan ? 'Added to screening plan' : 'Add to screening plan'}
              >
                {addedToPlan ? <Check className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
              </button>
              <ActionTooltip label={addedToPlan ? 'Added to screening plan' : 'Add to screening plan'} />
            </div>
          ) : (
            <div className="group relative hover:z-20 focus-within:z-20">
              <button
                type="button"
                onClick={handlePdfToggle}
                className={`inline-flex h-8 w-8 items-center justify-center rounded border transition ${
                  addedToPdf
                    ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]'
                    : !canAddToPdf
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-700'
                    : 'border-[rgb(var(--accent))] bg-[rgb(var(--bg))] text-[rgb(var(--text))] hover:border-[rgb(var(--accent))]'
                }`}
                aria-label={
                  addedToPdf
                    ? `Remove question ${index + 1} from PDF`
                    : !canAddToPdf
                    ? `Upgrade required to add question ${index + 1} to PDF`
                    : `Add question ${index + 1} to PDF`
                }
                title={pdfTooltipLabel}
              >
                {addedToPdf ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <FileText className="h-4 w-4" aria-hidden />
                )}
              </button>
              <ActionTooltip label={pdfTooltipLabel} />
            </div>
          )}
          <div className="group relative hover:z-20 focus-within:z-20">
            <button
              type="button"
              onClick={() =>
                updateProgress({
                  bookmarked: !progress?.bookmarked,
                  touchViewed: true,
                }, true)
              }
              disabled={progressPending}
              className={`inline-flex h-8 w-8 items-center justify-center rounded border transition ${
                progress?.bookmarked
                  ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]'
                  : 'border-[rgb(var(--border))] bg-[rgb(var(--bg))] text-[rgb(var(--muted))] hover:border-[rgb(var(--accent))]'
              }`}
              aria-label={
                progress?.bookmarked
                  ? `Remove bookmark for question ${index + 1}`
                  : `Bookmark question ${index + 1}`
              }
              title={progress?.bookmarked ? 'Saved to bookmarks' : 'Save bookmark'}
            >
              {progressPending ? (
                <svg className="h-4 w-4 animate-spin text-[rgb(var(--accent))]" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <Bookmark
                  className="h-4 w-4"
                  aria-hidden
                  fill={progress?.bookmarked ? 'currentColor' : 'none'}
                />
              )}
            </button>
            <ActionTooltip label={progress?.bookmarked ? 'Saved to bookmarks' : 'Save bookmark'} />
          </div>
          <div className="group relative hover:z-20 focus-within:z-20">
            <button
              type="button"
              onClick={() =>
                updateProgress({
                  completed: !progress?.completed,
                  touchViewed: true,
                }, true)
              }
              disabled={progressPending}
              className={`inline-flex h-8 w-8 items-center justify-center rounded border transition ${
                progress?.completed
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-[rgb(var(--border))] bg-[rgb(var(--bg))] text-[rgb(var(--muted))] hover:border-emerald-500/50'
              }`}
              aria-label={
                progress?.completed
                  ? `Mark question ${index + 1} as incomplete`
                  : `Mark question ${index + 1} as complete`
              }
              title={progress?.completed ? 'Marked complete' : 'Mark as complete'}
            >
              {progressPending ? (
                <svg className="h-4 w-4 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <Check className="h-4 w-4" aria-hidden />
              )}
            </button>
            <ActionTooltip label={progress?.completed ? 'Marked complete' : 'Mark as complete'} />
          </div>
          <div className="group relative hover:z-20 focus-within:z-20">
            <span
              className={`inline-flex h-8 w-8 items-center justify-center rounded border ${
                isUnlocked
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                  : 'border-[rgb(var(--border))] bg-[rgb(var(--bg))] text-[rgb(var(--muted))]'
                }`}
              aria-label={isUnlocked ? 'Free question' : 'Premium question'}
              title={isUnlocked ? 'Free question' : 'Premium question'}
            >
              <span className="text-sm leading-none" aria-hidden>
                {isUnlocked ? '🔓' : '🔒'}
              </span>
            </span>
            <ActionTooltip label={isUnlocked ? 'Free question' : 'Premium question'} />
          </div>
        </div>
      </div>
      {!isAuthenticated ? (
        <p className="mt-2 text-xs text-[rgb(var(--muted))]">
          Sign in to save bookmark and completion progress.
        </p>
      ) : null}

      {/* Answer section - expandable div */}
      {expanded && (
        <div className="mt-4 w-full min-w-0 max-w-full border-t border-[rgb(var(--border))] pt-4">
          <h3 className="text-sm font-bold text-[rgb(var(--accent))]">Answer</h3>
          {loading && !hasAnyAnswer ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-[rgb(var(--muted))]" aria-busy="true">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[rgb(var(--accent))]/30 border-t-[rgb(var(--accent))]" aria-hidden />
              <span>Loading answer…</span>
            </div>
          ) : hasAnyAnswer ? (
            <div className="mt-3 w-full min-w-0 max-w-full space-y-4 overflow-hidden">
              {answer?.shortAnswer ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                    Short answer
                  </p>
                  <div className="mt-1">
                    <RichContent content={answer.shortAnswer} className="w-full min-w-0 max-w-full text-sm" />
                  </div>
                </div>
              ) : null}
              {answer?.deepExplanation ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                    Deep explanation
                  </p>
                  <div className="mt-1">
                    <RichContent content={answer.deepExplanation} className="w-full min-w-0 max-w-full text-sm" />
                  </div>
                </div>
              ) : null}
              {answer?.realWorldExample ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                    Real-world example
                  </p>
                  <div className="mt-1">
                    <RichContent content={answer.realWorldExample} className="w-full min-w-0 max-w-full text-sm" />
                  </div>
                </div>
              ) : null}
              {answer?.commonMistakes.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                    Common mistakes
                  </p>
                  <ul className="mt-1 list-disc space-y-1 break-words pl-5 text-sm text-[rgb(var(--text))]">
                    {answer.commonMistakes.map((mistake) => (
                      <li key={mistake}>{mistake}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {hiring && answer?.followUps.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                    Follow-ups
                  </p>
                  <ul className="mt-1 list-disc space-y-1 break-words pl-5 text-sm text-[rgb(var(--text))]">
                    {answer.followUps.map((followUp) => (
                      <li key={`${followUp.question}-${followUp.answer}`}>
                        <span className="font-medium">{followUp.question}</span>
                        {followUp.answer ? <span className="text-[rgb(var(--muted))]"> - {followUp.answer}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[rgb(var(--muted))]">
              {isUnlocked
                ? 'No answer is available for this question yet.'
                : 'Unlock to view the full answer and explanation.'}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {hasAnyAnswer && (
              <span className="text-xs italic text-[rgb(var(--muted))]">Source: techhub.cafe</span>
            )}
            {!isUnlocked && (
              <div className="group relative">
                <button
                  type="button"
                  onClick={() => setPricingOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  <span aria-hidden>🔒</span>
                  Unlock {totalQuestions > 0 ? `${totalQuestions} ` : ''}Answers
                </button>
                <ActionTooltip label="View pricing and unlock full answers" />
              </div>
            )}
          </div>

          {hasPaidAccess ? (
            <div className="mt-5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[rgb(var(--text))]">AI Answer Review</p>
                <button
                  type="button"
                  onClick={() => void generateFollowUpQuestions()}
                  disabled={isGeneratingFollowUps}
                  className="inline-flex items-center gap-1 rounded-lg border border-[rgb(var(--border))] px-2.5 py-1.5 text-xs font-medium text-[rgb(var(--text))] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {isGeneratingFollowUps ? 'Generating...' : 'Generate Follow-up Questions'}
                </button>
              </div>

              <textarea
                value={candidateAnswer}
                onChange={(event) => setCandidateAnswer(event.target.value)}
                rows={4}
                placeholder="Write your interview answer here..."
                className="mt-3 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-sm text-[rgb(var(--text))]"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => void evaluateMyAnswer()}
                  disabled={isEvaluating || candidateAnswer.trim().length === 0}
                  className="rounded-lg bg-[rgb(var(--accent))] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isEvaluating ? 'Evaluating...' : 'Evaluate My Answer'}
                </button>
              </div>

              {aiError ? (
                <p className="mt-3 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">{aiError}</p>
              ) : null}

              {aiEvaluation ? (
                <div className="mt-3 space-y-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--muted))]">
                    Score: {aiEvaluation.score}/100
                  </p>
                  {aiEvaluation.summary ? (
                    <p className="text-xs text-[rgb(var(--text))]">{aiEvaluation.summary}</p>
                  ) : null}
                  {aiEvaluation.strengths.length > 0 ? (
                    <p className="text-xs text-[rgb(var(--text))]">
                      <span className="font-semibold">Strengths:</span>{' '}
                      {aiEvaluation.strengths.join(', ')}
                    </p>
                  ) : null}
                  {aiEvaluation.missingConcepts.length > 0 ? (
                    <p className="text-xs text-[rgb(var(--text))]">
                      <span className="font-semibold">Missing concepts:</span>{' '}
                      {aiEvaluation.missingConcepts.join(', ')}
                    </p>
                  ) : null}
                  {aiEvaluation.improvements.length > 0 ? (
                    <p className="text-xs text-[rgb(var(--text))]">
                      <span className="font-semibold">Improvements:</span>{' '}
                      {aiEvaluation.improvements.join(', ')}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {generatedFollowUps.length > 0 ? (
                <div className="mt-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--muted))]">
                    AI Follow-ups
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[rgb(var(--text))]">
                    {generatedFollowUps.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
              <p className="text-xs text-[rgb(var(--muted))]">
                AI answer review is available for paid subscribers.
              </p>
              <button
                type="button"
                onClick={() => setPricingOpen(true)}
                className="mt-2 rounded-lg bg-[rgb(var(--accent))] px-3 py-2 text-xs font-semibold text-white"
              >
                Unlock AI Features
              </button>
            </div>
          )}
        </div>
      )}
      <UnlockModal
        open={pricingOpen}
        onClose={() => setPricingOpen(false)}
        answerCount={totalQuestions}
      />
    </div>
  );
}
