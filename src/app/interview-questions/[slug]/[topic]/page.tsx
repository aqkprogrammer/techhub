import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import QuestionsPage, { generateQuestionsMetadata } from '../../questions-page';
import type { CategoryId } from '../../topics-by-category';

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  params: Promise<{ slug: string; topic: string }>;
  searchParams?: Promise<SearchParams>;
};

function isCategorySlug(value: string): value is CategoryId {
  return value === 'fullstack' || value === 'dsa' || value === 'system-design' || value === 'ml';
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug, topic } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  if (!isCategorySlug(slug)) {
    return {
      title: 'Questions Not Found',
      description: 'Invalid interview question category.',
    };
  }

  return generateQuestionsMetadata(topic, { ...resolvedSearchParams, category: slug });
}

export default async function QuestionsCategoryTopicPage({ params, searchParams }: PageProps) {
  const { slug, topic } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  if (!isCategorySlug(slug)) {
    notFound();
  }

  return <QuestionsPage searchParams={{ ...resolvedSearchParams, category: slug }} topicSlug={topic} />;
}
