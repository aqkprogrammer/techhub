'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';

import MarkdownEditor from './MarkdownEditor';

type ApiDifficulty = 'junior' | 'mid' | 'senior' | 'easy' | 'medium' | 'hard';
type DifficultyOption = 'easy' | 'medium' | 'hard';

type Topic = {
  id: string;
  name: string;
};

type FollowUpItem = {
  question: string;
  answer: string;
};

type InitialData = {
  question: {
    id: string;
    title: string;
    slug: string | null;
    difficulty: ApiDifficulty;
    topicId: string;
    freePreview: boolean;
  };
  answer: {
    shortAnswer: string;
    deepExplanation: string;
    realWorldExample: string;
    commonMistakes: string;
    followUps: FollowUpItem[];
  } | null;
};

type AddQuestionFormProps = {
  mode?: 'create' | 'edit';
  questionId?: string;
  initialData?: InitialData;
};

type FieldErrors = {
  title?: string;
  slug?: string;
  topicId?: string;
  shortAnswer?: string;
  followUps?: string;
  form?: string;
};

const MAX_EDITOR_CHARS = 50_000;
const MAX_FOLLOW_UPS = 10;

function inputClass() {
  return 'w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-sm text-[rgb(var(--text))] focus:border-[rgb(var(--accent))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))]';
}

function labelClass() {
  return 'block text-sm font-medium text-[rgb(var(--text))]';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function mapDifficultyFromApi(value: ApiDifficulty): DifficultyOption {
  if (value === 'easy' || value === 'junior') return 'easy';
  if (value === 'medium' || value === 'mid') return 'medium';
  return 'hard';
}

function mapDifficultyToApi(value: DifficultyOption): 'junior' | 'mid' | 'senior' {
  if (value === 'easy') return 'junior';
  if (value === 'medium') return 'mid';
  return 'senior';
}

function toTopicItems(payload: unknown): Topic[] {
  const record = (payload ?? {}) as Record<string, unknown>;
  const fromItems = Array.isArray(record.items) ? record.items : [];
  const fromTopics = Array.isArray(record.topics) ? record.topics : [];
  const source = fromItems.length > 0 ? fromItems : fromTopics;

  return source
    .map((item) => item as Record<string, unknown>)
    .map((item) => {
      const id = typeof item.id === 'string' ? item.id : '';
      const name =
        typeof item.name === 'string' && item.name.trim()
          ? item.name.trim()
          : typeof item.title === 'string'
            ? item.title.trim()
            : '';
      if (!id || !name) return null;
      return { id, name };
    })
    .filter((item): item is Topic => Boolean(item));
}

function normalizeFollowUps(value: unknown): FollowUpItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const question = typeof row.question === 'string' ? row.question : '';
      const answer = typeof row.answer === 'string' ? row.answer : '';
      return {
        question,
        answer,
      };
    })
    .filter((item): item is FollowUpItem => Boolean(item));
}

