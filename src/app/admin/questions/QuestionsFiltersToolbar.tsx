'use client';

import { Loader2, RotateCcw, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

type TopicOption = {
  id: string;
  name: string;
};

type QuestionsFiltersToolbarProps = {
  topics: TopicOption[];
  initial: {
    search: string;
    topicId: string;
    difficulty: '' | 'easy' | 'medium' | 'hard';
    freePreview: '' | 'true' | 'false';
    sortBy: 'created_at' | 'title' | 'difficulty';
    sortOrder: 'asc' | 'desc';
    limit: number;
  };
};

const SEARCH_DEBOUNCE_MS = 400;

function normalizeLimit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 15;
  return Math.min(Math.floor(value), 100);
}

export default function QuestionsFiltersToolbar({ topics, initial }: QuestionsFiltersToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(initial.search);
  const [topicId, setTopicId] = useState(initial.topicId);
  const [difficulty, setDifficulty] = useState(initial.difficulty);
  const [freePreview, setFreePreview] = useState(initial.freePreview);
  const [sortBy, setSortBy] = useState(initial.sortBy);
  const [sortOrder, setSortOrder] = useState(initial.sortOrder);
  const [limit, setLimit] = useState<number>(normalizeLimit(initial.limit));

  const hasInitializedSearchEffect = useRef(false);

  const applyFilters = (overrides?: Partial<QuestionsFiltersToolbarProps['initial']>) => {
    const next = {
      search,
      topicId,
      difficulty,
      freePreview,
      sortBy,
      sortOrder,
      limit,
      ...overrides,
    };

    const nextParams = new URLSearchParams(searchParams.toString());

    nextParams.delete('page');

    if (next.search.trim()) nextParams.set('search', next.search.trim());
    else nextParams.delete('search');

    if (next.topicId) nextParams.set('topic_id', next.topicId);
    else nextParams.delete('topic_id');

    if (next.difficulty) nextParams.set('difficulty', next.difficulty);
    else nextParams.delete('difficulty');

    if (next.freePreview) nextParams.set('free_preview', next.freePreview);
    else nextParams.delete('free_preview');

    if (next.sortBy !== 'created_at') nextParams.set('sort_by', next.sortBy);
    else nextParams.delete('sort_by');

    if (next.sortOrder !== 'desc') nextParams.set('sort_order', next.sortOrder);
    else nextParams.delete('sort_order');

    if (next.limit !== 15) nextParams.set('limit', String(next.limit));
    else nextParams.delete('limit');

    const queryString = nextParams.toString();
    const href = queryString ? `${pathname}?${queryString}` : pathname;

    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  };

  useEffect(() => {
    if (!hasInitializedSearchEffect.current) {
      hasInitializedSearchEffect.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      applyFilters({ search });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  const clearFilters = () => {
    setSearch('');
    setTopicId('');
    setDifficulty('');
    setFreePreview('');
    setSortBy('created_at');
    setSortOrder('desc');
    setLimit(15);

    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search question title..."
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <select
          value={topicId}
          onChange={(event) => {
            const value = event.target.value;
            setTopicId(value);
            applyFilters({ topicId: value });
          }}
          className="min-w-[170px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          <option value="">All topics</option>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.name}
            </option>
          ))}
        </select>

        <select
          value={difficulty}
          onChange={(event) => {
            const value = event.target.value as '' | 'easy' | 'medium' | 'hard';
            setDifficulty(value);
            applyFilters({ difficulty: value });
          }}
          className="min-w-[130px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          <option value="">All difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>

        <select
          value={freePreview}
          onChange={(event) => {
            const value = event.target.value as '' | 'true' | 'false';
            setFreePreview(value);
            applyFilters({ freePreview: value });
          }}
          className="min-w-[160px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          <option value="">All preview types</option>
          <option value="true">Free preview only</option>
          <option value="false">Paid only</option>
        </select>

        <select
          value={sortBy}
          onChange={(event) => {
            const value = event.target.value as 'created_at' | 'title' | 'difficulty';
            setSortBy(value);
            applyFilters({ sortBy: value });
          }}
          className="min-w-[140px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          <option value="created_at">Sort: Created</option>
          <option value="title">Sort: Title</option>
          <option value="difficulty">Sort: Difficulty</option>
        </select>

        <select
          value={sortOrder}
          onChange={(event) => {
            const value = event.target.value as 'asc' | 'desc';
            setSortOrder(value);
            applyFilters({ sortOrder: value });
          }}
          className="min-w-[120px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>

        <select
          value={String(limit)}
          onChange={(event) => {
            const value = normalizeLimit(Number(event.target.value));
            setLimit(value);
            applyFilters({ limit: value });
          }}
          className="min-w-[110px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          <option value="10">10 / page</option>
          <option value="15">15 / page</option>
          <option value="25">25 / page</option>
          <option value="50">50 / page</option>
        </select>

        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      <div className="mt-2 min-h-5 text-xs text-slate-500">
        {isPending ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating results...
          </span>
        ) : (
          'Search is debounced by 400ms to reduce API calls.'
        )}
      </div>
    </section>
  );
}

