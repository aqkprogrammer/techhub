'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

import { useTaxonomy } from '@/components/taxonomy-provider';

import { getTopicIcon, type TopicDisplay } from '../topics-by-category';

type BrowserTopic = TopicDisplay & {
  id?: string;
};

type TopicCategoriesBrowserProps = {
  topics: BrowserTopic[];
  categorySlug: string;
  initialActiveTopicSlug?: string;
  hiring?: boolean;
  categoryNav?: ReactNode;
  questionsContent?: ReactNode;
};

function withHiring(href: string, hiring: boolean): string {
  if (!hiring) return href;
  const hashIndex = href.indexOf('#');
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
  const [path, query] = withoutHash.split('?');
  const params = new URLSearchParams(query ?? '');
  params.set('hiring', 'true');
  const qs = params.toString();
  return qs ? `${path}?${qs}${hash}` : `${path}${hash}`;
}

function QuestionsLoadingSkeleton() {
  return (
    <div className="mt-12 space-y-4" aria-busy="true" aria-label="Loading questions">
      <div className="flex flex-col gap-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-14 w-14 animate-pulse rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--accent))]/10" />
          <div className="h-7 w-64 animate-pulse rounded-lg bg-[rgb(var(--border))]/70" />
          <div className="flex gap-2">
            {[56, 64, 72, 72].map((w, i) => (
              <div
                key={i}
                className="h-7 animate-pulse rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))]"
                style={{ width: `${w}px` }}
              />
            ))}
          </div>
        </div>
        <div className="border-t border-[rgb(var(--border))] pt-4">
          <div className="flex items-center gap-2">
            {[72, 64, 56, 60].map((w, i) => (
              <div
                key={i}
                className="h-9 animate-pulse rounded-lg bg-[rgb(var(--border))]/60"
                style={{ width: `${w}px` }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 px-1">
        <svg className="h-4 w-4 animate-spin text-[rgb(var(--accent))]" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-xs text-[rgb(var(--muted))]">Loading questions…</span>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-14 animate-pulse rounded-full bg-[rgb(var(--border))]/80" />
                  <div className="h-5 w-20 animate-pulse rounded-full bg-[rgb(var(--border))]/50" />
                </div>
                <div className="h-5 w-3/4 animate-pulse rounded bg-[rgb(var(--border))]/70" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-[rgb(var(--border))]/40" />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="h-8 w-8 animate-pulse rounded border border-[rgb(var(--border))] bg-[rgb(var(--border))]/40" />
                <div className="h-8 w-8 animate-pulse rounded border border-[rgb(var(--border))] bg-[rgb(var(--border))]/40" />
                <div className="h-8 w-8 animate-pulse rounded border border-[rgb(var(--border))] bg-[rgb(var(--border))]/40" />
                <div className="h-8 w-16 animate-pulse rounded-lg bg-[rgb(var(--accent))]/15" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TopicCategoriesBrowser({
  topics,
  categorySlug,
  initialActiveTopicSlug,
  hiring,
  categoryNav,
  questionsContent,
}: TopicCategoriesBrowserProps) {
  const { categories, isLoading, error } = useTaxonomy();
  const pathname = usePathname();
  const [selectedTopicSlug, setSelectedTopicSlug] = useState<string | undefined>(initialActiveTopicSlug);
  const [navigating, setNavigating] = useState(false);

  const apiTopics = useMemo(
    () =>
      categories
        .filter((item) => item.category === categorySlug)
        .map((item) => ({
          id: item.id,
          name: item.name,
          slug: item.slug,
          count: item.count,
        })),
    [categories, categorySlug]
  );

  const topicTiles = useMemo(() => (apiTopics.length > 0 ? apiTopics : topics), [apiTopics, topics]);

  useEffect(() => {
    setSelectedTopicSlug(initialActiveTopicSlug);
  }, [initialActiveTopicSlug]);

  useEffect(() => {
    function onNavigating() {
      setNavigating(true);
    }
    window.addEventListener('topicnavigating', onNavigating);
    return () => window.removeEventListener('topicnavigating', onNavigating);
  }, []);

  useEffect(() => {
    setNavigating(false);
  }, [pathname]);

  if (isLoading && topicTiles.length === 0) {
    return (
      <>
        <section className="mt-10 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] shadow-sm">
          {categoryNav && (
            <nav
              className="flex flex-nowrap justify-center gap-0.5 overflow-x-auto border-b border-[rgb(var(--border))] bg-[rgb(var(--bg))]/40 px-3 pt-3 pb-0"
              aria-label="Question categories"
            >
              {categoryNav}
            </nav>
          )}
          <div className="flex flex-wrap gap-1.5 p-3" aria-busy="true" aria-label="Loading topics">
            {Array.from({ length: 14 }).map((_, i) => (
              <div
                key={i}
                className="inline-flex h-[42px] animate-pulse items-center gap-1.5 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-2.5"
                style={{ width: `${80 + (i % 5) * 18}px` }}
              >
                <div className="h-7 w-7 shrink-0 rounded bg-[rgb(var(--border))]/70" />
                <div className="h-3 flex-1 rounded bg-[rgb(var(--border))]/70" />
              </div>
            ))}
          </div>
        </section>
        {questionsContent}
      </>
    );
  }

  return (
    <>
      <section className="mt-10 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] shadow-sm">
        {categoryNav && (
          <nav
            className="flex flex-nowrap justify-center gap-0.5 overflow-x-auto border-b border-[rgb(var(--border))] bg-[rgb(var(--bg))]/40 px-3 pt-3 pb-0"
            aria-label="Question categories"
          >
            {categoryNav}
          </nav>
        )}
        <div className="relative flex flex-wrap gap-1.5 p-3">
          {isLoading && (
            <div className="absolute right-3 top-3 z-10">
              <svg
                className="h-3.5 w-3.5 animate-spin text-[rgb(var(--accent))]/60"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
          {topicTiles.filter((topic) => topic.count > 0).map((topic) => {
            const icon = getTopicIcon(topic);
            const isShortIcon = icon.length <= 2;
            const active = selectedTopicSlug === topic.slug;
            const href = withHiring(
              `/interview-questions/${categorySlug}/${topic.slug}#questions`,
              hiring ?? false
            );

            return (
              <Link
                key={topic.slug}
                href={href}
                onClick={() => {
                  setSelectedTopicSlug(topic.slug);
                  window.dispatchEvent(new CustomEvent('topicnavigating'));
                }}
                className={`group inline-flex w-max items-center gap-1.5 rounded-md border px-2.5 py-2 text-left text-sm transition ${
                  active
                    ? 'border-[rgb(var(--accent))]/50 bg-[rgb(var(--accent))]/10 text-[rgb(var(--text))]'
                    : 'border-[rgb(var(--border))] bg-[rgb(var(--bg))] text-[rgb(var(--text))] hover:border-[rgb(var(--accent))]/30 hover:bg-[rgb(var(--card))]'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${
                    isShortIcon ? 'text-sm font-bold' : 'text-base'
                  } ${
                    active
                      ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))]'
                      : 'bg-[rgb(var(--card))] text-[rgb(var(--muted))] group-hover:text-[rgb(var(--accent))]'
                  }`}
                  aria-hidden
                >
                  {icon}
                </span>
                <span className="whitespace-nowrap font-medium text-[rgb(var(--text))]">{topic.name}</span>
                <span
                  className={`shrink-0 text-xs font-semibold tabular-nums ${
                    active ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--muted))]'
                  }`}
                >
                  {topic.count}
                </span>
              </Link>
            );
          })}
        </div>

        {!isLoading && error && (
          <div className="border-t border-[rgb(var(--border))] px-4 py-2 text-sm">
            <p className="text-red-500">{error}</p>
          </div>
        )}
      </section>

      {navigating ? <QuestionsLoadingSkeleton /> : questionsContent}
    </>
  );
}
