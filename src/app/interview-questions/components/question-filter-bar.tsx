'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';

import type { Difficulty } from '../data';
import { usePdfExport } from './pdf-export-context';

const difficultyOptions: { value: Difficulty | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
];

type QuestionFilterBarProps = {
  topicSlug?: string;
  categorySlug?: string;
  activeDifficulty?: Difficulty;
  companyId?: string;
  hiring?: boolean;
  codeOnly?: boolean;
};

function buildHref(
  topicSlug: string | undefined,
  categorySlug: string | undefined,
  difficulty: Difficulty | undefined,
  companyId: string | undefined,
  search?: string,
  hiring?: boolean,
  codeOnly?: boolean,
) {
  let path = '/interview-questions';
  if (topicSlug && categorySlug) {
    path = `/interview-questions/${categorySlug}/${topicSlug}`;
  } else if (topicSlug) {
    path = `/interview-questions/${topicSlug}`;
  } else if (categorySlug) {
    path = `/interview-questions/${categorySlug}`;
  }
  const params = new URLSearchParams();
  if (difficulty) params.set('difficulty', difficulty);
  if (companyId) params.set('company', companyId);
  if (search) params.set('q', search);
  if (hiring) params.set('hiring', 'true');
  if (codeOnly) params.set('code', '1');
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export default function QuestionFilterBar({
  topicSlug,
  categorySlug,
  activeDifficulty,
  companyId,
  hiring,
  codeOnly: codeOnlyProp = false,
}: QuestionFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const codeOnly = searchParams.get('code') === '1' || codeOnlyProp;
  const [search, setSearch] = useState(q);
  const {
    selectedCount,
    isDownloading,
    downloadError,
    downloadPdf,
    clearSelection,
  } = usePdfExport();

  const syncCodeOnlyToUrl = useCallback(
    (value: boolean) => {
      const url = buildHref(
        topicSlug,
        categorySlug,
        activeDifficulty ?? undefined,
        companyId,
        search || undefined,
        hiring,
        value,
      );
      router.push(url, { scroll: false });
    },
    [router, topicSlug, categorySlug, activeDifficulty, companyId, search, hiring],
  );

  const handleSearchSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const url = buildHref(
        topicSlug,
        categorySlug,
        activeDifficulty ?? undefined,
        companyId,
        search || undefined,
        hiring,
        codeOnly,
      );
      router.push(url, { scroll: false });
    },
    [router, topicSlug, categorySlug, activeDifficulty, companyId, search, hiring, codeOnly],
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        {difficultyOptions.map((opt) => {
          const isActive = (opt.value === null && !activeDifficulty) || opt.value === activeDifficulty;
          const href = buildHref(
            topicSlug,
            categorySlug,
            opt.value ?? undefined,
            companyId,
            search || undefined,
            hiring,
            codeOnly,
          );
          return (
            <Link
              key={opt.label}
              href={href}
              scroll={false}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'bg-[rgb(var(--accent))] text-white'
                  : 'border border-[rgb(var(--border))] text-[rgb(var(--text))] hover:border-[rgb(var(--accent))]'
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
        <label className="ml-2 flex cursor-pointer items-center gap-2 text-sm text-[rgb(var(--muted))]">
          <input
            type="checkbox"
            checked={codeOnly}
            onChange={(e) => syncCodeOnlyToUrl(e.target.checked)}
            className="h-4 w-4 rounded border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--accent))]"
            aria-label="Only code challenges"
          />
          <span>Only code challenges</span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center">
          <input
            type="search"
            placeholder={hiring ? 'Search Question by Title...' : 'Search question by title...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-4 py-2 text-sm text-[rgb(var(--text))] placeholder:text-[rgb(var(--muted))] focus:border-[rgb(var(--accent))] focus:outline-none"
            aria-label="Search questions"
          />
        </form>
        <button
          type="button"
          onClick={() => {
            void downloadPdf();
          }}
          disabled={isDownloading || selectedCount == 0}
          className="flex items-center gap-2 rounded-full border border-[rgb(var(--border))] px-4 py-2 text-sm font-semibold text-[rgb(var(--text))] transition hover:border-[rgb(var(--accent))]"
          title={
            hiring
              ? 'Download your selected screening plan as PDF'
              : 'Download selected interview questions as PDF'
          }
        >
          {isDownloading ? (
            <>
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[rgb(var(--accent))]/30 border-t-[rgb(var(--accent))]"
                aria-hidden
              />
              {hiring ? 'Preparing plan PDF...' : 'Preparing PDF...'}
            </>
          ) : hiring ? (
            <>
              <span aria-hidden>↓</span> Download Screening Plan PDF ({selectedCount || 'All'})
            </>
          ) : (
            <>
              <span aria-hidden>↓</span> Download Q&A PDF ({selectedCount || 'All'})
            </>
          )}
        </button>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={clearSelection}
            disabled={isDownloading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgb(var(--border))] text-[rgb(var(--muted))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--text))]"
            aria-label="Clear selection"
            title="Clear selection"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {downloadError && (
        <p className="w-full text-xs text-red-500">{downloadError}</p>
      )}
    </div>
  );
}
