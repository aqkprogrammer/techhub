'use client';

import { FormEvent, useMemo, useState } from 'react';

import { useAuth } from '@/components/auth-provider';

type InterviewDifficulty = 'junior' | 'mid' | 'senior';

type AiMessage = {
  role: 'assistant' | 'user';
  content: string;
  createdAt: string;
};

type InterviewResponse = {
  interviewId: string | null;
  topic: string;
  difficulty: InterviewDifficulty;
  messages: AiMessage[];
  assistantMessage: string;
  error?: string;
};

const DEFAULT_TOPIC = 'React';
const DEFAULT_DIFFICULTY: InterviewDifficulty = 'mid';

export default function AiInterviewPage() {
  const { user, isLoading } = useAuth();
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>(DEFAULT_DIFFICULTY);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [candidateInput, setCandidateInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = candidateInput.trim().length > 0 && !loadingChat;
  const hasStarted = useMemo(() => messages.length > 0, [messages.length]);

  const startInterview = async () => {
    setLoadingChat(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/interview', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          difficulty,
        }),
      });

      const payload = (await response.json().catch(() => null)) as InterviewResponse | null;
      if (!response.ok) {
        setError(payload?.error ?? 'Failed to start AI interview.');
        return;
      }

      setInterviewId(payload?.interviewId ?? null);
      setMessages(Array.isArray(payload?.messages) ? payload!.messages : []);
    } catch {
      setError('Failed to start AI interview.');
    } finally {
      setLoadingChat(false);
    }
  };

  const submitCandidateAnswer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend) return;

    const answer = candidateInput.trim();
    setCandidateInput('');
    setLoadingChat(true);
    setError(null);

    const optimisticMessage: AiMessage = {
      role: 'user',
      content: answer,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimisticMessage]);

    try {
      const response = await fetch('/api/ai/interview', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId,
          topic,
          difficulty,
          message: answer,
        }),
      });

      const payload = (await response.json().catch(() => null)) as InterviewResponse | null;
      if (!response.ok) {
        setError(payload?.error ?? 'Failed to send answer.');
        setMessages((current) =>
          current.filter((entry) => entry !== optimisticMessage),
        );
        return;
      }

      setInterviewId(payload?.interviewId ?? interviewId);
      setMessages(Array.isArray(payload?.messages) ? payload!.messages : []);
    } catch {
      setError('Failed to send answer.');
    } finally {
      setLoadingChat(false);
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <p className="text-sm text-[rgb(var(--muted))]">Loading AI interview...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
          <h1 className="text-xl font-semibold text-[rgb(var(--text))]">AI Interview Assistant</h1>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">
            Sign in and upgrade to use AI interview simulations.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
        <h1 className="text-2xl font-bold text-[rgb(var(--text))]">AI Interview Assistant</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Run a mock interview with follow-up questions and practical feedback.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="text-sm text-[rgb(var(--text))]">
            <span className="mb-1 block text-xs text-[rgb(var(--muted))]">Topic</span>
            <input
              type="text"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              disabled={hasStarted}
              className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-[rgb(var(--text))]">
            <span className="mb-1 block text-xs text-[rgb(var(--muted))]">Difficulty</span>
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as InterviewDifficulty)}
              disabled={hasStarted}
              className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm"
            >
              <option value="junior">Junior</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void startInterview()}
              disabled={loadingChat || hasStarted}
              className="w-full rounded-lg bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingChat && !hasStarted ? 'Starting...' : hasStarted ? 'Interview started' : 'Start interview'}
            </button>
          </div>
        </div>

        {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 max-h-[460px] space-y-3 overflow-auto rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
          {messages.length === 0 ? (
            <p className="text-sm text-[rgb(var(--muted))]">Start an interview to begin the conversation.</p>
          ) : (
            messages.map((message, index) => (
              <div
                key={`${message.role}-${index}-${message.createdAt}`}
                className={`rounded-xl p-3 text-sm ${
                  message.role === 'assistant'
                    ? 'border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--text))]'
                    : 'ml-8 bg-[rgb(var(--accent))]/10 text-[rgb(var(--text))]'
                }`}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--muted))]">
                  {message.role === 'assistant' ? 'Interviewer' : 'Candidate'}
                </p>
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              </div>
            ))
          )}
        </div>

        <form onSubmit={submitCandidateAnswer} className="mt-4 space-y-2">
          <textarea
            value={candidateInput}
            onChange={(event) => setCandidateInput(event.target.value)}
            rows={5}
            placeholder="Type your interview answer..."
            disabled={!hasStarted || loadingChat}
            className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-3 text-sm"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!canSend || !hasStarted}
              className="rounded-lg bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingChat ? 'Sending...' : 'Submit answer'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
