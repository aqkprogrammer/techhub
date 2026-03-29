import Link from 'next/link';
import { Eye, Pencil, Trash2 } from 'lucide-react';

import { mapDifficultyInputToDb, type DifficultyInput } from '@/lib/questions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { deleteQuestionAction } from '../actions';

import QuestionsFiltersToolbar from './QuestionsFiltersToolbar';

type QuestionsPageProps = {
  searchParams?:
    | {
        [key: string]: string | string[] | undefined;
      }
    | Promise<{
        [key: string]: string | string[] | undefined;
      }>;
};

type QuestionRow = {
  id: string;
  title: string;
  slug: string | null;
  difficulty: string;
  free_preview: boolean | null;
  is_free_preview?: boolean | null;
  created_at: string;
  topic_id: string;
  topic: { id: string; name?: string | null; title?: string | null } | { id: string; name?: string | null; title?: string | null }[] | null;
};

type TopicRow = {
  id: string;
  name?: string | null;
  title?: string | null;
};

const DEFAULT_LIMIT = 15;

const difficultyClassMap: Record<string, string> = {
  junior: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  easy: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  mid: 'border-amber-200 bg-amber-50 text-amber-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  senior: 'border-rose-200 bg-rose-50 text-rose-700',
  hard: 'border-rose-200 bg-rose-50 text-rose-700',
};

function getSingleParam(
  source: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string {
  if (!source) return '';

  const value = source[key];
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

function normalizeLimit(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), 100);
}

function normalizePage(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.floor(parsed);
}

function normalizeSortBy(value: string): 'created_at' | 'title' | 'difficulty' {
  if (value === 'title' || value === 'difficulty' || value === 'created_at') return value;
  return 'created_at';
}

function normalizeSortOrder(value: string): 'asc' | 'desc' {
  return value === 'asc' ? 'asc' : 'desc';
}

function normalizeDifficulty(value: string): DifficultyInput | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === 'easy' || normalized === 'junior') return 'easy';
  if (normalized === 'medium' || normalized === 'mid') return 'medium';
  if (normalized === 'hard' || normalized === 'senior') return 'hard';

  return null;
}

function normalizeFreePreview(value: string): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function resolveTopicName(topic: QuestionRow['topic'], fallback: string): string {
  const first = Array.isArray(topic) ? topic[0] : topic;
  if (!first) return fallback;

  const name = typeof first.name === 'string' ? first.name.trim() : '';
  if (name) return name;

  const title = typeof first.title === 'string' ? first.title.trim() : '';
  return title || fallback;
}

function mapDifficultyLabel(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized === 'junior') return 'Easy';
  if (normalized === 'mid') return 'Medium';
  if (normalized === 'senior') return 'Hard';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildPageHref(
  page: number,
  params: {
    search: string;
    topicId: string;
    difficulty: '' | 'easy' | 'medium' | 'hard';
    freePreview: '' | 'true' | 'false';
    sortBy: 'created_at' | 'title' | 'difficulty';
    sortOrder: 'asc' | 'desc';
    limit: number;
  },
): string {
  const query = new URLSearchParams();

  if (params.search) query.set('search', params.search);
  if (params.topicId) query.set('topic_id', params.topicId);
  if (params.difficulty) query.set('difficulty', params.difficulty);
  if (params.freePreview) query.set('free_preview', params.freePreview);
  if (params.sortBy !== 'created_at') query.set('sort_by', params.sortBy);
  if (params.sortOrder !== 'desc') query.set('sort_order', params.sortOrder);
  if (params.limit !== DEFAULT_LIMIT) query.set('limit', String(params.limit));
  if (page > 1) query.set('page', String(page));

  const qs = query.toString();
  return qs ? `/admin/questions?${qs}` : '/admin/questions';
}

