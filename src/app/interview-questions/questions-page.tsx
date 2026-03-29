import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import QuestionFilterBar from './components/question-filter-bar';
import { PdfExportProvider } from './components/pdf-export-context';
import QuestionsWithProgress from './components/questions-with-progress';
import ScrollToQuestions from './components/scroll-to-questions';
import TopicCategoriesBrowser from './components/topic-categories-browser';
import {
  getQuestionListingData,
  type Difficulty,
  type QuestionListingData,
} from './data';
import {
  // CATEGORIES,
  type CategoryId,
  getTopicIcon,
  type TopicDisplay,
} from './topics-by-category';
import TopicsSection from './TopicsSection';

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleParam(param?: string | string[]) {
  if (!param) return undefined;
  return Array.isArray(param) ? param[0] : param;
}

function parseDifficulty(value?: string): Difficulty | undefined {
  if (value === 'junior' || value === 'mid' || value === 'senior') return value;
  return undefined;
}

type QuestionsPageProps = {
  searchParams?: SearchParams;
  topicSlug?: string;
};

function buildTitle(data: QuestionListingData) {
  if (data.activeTopic) return `Top ${data.questions.length} ${data.activeTopic.name} Interview Questions`;
  const total = data.topics.reduce((sum, t) => sum + (t.questionCount ?? 0), 0);
  return total > 0 ? `Interview Questions` : `Top Interview Questions`;
}

