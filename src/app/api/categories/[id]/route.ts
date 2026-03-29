import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  resolveTopicCategory,
  slugify,
  buildCategoryLookup,
  getTopicNameFromRow,
  getTopicSlugFromRow,
} from '@/app/interview-questions/topics-by-category';
import { jsonError } from '../../_utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = {
  id?: string;
};

type RouteContext = {
  params: Params | Promise<Params>;
};

type QuestionRow = {
  id: string;
  topic_id: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeParam(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;
  return trimmed;
}

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

export async function GET(request: Request, context: RouteContext) {
  const resolvedParams = await Promise.resolve(context.params);
  const pathId = normalizeParam(resolvedParams.id);
  const searchParams = new URL(request.url).searchParams;
  const fallbackId = normalizeParam(searchParams.get('topicId')) ?? normalizeParam(searchParams.get('id'));
  const topicId = pathId ?? fallbackId;

  if (!topicId) {
    return NextResponse.json(
      { error: 'topic id is required in path (/api/categories/:topicId) or query (?topicId=...)' },
      { status: 400 },
    );
  }

  if (!UUID_REGEX.test(topicId)) {
    return NextResponse.json(
      { error: 'topic id must be a valid UUID.' },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();

  const [topicResponse, countResponse, rawCategoryRows] = await Promise.all([
    supabase.from('topics').select('*').eq('id', topicId).maybeSingle(),
    supabase.from('questions').select('id, topic_id').eq('topic_id', topicId),
    loadTopicCategoryRows(supabase),
  ]);

  if (topicResponse.error) {
    console.error('Supabase error in /api/categories/[id] topic query:', topicResponse.error);
    return NextResponse.json({ error: topicResponse.error.message }, { status: 500 });
  }

  if (countResponse.error) {
    console.error('Supabase error in /api/categories/[id] count query:', countResponse.error);
    return NextResponse.json({ error: countResponse.error.message }, { status: 500 });
  }

  const topic = topicResponse.data;
  if (!topic) {
    return NextResponse.json({ error: 'Topic not found.' }, { status: 404 });
  }

  const questionRows = (countResponse.data ?? []) as QuestionRow[];
  const questionIds = questionRows.map((row) => row.id);
  let answerCount = 0;

  if (questionIds.length > 0) {
    const { data: answerRows, error: answerError } = await supabase
      .from('answers')
      .select('question_id')
      .in('question_id', questionIds);

    if (answerError) {
      return jsonError('Failed to load answer count.', 500);
    }

    answerCount = (answerRows ?? []).length;
  }

  const name = getTopicNameFromRow(topic);
  if (!name) {
    return NextResponse.json({ error: 'Topic name is missing.' }, { status: 500 });
  }

  const slug = getTopicSlugFromRow(topic) ?? slugify(name);
  const categoryLookup = buildCategoryLookup(rawCategoryRows);

  const item = {
    id: topicId,
    name,
    slug,
    count: questionRows.length,
    questionCount: questionRows.length,
    answerCount,
    category: resolveTopicCategory(topic, categoryLookup),
  };

  return NextResponse.json({
    topicId,
    item,
  });
}