export default function AddQuestionForm({ mode = 'create', questionId, initialData }: AddQuestionFormProps) {
  const router = useRouter();
  const isEdit = mode === 'edit';

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState(initialData?.question.title ?? '');
  const [slug, setSlug] = useState(initialData?.question.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(initialData?.question.slug));
  const [difficulty, setDifficulty] = useState<DifficultyOption>(
    mapDifficultyFromApi(initialData?.question.difficulty ?? 'mid'),
  );
  const [topicId, setTopicId] = useState(initialData?.question.topicId ?? '');
  const [freePreview, setFreePreview] = useState(initialData?.question.freePreview ?? false);

  const [shortAnswer, setShortAnswer] = useState(initialData?.answer?.shortAnswer ?? '');
  const [deepExplanation, setDeepExplanation] = useState(initialData?.answer?.deepExplanation ?? '');
  const [realWorldExample, setRealWorldExample] = useState(initialData?.answer?.realWorldExample ?? '');
  const [commonMistakes, setCommonMistakes] = useState(initialData?.answer?.commonMistakes ?? '');
  const [followUps, setFollowUps] = useState<FollowUpItem[]>(
    initialData?.answer?.followUps?.length
      ? initialData.answer.followUps
      : [{ question: '', answer: '' }],
  );

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const loadJson = async (urls: string[]) => {
          for (const url of urls) {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) continue;
            return response.json();
          }
          return null;
        };

        const topicPayload = await loadJson(['/api/admin/topics', '/api/topics?workspaceId=all', '/api/topics']);
        if (!topicPayload) {
          throw new Error('Failed to load topics.');
        }

        const nextTopics = toTopicItems(topicPayload);
        if (cancelled) return;
        setTopics(nextTopics);

        if (!topicId && nextTopics.length > 0 && !initialData?.question.topicId) {
          setTopicId(nextTopics[0].id);
        }
      } catch (error) {
        if (cancelled) return;
        setFieldErrors((prev) => ({
          ...prev,
          form: error instanceof Error ? error.message : 'Unable to load form dependencies.',
        }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialData?.question.topicId, topicId]);

  useEffect(() => {
    if (slugTouched) return;
    setSlug(slugify(title));
  }, [slugTouched, title]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const contentStats = useMemo(() => {
    const total =
      shortAnswer.length +
      deepExplanation.length +
      realWorldExample.length +
      commonMistakes.length +
      followUps.reduce((sum, item) => sum + item.question.length + item.answer.length, 0);

    return { total };
  }, [commonMistakes.length, deepExplanation.length, followUps, realWorldExample.length, shortAnswer.length]);

  const uploadAnswerImage = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/admin/uploads', {
      method: 'POST',
      body: formData,
    });

    const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      throw new Error(payload.error ?? 'Failed to upload image.');
    }

    return payload.url;
  };

  const setFollowUpField = (index: number, key: keyof FollowUpItem, value: string) => {
    setFollowUps((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  };

  const addFollowUp = () => {
    setFollowUps((prev) => {
      if (prev.length >= MAX_FOLLOW_UPS) return prev;
      return [...prev, { question: '', answer: '' }];
    });
  };

  const removeFollowUp = (index: number) => {
    setFollowUps((prev) => {
      const next = prev.filter((_, itemIndex) => itemIndex !== index);
      return next.length > 0 ? next : [{ question: '', answer: '' }];
    });
  };

  const validate = (): boolean => {
    const nextErrors: FieldErrors = {};

    if (!title.trim()) {
      nextErrors.title = 'Title is required.';
    } else if (title.trim().length < 10 || title.trim().length > 150) {
      nextErrors.title = 'Title must be between 10 and 150 characters.';
    }

    if (!slug.trim()) {
      nextErrors.slug = 'Slug is required.';
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())) {
      nextErrors.slug = 'Slug may only contain lowercase letters, numbers, and hyphens.';
    }

    if (!topicId) {
      nextErrors.topicId = 'Topic is required.';
    }

    if (!shortAnswer.trim()) {
      nextErrors.shortAnswer = 'Short answer is required.';
    }

    if (followUps.length > MAX_FOLLOW_UPS) {
      nextErrors.followUps = `Maximum ${MAX_FOLLOW_UPS} follow-ups are allowed.`;
    }

    if (contentStats.total > MAX_EDITOR_CHARS * 4) {
      nextErrors.form = 'Content is too large. Reduce text size and retry.';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setToast(null);
    setFieldErrors({});

    if (!validate()) {
      return;
    }

    const cleanFollowUps = followUps
      .map((item) => ({
        question: item.question.trim(),
        answer: item.answer.trim(),
      }))
      .filter((item) => item.question || item.answer)
      .slice(0, MAX_FOLLOW_UPS);

    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      difficulty: mapDifficultyToApi(difficulty),
      topicId,
      freePreview,
      answer: {
        shortAnswer: shortAnswer.trim(),
        deepExplanation: deepExplanation.trim(),
        realWorldExample: realWorldExample.trim(),
        commonMistakes: commonMistakes.trim(),
        followUps: cleanFollowUps,
      },
    };

    setSubmitting(true);
    try {
      const endpoint = isEdit && questionId ? `/api/questions/${questionId}` : '/api/questions';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        question?: { id: string };
      };

      if (!response.ok) {
        setFieldErrors({ form: result.error ?? 'Failed to save question.' });
        setToast({ type: 'error', message: result.error ?? 'Failed to save question.' });
        return;
      }

      setToast({
        type: 'success',
        message: isEdit ? 'Question updated successfully.' : 'Question created successfully.',
      });

      if (isEdit && questionId) {
        router.push(`/admin/questions/${questionId}`);
      } else {
        router.push('/admin/questions');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed.';
      setFieldErrors({ form: message });
      setToast({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[rgb(var(--muted))]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading editor...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast ? (
        <div
          className={`fixed right-6 top-6 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : null}
            {toast.message}
          </div>
        </div>
      ) : null}

      <div>
        <h1 className="text-2xl font-semibold text-[rgb(var(--text))]">
          {isEdit ? 'Edit question & answer' : 'Add question & answer'}
        </h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Rich markdown content supports headings, code blocks, inline images, links, and syntax-highlighted previews.
        </p>
      </div>

      {fieldErrors.form ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{fieldErrors.form}</p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
          <h2 className="text-sm font-semibold text-[rgb(var(--text))]">Question Information</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass()}>Title *</label>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClass()}
                placeholder="Enter question title"
                required
                minLength={10}
                maxLength={150}
              />
              {fieldErrors.title ? <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p> : null}
            </div>

            <div>
              <label className={labelClass()}>Slug *</label>
              <input
                type="text"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(slugify(event.target.value));
                }}
                className={inputClass()}
                placeholder="question-slug"
                required
              />
              {fieldErrors.slug ? <p className="mt-1 text-xs text-red-600">{fieldErrors.slug}</p> : null}
            </div>

            <div>
              <label htmlFor="difficulty" className={labelClass()}>
                Difficulty *
              </label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as DifficultyOption)}
                className={inputClass()}
                required
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div>
              <label htmlFor="topic" className={labelClass()}>
                Topic ID *
              </label>
              <select
                id="topic"
                value={topicId}
                onChange={(event) => setTopicId(event.target.value)}
                className={inputClass()}
                required
              >
                <option value="">Select topic</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
              {fieldErrors.topicId ? <p className="mt-1 text-xs text-red-600">{fieldErrors.topicId}</p> : null}
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                id="free-preview"
                type="checkbox"
                checked={freePreview}
                onChange={(event) => setFreePreview(event.target.checked)}
                className="h-4 w-4 rounded border-[rgb(var(--border))]"
              />
              <label htmlFor="free-preview" className="text-sm text-[rgb(var(--text))]">
                Free Preview
              </label>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
          <h2 className="text-sm font-semibold text-[rgb(var(--text))]">Answer Information</h2>

          <MarkdownEditor
            label="Short Answer"
            value={shortAnswer}
            onChange={setShortAnswer}
            required
            rows={6}
            uploadImage={uploadAnswerImage}
            helperText="Required. Keep this concise and interview-ready."
          />
          {fieldErrors.shortAnswer ? <p className="text-xs text-red-600">{fieldErrors.shortAnswer}</p> : null}

          <MarkdownEditor
            label="Deep Explanation"
            value={deepExplanation}
            onChange={setDeepExplanation}
            rows={10}
            uploadImage={uploadAnswerImage}
            helperText="Optional but recommended for complete context."
          />

          <MarkdownEditor
            label="Real World Example"
            value={realWorldExample}
            onChange={setRealWorldExample}
            rows={8}
            uploadImage={uploadAnswerImage}
          />

          <MarkdownEditor
            label="Common Mistakes"
            value={commonMistakes}
            onChange={setCommonMistakes}
            rows={7}
            uploadImage={uploadAnswerImage}
          />
        </section>

        <section className="space-y-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[rgb(var(--text))]">Follow-ups (JSONB)</h2>
            <button
              type="button"
              onClick={addFollowUp}
              disabled={followUps.length >= MAX_FOLLOW_UPS}
              className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--border))] px-3 py-1.5 text-xs font-semibold text-[rgb(var(--text))] disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add follow-up
            </button>
          </div>
          {fieldErrors.followUps ? <p className="text-xs text-red-600">{fieldErrors.followUps}</p> : null}

          {followUps.map((item, index) => (
            <div key={index} className="rounded-lg border border-[rgb(var(--border))] p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass()}>Question</label>
                  <input
                    type="text"
                    value={item.question}
                    onChange={(event) => setFollowUpField(index, 'question', event.target.value)}
                    className={inputClass()}
                    placeholder="Follow-up question"
                  />
                </div>
                <div>
                  <label className={labelClass()}>Answer</label>
                  <textarea
                    value={item.answer}
                    onChange={(event) => setFollowUpField(index, 'answer', event.target.value)}
                    rows={3}
                    className={inputClass()}
                    placeholder="Follow-up answer"
                  />
                </div>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => removeFollowUp(index)}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-lg bg-[rgb(var(--accent))] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEdit ? 'Update question & answer' : 'Create question & answer'}
          </button>

          <Link href="/admin/questions" className="text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]">
            Cancel
          </Link>

          <span className="text-xs text-[rgb(var(--muted))]">Content size: {contentStats.total.toLocaleString()} chars</span>
        </div>
      </form>
    </div>
  );
}

export type { InitialData as QuestionEditorInitialData };