export async function generateQuestionsMetadata(
  topicSlug?: string,
  searchParams?: SearchParams,
): Promise<Metadata> {
  const difficulty = parseDifficulty(getSingleParam(searchParams?.difficulty));
  const companyId = getSingleParam(searchParams?.company);
  const category = parseCategory(getSingleParam(searchParams?.category));

  const data = await getQuestionListingData({
    topicSlug,
    category,
    difficulty,
    companyId,
  });

  if (topicSlug && !data.activeTopic) {
    return {
      title: 'Questions Not Found',
      description: 'No interview questions found for this topic.',
    };
  }

  const title = buildTitle(data);
  const description = data.activeTopic
    ? `${data.questions.length > 0 ? `${data.questions.length}+ ` : ''}${data.activeTopic.name} interview questions with short answers, deep explanations, real-world examples and common mistakes. Filter by difficulty and company.`
    : 'Curated technical interview questions across Full-Stack, JavaScript, TypeScript, React, Node.js, DSA, System Design and ML — with full answers.';

  const canonicalPath = topicSlug && data.activeTopic
    ? `/interview-questions/${category}/${data.activeTopic.slug}`
    : category
      ? `/interview-questions/${category}`
      : '/interview-questions';

  const keywords = [
    ...(data.activeTopic ? [`${data.activeTopic.name} interview questions`, `${data.activeTopic.name} interview prep`] : []),
    'technical interview questions',
    'coding interview',
    'interview preparation',
    ...(difficulty ? [`${difficulty} level interview`] : []),
  ];

  return {
    title: `${title} | techhub.cafe`,
    description,
    keywords,
    openGraph: {
      title: `${title} | techhub.cafe`,
      description,
      url: `https://techhub.cafe${canonicalPath}`,
      type: 'website',
      siteName: 'techhub.cafe',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | techhub.cafe`,
      description,
    },
    alternates: { canonical: `https://techhub.cafe${canonicalPath}` },
  };
}

function buildHref(
  base: { topicSlug?: string; difficulty?: Difficulty; companyId?: string; hiring?: boolean; category?: CategoryId },
  overrides: Partial<{ topicSlug?: string; difficulty?: Difficulty; companyId?: string; hiring?: boolean; category?: CategoryId }>,
) {
  const next = { ...base, ...overrides };
  let path = '/interview-questions';
  if (next.topicSlug && next.category) {
    path = `/interview-questions/${next.category}/${next.topicSlug}`;
  } else if (next.topicSlug) {
    path = `/interview-questions/${next.topicSlug}`;
  } else if (next.category) {
    path = `/interview-questions/${next.category}`;
  }
  const params = new URLSearchParams();
  if (next.difficulty) params.set('difficulty', next.difficulty);
  if (next.companyId) params.set('company', next.companyId);
  if (next.hiring) params.set('hiring', 'true');
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

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

function parseCategory(value?: string): CategoryId {
  if (value === 'fullstack' || value === 'dsa' || value === 'system-design' || value === 'ml') return value;
  return 'fullstack';
}

export default async function QuestionsPage({ searchParams, topicSlug }: QuestionsPageProps) {
  const difficulty = parseDifficulty(getSingleParam(searchParams?.difficulty));
  const companyId = getSingleParam(searchParams?.company);
  const q = getSingleParam(searchParams?.q)?.toLowerCase() ?? '';
  const category = parseCategory(getSingleParam(searchParams?.category));
  const hiring = getSingleParam(searchParams?.hiring) === 'true';
  const codeOnly = getSingleParam(searchParams?.code) === '1';

  const data = await getQuestionListingData({
    topicSlug,
    category,
    difficulty,
    companyId,
    codeOnly,
  });

  if (topicSlug && !data.activeTopic) {
    notFound();
  }

  const base = { topicSlug: data.activeTopic?.slug, difficulty, companyId, hiring, category };
  const totalCount = data.totalQuestions ?? data.topics.reduce((sum, t) => sum + (t.questionCount ?? 0), 0);
  const totalCountLabel = totalCount.toLocaleString();
  const filteredQuestions = q
    ? data.questions.filter((question) => question.title.toLowerCase().includes(q))
    : data.questions;
  const sectionTitle = buildTitle(data);
  const displayTopics: TopicDisplay[] = data.topics
    .filter((topic) => topic.category === category)
    .map((topic) => ({
      id: topic.id,
      name: topic.name,
      slug: topic.slug,
      count: topic.questionCount ?? 0,
    }));

  return (
    <main className="min-h-screen bg-[rgb(var(--card))]/30">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        {/* Hero */}
        <section className="space-y-5 text-center">
          {hiring ? (
            <>
              <h1 className="text-4xl font-bold leading-tight text-[rgb(var(--text))] sm:text-5xl">
                Tech Screening. Solved.
              </h1>
              <p className="text-lg text-[rgb(var(--text))] sm:text-xl">
                <span className="rounded-md bg-[rgb(var(--accent))]/20 px-2 py-0.5 font-bold text-[rgb(var(--accent))]">
                  Ask
                </span>{' '}
                Tech Questions With Confidence.{' '}
                <span className="rounded-md bg-[rgb(var(--accent))]/20 px-2 py-0.5 font-bold text-[rgb(var(--accent))]">
                  Qualify
                </span>{' '}
                Top Talents in Less Time.
              </p>
              <p className="text-base font-medium text-[rgb(var(--muted))]">
                Made For Tech Recruiters, Team Leads and CTOs.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href={withHiring('/interview-questions', true)}
                  className="rounded-lg bg-[rgb(var(--accent))] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
                >
                  Create Screening Plan
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-bold leading-tight text-[rgb(var(--text))] sm:text-5xl">
                Kill Your Tech Interview
              </h1>
              <p className="text-lg text-[rgb(var(--text))] sm:text-xl">
                <span className="rounded-md bg-[rgb(var(--accent))]/20 px-2 py-0.5 font-bold text-[rgb(var(--accent))]">
                  {totalCountLabel}
                </span>{' '}
                Full-Stack, Algorithms & System Design{' '}
                <span className="rounded-md bg-[rgb(var(--accent))]/20 px-2 py-0.5 font-bold text-[rgb(var(--accent))]">
                  Interview Questions
                </span>
              </p>
              <p className="text-base font-medium text-[rgb(var(--text))]">
                Answered To Get Your Next Six-Figure Job Offer
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/interview-questions"
                  className="rounded-lg bg-[rgb(var(--accent))] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
                >
                  See All Questions
                </Link>
                <Link
                  href={withHiring('/interview-questions/ml', hiring)}
                  className="rounded-lg px-6 py-3 text-sm font-semibold text-[rgb(var(--accent))] transition hover:underline"
                >
                  Data Science & ML QAs
                </Link>
              </div>
            </>
          )}
        </section>

        {/* Category tabs + topic grid + questions content */}
        <TopicCategoriesBrowser
          topics={displayTopics}
          categorySlug={category}
          initialActiveTopicSlug={data.activeTopic?.slug}
          hiring={hiring}
          categoryNav={<TopicsSection activeCategorySlug={category} hiring={hiring} />}
          questionsContent={
            !data.activeTopic ? (
              <>
                {/* When no topic selected: Featured + Article list */}
                <section className="mt-12">
                  <h2 className="mb-6 text-xl font-bold text-[rgb(var(--text))]">Featured</h2>
                  <div className="grid gap-6 sm:grid-cols-3">
                    {displayTopics.slice(0, 3).map((topic) => (
                      <FeaturedCard key={topic.slug} topic={topic} category={category} hiring={hiring} />
                    ))}
                  </div>
                </section>
                <section className="mt-12">
                  <div className="space-y-6">
                    {displayTopics.slice(3, 9).map((topic) => (
                      <ArticleRow key={topic.slug} topic={topic} category={category} hiring={hiring} />
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <>
                {/* When topic selected: Combined header + filter bar + Question list */}
                <PdfExportProvider questionIds={filteredQuestions.map((question) => question.id)}>
                  <ScrollToQuestions />
                  <section id="questions" className="mt-12 flex flex-col gap-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--accent))]/10 text-2xl text-[rgb(var(--accent))]">
                        {getTopicIcon({
                          name: data.activeTopic.name,
                          slug: data.activeTopic.slug,
                          count: data.questions.length,
                        })}
                      </div>
                      <h2 className="text-xl font-bold text-[rgb(var(--text))] sm:text-2xl">{sectionTitle}</h2>
                      <div className="flex flex-wrap justify-center gap-2">
                        {['Share', 'Twitter', 'LinkedIn', 'Copy link'].map((label) => (
                          <button
                            key={label}
                            type="button"
                            className="rounded-full border border-[rgb(var(--border))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--muted))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--text))]"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-[rgb(var(--border))] pt-4">
                      <Suspense fallback={<div className="h-14 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))]" />}>
                        <QuestionFilterBar
                          topicSlug={data.activeTopic.slug}
                          categorySlug={category}
                          activeDifficulty={difficulty}
                          companyId={companyId}
                          hiring={hiring}
                          codeOnly={codeOnly}
                        />
                      </Suspense>
                    </div>
                  </section>
                  <section className="mt-8 space-y-4 scroll-mt-6">
                    <p className="text-xs uppercase tracking-[0.3em] text-[rgb(var(--muted))]">
                      {codeOnly ? 'Code challenges' : 'Theoretical questions'}
                    </p>
                    {filteredQuestions.length ? (
                      <QuestionsWithProgress
                        questions={filteredQuestions}
                        totalQuestions={data.questions.length}
                        hiring={hiring}
                      />
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--card))] p-10 text-center">
                        <p className="text-sm font-semibold text-[rgb(var(--text))]">
                          No questions match these filters yet.
                        </p>
                        <p className="mt-2 text-xs text-[rgb(var(--muted))]">
                          Try widening the filters or check back soon for new content.
                        </p>
                      </div>
                    )}
                  </section>
                </PdfExportProvider>
                <section className="mt-12">
                  <h2 className="mb-6 text-xl font-bold text-[rgb(var(--text))]">Featured</h2>
                  <div className="grid gap-6 sm:grid-cols-3">
                    {displayTopics.slice(0, 3).map((topic) => (
                      <FeaturedCard key={topic.slug} topic={topic} category={category} hiring={hiring} />
                    ))}
                  </div>
                </section>
              </>
            )
          }
        />
      </div>
    </main>
  );
}

function FeaturedCard({ topic, category, hiring }: { topic: TopicDisplay; category: CategoryId; hiring?: boolean }) {
  const href = withHiring(`/interview-questions/${category}/${topic.slug}#questions`, hiring ?? false);
  const title = `Top ${topic.count} ${topic.name} Interview Questions (ANSWERED)`;
  const descriptions: Record<string, string> = {
    rust: 'Rust is Stack Overflow\'s most loved language. Prepare for backend and system developer roles.',
    'clean-architecture': 'Clean architecture keeps code testable and independent. Essential for software architects.',
    'azure-service-bus': 'Azure Service Bus powers reliable messaging at scale. Key for cloud developers.',
  };
  const description = descriptions[topic.slug] ?? `Curated ${topic.name} interview questions with full answers for your next interview.`;
  const shareLabels = ['LinkedIn', 'Twitter', 'Facebook', 'Reddit', 'WhatsApp'];
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] transition hover:border-[rgb(var(--accent))]/50"
    >
      <div className="aspect-[16/10] w-full bg-[rgb(var(--border))]/50" />
      <div className="flex flex-1 flex-col p-5">
        <span className="inline-flex w-fit rounded-full border border-[rgb(var(--accent))]/60 bg-[rgb(var(--accent))]/10 px-3 py-1 text-xs font-semibold text-[rgb(var(--accent))]">
          {topic.name} {topic.count}
        </span>
        <h3 className="mt-3 line-clamp-2 text-base font-bold text-[rgb(var(--text))] group-hover:text-[rgb(var(--accent))]">
          {title}
        </h3>
        <p className="mt-2 flex-1 text-sm text-[rgb(var(--muted))] line-clamp-2">
          {description}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {shareLabels.map((label) => (
            <button
              key={label}
              type="button"
              className="rounded border border-[rgb(var(--border))] px-2 py-1 text-xs text-[rgb(var(--muted))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--text))]"
              aria-label={`Share on ${label}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </Link>
  );
}

function ArticleRow({ topic, category, hiring }: { topic: TopicDisplay; category: CategoryId; hiring?: boolean }) {
  const href = withHiring(`/interview-questions/${category}/${topic.slug}#questions`, hiring ?? false);
  const title = `${topic.count} ${topic.name} Interview Questions (ANSWERED)`;
  const description = `Curated ${topic.name} interview questions with full answers for developers and architects.`;
  return (
    <Link
      href={href}
      className="flex gap-4 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 transition hover:border-[rgb(var(--accent))]/50"
    >
      <div className="h-24 w-24 shrink-0 rounded-xl bg-[rgb(var(--border))]/50" />
      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-[rgb(var(--text))] hover:text-[rgb(var(--accent))]">
          {title}
        </h3>
        <p className="mt-1 text-sm text-[rgb(var(--muted))] line-clamp-2">
          {description}
        </p>
        <span className="mt-2 inline-block rounded-full border border-[rgb(var(--border))] px-3 py-1 text-xs font-medium text-[rgb(var(--muted))]">
          {topic.name} {topic.count}
        </span>
      </div>
    </Link>
  );
}
