'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Bot, Braces, Code, Layers } from 'lucide-react';

import { useTaxonomy } from '@/components/taxonomy-provider';

type TopicsSectionProps = {
  activeCategorySlug?: string;
  hiring?: boolean;
};

type CategoryTab = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
};

const DEFAULT_TABS: CategoryTab[] = [
  { id: 'fullstack', name: 'Full-Stack, Web & Mobile', slug: 'fullstack', icon: '◇' },
  { id: 'dsa', name: 'Algorithms & Data Structures', slug: 'dsa', icon: '</>' },
  { id: 'system-design', name: 'System Design & Architecture', slug: 'system-design', icon: '▣' },
  { id: 'ml', name: 'Machine Learning & Data Science', slug: 'ml', icon: '🤖' },
];

const DEFAULT_TAB_BY_SLUG = new Map(DEFAULT_TABS.map((tab) => [tab.slug, tab]));

function withHiring(href: string, hiring: boolean): string {
  if (!hiring) return href;
  const [path, query] = href.split('?');
  const params = new URLSearchParams(query ?? '');
  params.set('hiring', 'true');
  const nextQuery = params.toString();
  return nextQuery ? `${path}?${nextQuery}` : path;
}

function iconForSlug(slug: string) {
  if (slug === 'fullstack') return '◇';
  if (slug === 'dsa') return '</>';
  if (slug === 'system-design') return '▣';
  if (slug === 'ml') return '🤖';
  return '•';
}

function CategoryIcon({ icon, slug }: { icon: string | null; slug: string }) {
  const value = (icon ?? '').trim().toLowerCase();

  if (value === 'code') return <Code className="h-3.5 w-3.5" aria-hidden />;
  if (value === 'braces') return <Braces className="h-3.5 w-3.5" aria-hidden />;
  if (value === 'layers') return <Layers className="h-3.5 w-3.5" aria-hidden />;
  if (value === 'bot') return <Bot className="h-3.5 w-3.5" aria-hidden />;

  return <span aria-hidden>{icon && icon.length <= 3 ? icon : iconForSlug(slug)}</span>;
}

export default function TopicsSection({ activeCategorySlug, hiring }: TopicsSectionProps) {
  const { topics, isLoading } = useTaxonomy();

  const tabs = useMemo(() => {
    const bySlug = new Map(
      topics
        .filter((topic) => DEFAULT_TAB_BY_SLUG.has(topic.slug))
        .map((topic) => [
          topic.slug,
          {
            id: topic.id,
            name: topic.name,
            slug: topic.slug,
            icon: topic.icon ?? iconForSlug(topic.slug),
          } satisfies CategoryTab,
        ])
    );

    return DEFAULT_TABS.map((fallback) => bySlug.get(fallback.slug) ?? fallback);
  }, [topics]);

  return (
    <>
      {tabs.map((topic) => {
        const isActive = activeCategorySlug === topic.slug;
        const href = withHiring(`/interview-questions/${topic.slug}`, hiring ?? false);

        return (
          <Link
            key={topic.slug}
            href={href}
            onClick={() => {
              if (!isActive) window.dispatchEvent(new CustomEvent('topicnavigating'));
            }}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg border border-b-0 px-2.5 py-2 text-sm font-semibold transition ${
              isActive
                ? 'border-[rgb(var(--border))] border-b-[rgb(var(--card))] bg-[rgb(var(--card))] text-[rgb(var(--text))]'
                : 'border-transparent text-[rgb(var(--muted))] hover:bg-[rgb(var(--bg))]/60 hover:text-[rgb(var(--text))]'
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs ${
                isActive
                  ? 'bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]'
                  : 'bg-[rgb(var(--bg))] text-[rgb(var(--muted))]'
              }`}
            >
              <CategoryIcon icon={topic.icon} slug={topic.slug} />
            </span>
            <span>{topic.name}</span>
          </Link>
        );
      })}

      {isLoading && (
        <span className="ml-2 shrink-0 self-center text-xs text-[rgb(var(--muted))]">Loading...</span>
      )}
    </>
  );
}
