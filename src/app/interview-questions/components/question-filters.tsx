import type { ReactNode } from 'react';
import Link from 'next/link';

import type { CompanyOption, Difficulty, TopicOption } from '../data';

const difficultyOptions: Difficulty[] = ['junior', 'mid', 'senior'];

type QuestionFiltersProps = {
  topics: TopicOption[];
  companies: CompanyOption[];
  activeTopicSlug?: string;
  activeDifficulty?: Difficulty;
  activeCompanyId?: string;
};

function buildHref(
  base: {
    topicSlug?: string;
    difficulty?: Difficulty;
    companyId?: string;
  },
  overrides: Partial<{
    topicSlug?: string;
    difficulty?: Difficulty;
    companyId?: string;
  }>,
) {
  const next = { ...base, ...overrides };
  const path = next.topicSlug ? `/interview-questions/${next.topicSlug}` : '/interview-questions';
  const params = new URLSearchParams();

  if (next.difficulty) params.set('difficulty', next.difficulty);
  if (next.companyId) params.set('company', next.companyId);

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
        active
          ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
          : 'border-[rgb(var(--border))] text-[rgb(var(--text))] hover:border-[rgb(var(--accent))]'
      }`}
    >
      {children}
    </Link>
  );
}

export default function QuestionFilters({
  topics,
  companies,
  activeTopicSlug,
  activeDifficulty,
  activeCompanyId,
}: QuestionFiltersProps) {
  const base = {
    topicSlug: activeTopicSlug,
    difficulty: activeDifficulty,
    companyId: activeCompanyId,
  };

  return (
    <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-[rgb(var(--muted))]">
            Topics
          </p>
          <div className="flex flex-wrap gap-2">
            <FilterChip href={buildHref(base, { topicSlug: undefined })} active={!activeTopicSlug}>
              All topics
            </FilterChip>
            {topics.map((topic) => (
              <FilterChip
                key={topic.id}
                href={buildHref(base, { topicSlug: topic.slug })}
                active={activeTopicSlug === topic.slug}
              >
                {topic.name}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-[rgb(var(--muted))]">
            Difficulty
          </p>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              href={buildHref(base, { difficulty: undefined })}
              active={!activeDifficulty}
            >
              Any
            </FilterChip>
            {difficultyOptions.map((level) => (
              <FilterChip
                key={level}
                href={buildHref(base, { difficulty: level })}
                active={activeDifficulty === level}
              >
                {level}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-[rgb(var(--muted))]">
            Company
          </p>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              href={buildHref(base, { companyId: undefined })}
              active={!activeCompanyId}
            >
              All companies
            </FilterChip>
            {companies.map((company) => (
              <FilterChip
                key={company.id}
                href={buildHref(base, { companyId: company.id })}
                active={activeCompanyId === company.id}
              >
                {company.name}
              </FilterChip>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
