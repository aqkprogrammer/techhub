'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type TaxonomyTopic = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
};

export type TaxonomyCategoryItem = {
  id: string;
  name: string;
  slug: string;
  count: number;
  questionCount: number;
  answerCount: number;
  category: string | null;
};

type TaxonomyStatus = 'idle' | 'loading' | 'ready' | 'error';

type TaxonomyContextValue = {
  topics: TaxonomyTopic[];
  categories: TaxonomyCategoryItem[];
  status: TaxonomyStatus;
  isLoading: boolean;
  error: string | null;
  loadedAt: number | null;
  refresh: () => Promise<void>;
};

const DEFAULT_CATEGORY_TABS: TaxonomyTopic[] = [
  { id: 'fullstack', name: 'Full-Stack, Web & Mobile', slug: 'fullstack', icon: '◇' },
  { id: 'dsa', name: 'Algorithms & Data Structures', slug: 'dsa', icon: '</>' },
  { id: 'system-design', name: 'System Design & Architecture', slug: 'system-design', icon: '▣' },
  { id: 'ml', name: 'Machine Learning & Data Science', slug: 'ml', icon: '🤖' },
];

const TaxonomyContext = createContext<TaxonomyContextValue | undefined>(undefined);
const FALLBACK_TAXONOMY_CONTEXT: TaxonomyContextValue = {
  topics: DEFAULT_CATEGORY_TABS,
  categories: [],
  status: 'idle',
  isLoading: true,
  error: null,
  loadedAt: null,
  refresh: async () => undefined,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeTopics(value: unknown): TaxonomyTopic[] {
  if (!Array.isArray(value)) return [];

  const items = value
    .map((entry) => {
      const row = toObject(entry);
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      const rawSlug = typeof row.slug === 'string' ? row.slug.trim() : '';
      const slug = rawSlug || (name ? slugify(name) : '');
      if (!slug || !name) return null;

      const id =
        typeof row.id === 'string' && row.id.trim()
          ? row.id.trim()
          : slug;

      const icon = typeof row.icon === 'string' ? row.icon : null;

      return {
        id,
        name,
        slug,
        icon,
      };
    })
    .filter((item): item is TaxonomyTopic => Boolean(item));

  return items;
}

function normalizeCategories(value: unknown): TaxonomyCategoryItem[] {
  if (!Array.isArray(value)) return [];

  const items = value
    .map((entry) => {
      const row = toObject(entry);
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      const slug = typeof row.slug === 'string' ? row.slug.trim() : '';
      if (!name || !slug) return null;

      const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : slug;
      const countRaw = row.count;
      const count = typeof countRaw === 'number' ? countRaw : Number(countRaw ?? 0);
      const questionCountRaw = row.questionCount;
      const questionCount =
        typeof questionCountRaw === 'number' ? questionCountRaw : Number(questionCountRaw ?? count);
      const answerCountRaw = row.answerCount;
      const answerCount =
        typeof answerCountRaw === 'number' ? answerCountRaw : Number(answerCountRaw ?? 0);
      const category = typeof row.category === 'string' ? row.category : null;

      return {
        id,
        name,
        slug,
        count: Number.isFinite(count) ? count : 0,
        questionCount: Number.isFinite(questionCount) ? questionCount : 0,
        answerCount: Number.isFinite(answerCount) ? answerCount : 0,
        category,
      };
    })
    .filter((item): item is TaxonomyCategoryItem => Boolean(item));

  return items;
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    method: 'GET',
    next: { revalidate: 300 },
  } as RequestInit);

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export function TaxonomyProvider({ children }: { children: ReactNode }) {
  const [topics, setTopics] = useState<TaxonomyTopic[]>(DEFAULT_CATEGORY_TABS);
  const [categories, setCategories] = useState<TaxonomyCategoryItem[]>([]);
  const [status, setStatus] = useState<TaxonomyStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  const loadedRef = useRef(false);
  const inflightRef = useRef<Promise<void> | null>(null);

  const load = useCallback(async (force = false) => {
    if (!force && loadedRef.current) return;
    if (!force && inflightRef.current) {
      await inflightRef.current;
      return;
    }

    const task = (async () => {
      setStatus('loading');
      setError(null);

      const [topicsResult, categoriesResult] = await Promise.allSettled([
        fetchJson('/api/topics'),
        fetchJson('/api/categories'),
      ]);

      const issues: string[] = [];

      if (topicsResult.status === 'fulfilled') {
        const nextTopics = normalizeTopics(toObject(topicsResult.value).topics);
        if (nextTopics.length > 0) {
          setTopics(nextTopics);
        }
      } else {
        issues.push(topicsResult.reason instanceof Error ? topicsResult.reason.message : 'Failed to load /api/topics');
      }

      if (categoriesResult.status === 'fulfilled') {
        const nextCategories = normalizeCategories(toObject(categoriesResult.value).items);
        setCategories(nextCategories);
      } else {
        issues.push(
          categoriesResult.reason instanceof Error ? categoriesResult.reason.message : 'Failed to load /api/categories'
        );
      }

      if (issues.length > 0) {
        setError(issues.join(' | '));
        setStatus(issues.length === 2 ? 'error' : 'ready');
      } else {
        setStatus('ready');
      }

      setLoadedAt(Date.now());
      loadedRef.current = true;
    })();

    inflightRef.current = task;

    try {
      await task;
    } finally {
      if (inflightRef.current === task) {
        inflightRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    loadedRef.current = false;
    await load(true);
  }, [load]);

  const value = useMemo<TaxonomyContextValue>(
    () => ({
      topics,
      categories,
      status,
      isLoading: status === 'loading' || status === 'idle',
      error,
      loadedAt,
      refresh,
    }),
    [topics, categories, status, error, loadedAt, refresh]
  );

  return <TaxonomyContext.Provider value={value}>{children}</TaxonomyContext.Provider>;
}

export function useTaxonomy() {
  const context = useContext(TaxonomyContext);
  if (!context) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('useTaxonomy rendered outside TaxonomyProvider. Falling back to default taxonomy context.');
    }
    return FALLBACK_TAXONOMY_CONTEXT;
  }
  return context;
}
