import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  CATEGORY_IDS,
  normalizeCategoryId,
  resolveTopicCategory,
  slugify,
  buildCategoryLookup,
  getTopicNameFromRow,
  getTopicSlugFromRow,
  type CategoryId,
} from '@/app/interview-questions/topics-by-category';

export const revalidate = 300;

type QuestionRow = {
  id: string;
  topic_id: string;
};

type AnswerRow = {
  question_id: string;
};

async function loadTopicCategoryRows(supabase: ReturnType<typeof createSupabaseServerClient>) {
  const response = await supabase.from('topic_categories').select('*');
  if (!response.error) {
    return response.data ?? [];
  }

  if (response.error.code === '42P01') {
    return [];
  }

  throw response.error;
}

function parseCategory(value: string | null): CategoryId | null {
  if (!value) return null;
  return normalizeCategoryId(value);
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const requestedCategory = searchParams.get('category');

  if (requestedCategory && !CATEGORY_IDS.includes(requestedCategory as CategoryId)) {
    return NextResponse.json(
      { error: 'category must be one of fullstack, dsa, system-design, ml.' },
      { status: 400 },
    );
  }

  const category = parseCategory(requestedCategory);
  const supabase = createSupabaseServerClient();

  const [topicsResponse, questionResponse, answerResponse, rawCategoryRows] = await Promise.all([
    supabase.from('topics').select('*'),
    supabase.from('questions').select('id, topic_id'),
    supabase.from('answers').select('question_id'),
    loadTopicCategoryRows(supabase),
  ]);

  if (topicsResponse.error) {
    console.error('Supabase error in /api/categories topics query:', topicsResponse.error);
    return NextResponse.json({ error: topicsResponse.error.message }, { status: 500 });
  }

  if (questionResponse.error) {
    console.error('Supabase error in /api/categories questions query:', questionResponse.error);
    return NextResponse.json({ error: questionResponse.error.message }, { status: 500 });
  }

  if (answerResponse.error) {
    console.error('Supabase error in /api/categories answers query:', answerResponse.error);
    return NextResponse.json({ error: answerResponse.error.message }, { status: 500 });
  }

  const questionRows = (questionResponse.data ?? []) as QuestionRow[];
  const answerRows = (answerResponse.data ?? []) as AnswerRow[];
  const questionIdToTopicId = new Map(questionRows.map((row) => [row.id, row.topic_id]));

  const countByTopicId = questionRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.topic_id] = (acc[row.topic_id] ?? 0) + 1;
    return acc;
  }, {});

  const answerCountByTopicId = answerRows.reduce<Record<string, number>>((acc, row) => {
    const topicId = questionIdToTopicId.get(row.question_id);
    if (!topicId) return acc;
    acc[topicId] = (acc[topicId] ?? 0) + 1;
    return acc;
  }, {});

  const categoryLookup = buildCategoryLookup(rawCategoryRows);

  const mappedItems = (topicsResponse.data ?? [])
    .map((topic) => {
      const name = getTopicNameFromRow(topic);
      if (!name) return null;

      const id = typeof (topic as { id?: unknown }).id === 'string' ? (topic as { id: string }).id : null;
      if (!id) return null;

      const slug = getTopicSlugFromRow(topic) ?? slugify(name);
      return {
        id,
        name,
        slug,
        count: countByTopicId[id] ?? 0,
        questionCount: countByTopicId[id] ?? 0,
        answerCount: answerCountByTopicId[id] ?? 0,
        category: resolveTopicCategory(topic, categoryLookup),
      };
    })
    .filter(
      (
        item,
      ): item is {
        id: string;
        name: string;
        slug: string;
        count: number;
        questionCount: number;
        answerCount: number;
        category: CategoryId | null;
      } => Boolean(item),
    );

  const hasExplicitCategories = mappedItems.some((item) => item.category !== null);
  const itemsWithFallback = hasExplicitCategories
    ? mappedItems
    : mappedItems.map((item) => ({ ...item, category: 'fullstack' as const }));

  const items = itemsWithFallback
    .filter((item) => (category ? item.category === category : true))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    category,
    items,
    total: items.length,
  });
}
