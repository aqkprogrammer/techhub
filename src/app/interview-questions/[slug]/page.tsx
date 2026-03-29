import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import type { Difficulty } from '@techhub/types';

import LockableSection from '@/components/lockable-section';
import RichContent from '@/components/rich-content';

import { getQuestionDetail } from '../get-question';
import QuestionsPage, { generateQuestionsMetadata } from '../questions-page';
import type { CategoryId } from '../topics-by-category';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isQuestionId(slug: string): boolean {
  return UUID_REGEX.test(slug);
}

function isCategorySlug(slug: string): slug is CategoryId {
  return slug === 'fullstack' || slug === 'dsa' || slug === 'system-design' || slug === 'ml';
}

const difficultyStyles: Record<Difficulty, string> = {
  junior:
    'border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400',
  mid: 'border-amber-200 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400',
  senior:
    'border-rose-200 text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-400',
};

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  if (isQuestionId(slug)) {
    const data = await getQuestionDetail(slug);
    if (!data) {
      return { title: 'Question not found | techhub.cafe' };
    }
    const title = `${data.question.title} | techhub.cafe`;
    const description =
      data.answer?.shortAnswer?.slice(0, 160) ||
      `${data.question.difficulty.charAt(0).toUpperCase() + data.question.difficulty.slice(1)}-level ${data.topic.name} interview question with full answer and explanation.`;
    const canonical = `https://techhub.cafe/interview-questions/${slug}`;
    return {
      title,
      description,
      keywords: [
        `${data.topic.name} interview questions`,
        `${data.question.difficulty} ${data.topic.name} interview`,
        'technical interview prep',
        data.question.title,
      ],
      openGraph: {
        title,
        description,
        type: 'article' as const,
        siteName: 'techhub.cafe',
        url: canonical,
        publishedTime: data.question.createdAt,
        modifiedTime: data.question.updatedAt,
        tags: [data.topic.name, data.question.difficulty],
      },
      twitter: { card: 'summary_large_image', title, description },
      alternates: { canonical },
    };
  }

  if (isCategorySlug(slug)) {
    return generateQuestionsMetadata(undefined, { ...resolvedSearchParams, category: slug });
  }

  return generateQuestionsMetadata(slug, resolvedSearchParams);
}

export default async function QuestionsSlugPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  if (isCategorySlug(slug)) {
    return <QuestionsPage searchParams={{ ...resolvedSearchParams, category: slug }} />;
  }

  if (isQuestionId(slug)) {
    const data = await getQuestionDetail(slug);
    if (!data) notFound();

    const { question, topic, companies, tags, answer } = data;
    const hasFullAccess = Boolean(answer);
    const lockSectionsAfterShort = !question.isFreePreview && !hasFullAccess;

    return (
      <>
        <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10">
          <nav className="mb-8 text-sm text-[rgb(var(--muted))]">
            <Link href="/interview-questions" className="hover:text-[rgb(var(--accent))]">
              ← Back to questions
            </Link>
          </nav>

          <article className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8 shadow-sm">
            <header className="border-b border-[rgb(var(--border))] pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${difficultyStyles[question.difficulty]}`}
                >
                  {question.difficulty}
                </span>
                <Link
                  href={`/interview-questions/${topic.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')}`}
                  className="rounded-full border border-[rgb(var(--border))] px-3 py-1 text-xs font-medium text-[rgb(var(--text))] transition hover:border-[rgb(var(--accent))]"
                >
                  {topic.name}
                </Link>
                {companies.length > 0 &&
                  companies.map((company) => (
                    <span
                      key={company.id}
                      className="rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-1 text-xs text-[rgb(var(--muted))]"
                    >
                      {company.name}
                    </span>
                  ))}
                {tags.length > 0 &&
                  tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-1 text-xs text-[rgb(var(--muted))]"
                    >
                      {tag.name}
                    </span>
                  ))}
              </div>

              <h1 className="mt-4 text-2xl font-bold leading-tight text-[rgb(var(--text))] sm:text-3xl">
                {question.title}
              </h1>

              <p className="mt-2 text-xs text-[rgb(var(--muted))]">
                Updated{' '}
                {new Date(question.updatedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
              </p>
            </header>

            <div className="mt-8 space-y-10">
              <LockableSection
                title="Short answer"
                locked={lockSectionsAfterShort && !answer?.shortAnswer}
              >
                {answer?.shortAnswer ? (
                  <RichContent content={answer.shortAnswer} />
                ) : (
                  <p className="text-sm text-[rgb(var(--muted))]">No short answer available.</p>
                )}
              </LockableSection>

              <LockableSection title="Deep explanation" locked={lockSectionsAfterShort}>
                {answer?.deepExplanation ? (
                  <RichContent content={answer.deepExplanation} />
                ) : (
                  <p className="text-sm text-[rgb(var(--muted))]">
                    No deep explanation available yet.
                  </p>
                )}
              </LockableSection>

              <LockableSection title="Real-world example" locked={lockSectionsAfterShort}>
                {answer?.realWorldExample ? (
                  <RichContent content={answer.realWorldExample} />
                ) : (
                  <p className="text-sm text-[rgb(var(--muted))]">No real-world example available yet.</p>
                )}
              </LockableSection>

              <LockableSection title="Common mistakes" locked={lockSectionsAfterShort}>
                {answer?.commonMistakes?.length ? (
                  <ul className="list-inside list-disc space-y-2 text-sm text-[rgb(var(--text))]">
                    {answer.commonMistakes.map((mistake, i) => (
                      <li key={i}>{mistake}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[rgb(var(--muted))]">
                    No common mistakes listed yet.
                  </p>
                )}
              </LockableSection>

              <LockableSection title="Follow-up questions" locked={lockSectionsAfterShort}>
                {answer?.followUpQuestions?.length ? (
                  <ul className="list-inside list-disc space-y-2 text-sm text-[rgb(var(--text))]">
                    {answer.followUpQuestions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[rgb(var(--muted))]">
                    No follow-up questions available yet.
                  </p>
                )}
              </LockableSection>
            </div>
          </article>

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify([
                {
                  '@context': 'https://schema.org',
                  '@type': 'Question',
                  name: question.title,
                  text: question.title,
                  dateCreated: question.createdAt,
                  dateModified: question.updatedAt,
                  ...(answer?.shortAnswer && {
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: answer.shortAnswer.slice(0, 500),
                      dateCreated: question.updatedAt,
                    },
                  }),
                },
                {
                  '@context': 'https://schema.org',
                  '@type': 'BreadcrumbList',
                  itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://techhub.cafe' },
                    { '@type': 'ListItem', position: 2, name: 'Interview Questions', item: 'https://techhub.cafe/interview-questions' },
                    { '@type': 'ListItem', position: 3, name: topic.name, item: `https://techhub.cafe/interview-questions/${topic.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` },
                    { '@type': 'ListItem', position: 4, name: question.title, item: `https://techhub.cafe/interview-questions/${slug}` },
                  ],
                },
              ]),
            }}
          />
        </main>
      </>
    );
  }

  return <QuestionsPage searchParams={resolvedSearchParams} topicSlug={slug} />;
}
