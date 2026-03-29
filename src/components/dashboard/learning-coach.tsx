'use client';

import { useCallback, useState } from 'react';

type CoachRecommendation = {
  topic: string;
  reason: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
};

type LearningCoachProps = {
  weakTopics: string[];
};

function priorityBadge(priority: CoachRecommendation['priority']) {
  if (priority === 'high') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300';
  }
  if (priority === 'low') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }
  return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
}

export default function LearningCoach({ weakTopics }: LearningCoachProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<CoachRecommendation[]>([]);

  const generatePlan = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/coach', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weakTopics }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { summary?: string; recommendations?: CoachRecommendation[]; error?: string }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? 'Failed to generate coaching plan.');
        setRecommendations([]);
        setSummary(null);
        return;
      }

      setSummary(payload?.summary ?? null);
      setRecommendations(Array.isArray(payload?.recommendations) ? payload!.recommendations : []);
    } catch {
      setError('Failed to generate coaching plan.');
      setRecommendations([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [weakTopics]);

  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[rgb(var(--text))]">AI Learning Coach</h2>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            Personalized next-topic recommendations from your progress and weak areas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void generatePlan()}
          disabled={loading}
          className="rounded-lg bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Generating...' : 'Generate plan'}
        </button>
      </div>

      {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {summary ? (
        <p className="mt-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-3 text-sm text-[rgb(var(--text))]">
          {summary}
        </p>
      ) : null}

      {recommendations.length > 0 ? (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {recommendations.map((item) => (
            <li key={`${item.topic}-${item.action}`} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[rgb(var(--text))]">{item.topic}</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${priorityBadge(
                    item.priority,
                  )}`}
                >
                  {item.priority}
                </span>
              </div>
              <p className="mt-2 text-xs text-[rgb(var(--muted))]">{item.reason}</p>
              <p className="mt-2 text-xs font-medium text-[rgb(var(--text))]">{item.action}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