export default async function AdminQuestionsPage({ searchParams }: QuestionsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const search = getSingleParam(resolvedSearchParams, 'search').trim();
  const topicId = getSingleParam(resolvedSearchParams, 'topic_id').trim();
  const difficultyParam = normalizeDifficulty(getSingleParam(resolvedSearchParams, 'difficulty'));
  const freePreviewParam = normalizeFreePreview(getSingleParam(resolvedSearchParams, 'free_preview'));
  const sortBy = normalizeSortBy(getSingleParam(resolvedSearchParams, 'sort_by'));
  const sortOrder = normalizeSortOrder(getSingleParam(resolvedSearchParams, 'sort_order'));
  const page = normalizePage(getSingleParam(resolvedSearchParams, 'page'));
  const limit = normalizeLimit(getSingleParam(resolvedSearchParams, 'limit'));

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = createSupabaseServerClient();

  const { data: topicData, error: topicError } = await supabase.from('topics').select('*');

  const topicOptions = ((topicData ?? []) as TopicRow[])
    .map((topic) => {
      const name =
        (typeof topic.name === 'string' && topic.name.trim()) ||
        (typeof topic.title === 'string' && topic.title.trim()) ||
        '';

      if (!topic.id || !name) return null;
      return { id: topic.id, name };
    })
    .filter((topic): topic is { id: string; name: string } => Boolean(topic))
    .sort((a, b) => a.name.localeCompare(b.name));

  const runQuery = async (previewColumn: 'free_preview' | 'is_free_preview' = 'free_preview') => {
    let query = supabase
      .from('questions')
      .select(
        `
        *,
        topic:topics ( * )
      `,
        { count: 'exact' },
      )
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to);

    if (search) query = query.ilike('title', `%${search}%`);
    if (topicId) query = query.eq('topic_id', topicId);

    if (difficultyParam) {
      const dbDifficulty = mapDifficultyInputToDb(difficultyParam);
      const difficultyFilters = Array.from(new Set([difficultyParam, dbDifficulty]));
      query = query.in('difficulty', difficultyFilters);
    }

    if (freePreviewParam !== null) {
      query = query.eq(previewColumn, freePreviewParam);
    }

    return query;
  };

  let { data, error, count } = await runQuery('free_preview');
  if (error?.code === '42703' && freePreviewParam !== null) {
    const retry = await runQuery('is_free_preview');
    data = retry.data;
    error = retry.error;
    count = retry.count;
  }

  const rows = ((data ?? []) as unknown as QuestionRow[]) ?? [];
  const total = count ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const filterState = {
    search,
    topicId,
    difficulty: (difficultyParam ?? '') as '' | 'easy' | 'medium' | 'hard',
    freePreview:
      freePreviewParam === null
        ? ''
        : freePreviewParam
          ? 'true'
          : 'false',
    sortBy,
    sortOrder,
    limit,
  } as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Questions</h1>
          <p className="mt-1 text-sm text-slate-600">Search, filter, sort, and manage interview questions.</p>
        </div>
        <Link
          href="/admin/questions/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Add Question
        </Link>
      </div>

      <QuestionsFiltersToolbar topics={topicOptions} initial={filterState} />

      {topicError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load topics for filter: {topicError.message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load questions: {error.message}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Topic</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Difficulty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Free Preview</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Created At</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((question) => {
                const difficulty = question.difficulty?.toLowerCase?.() ?? 'mid';
                const difficultyClass = difficultyClassMap[difficulty] ?? 'border-slate-200 bg-slate-50 text-slate-700';
                const isFreePreview = Boolean(question.free_preview ?? question.is_free_preview ?? false);

                return (
                  <tr key={question.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-900">{question.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{question.slug ?? 'no-slug'}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{resolveTopicName(question.topic, question.topic_id)}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${difficultyClass}`}>
                        {mapDifficultyLabel(difficulty)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          isFreePreview
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        {isFreePreview ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{new Date(question.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/questions/${question.id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                        <Link
                          href={`/admin/questions/${question.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-md border border-blue-300 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                        <form action={deleteQuestionAction}>
                          <input type="hidden" name="id" value={question.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No questions found. Try adjusting your search or filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <p>
          Page {page} of {totalPages} ({total.toLocaleString()} total)
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={buildPageHref(Math.max(1, page - 1), filterState)}
            className={`rounded-md border px-3 py-1.5 ${
              page <= 1
                ? 'pointer-events-none border-slate-200 text-slate-300'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Previous
          </Link>
          <Link
            href={buildPageHref(Math.min(totalPages, page + 1), filterState)}
            className={`rounded-md border px-3 py-1.5 ${
              page >= totalPages
                ? 'pointer-events-none border-slate-200 text-slate-300'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}

