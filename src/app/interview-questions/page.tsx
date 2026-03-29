import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';

import { generateQuestionsMetadata } from './questions-page';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function QuestionsIndexPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      query.set(key, value);
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') query.append(key, item);
      }
    }
  }

  const qs = query.toString();
  permanentRedirect(qs ? `/interview-questions/fullstack?${qs}` : '/interview-questions/fullstack');
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = searchParams ? await searchParams : {};
  return generateQuestionsMetadata(undefined, { ...params, category: 'fullstack' });
}
