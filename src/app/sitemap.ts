import type { MetadataRoute } from 'next';

import { createSupabaseServerClient } from '@/lib/supabase/server';

const SITE_URL = 'https://techhub.cafe';

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: SITE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
  { url: `${SITE_URL}/interview-questions`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
  { url: `${SITE_URL}/interview-questions/fullstack`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
  { url: `${SITE_URL}/interview-questions/dsa`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
  { url: `${SITE_URL}/interview-questions/system-design`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
  { url: `${SITE_URL}/interview-questions/ml`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
  { url: `${SITE_URL}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  { url: `${SITE_URL}/ai-interview`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  { url: `${SITE_URL}/daily-question`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
];

type QuestionRow = {
  id: string;
  updated_at: string | null;
  is_free_preview: boolean | null;
};

type TopicRow = {
  id: string;
  slug: string | null;
  name: string | null;
  updated_at: string | null;
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = createSupabaseServerClient();

    const [questionsResponse, topicsResponse] = await Promise.all([
      supabase
        .from('questions')
        .select('id, updated_at, is_free_preview')
        .order('updated_at', { ascending: false }),
      supabase
        .from('topics')
        .select('id, slug, name, updated_at'),
    ]);

    const questionRoutes: MetadataRoute.Sitemap = ((questionsResponse.data ?? []) as QuestionRow[]).map(
      (q) => ({
        url: `${SITE_URL}/interview-questions/${q.id}`,
        lastModified: q.updated_at ? new Date(q.updated_at) : new Date(),
        changeFrequency: 'monthly' as const,
        priority: q.is_free_preview ? 0.8 : 0.6,
      }),
    );

    const topicRoutes: MetadataRoute.Sitemap = ((topicsResponse.data ?? []) as TopicRow[]).flatMap((t) => {
      const slug = t.slug?.trim() || (t.name ? slugify(t.name) : null);
      if (!slug) return []; // empty array instead of null
      return [
        {
          url: `${SITE_URL}/interview-questions/${slug}`,
          lastModified: t.updated_at ? new Date(t.updated_at) : new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.75,
        },
      ];
    });

    return [...STATIC_ROUTES, ...topicRoutes, ...questionRoutes];
  } catch {
    // If DB is unreachable during build, fall back to static routes only
    return STATIC_ROUTES;
  }
}
