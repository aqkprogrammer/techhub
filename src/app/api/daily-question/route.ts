import { NextResponse } from 'next/server';

import { setAuthCookies } from '@/app/api/auth/_shared';
import { requireApiUser } from '@/app/api/_security';
import { jsonError } from '@/app/api/_utils';
import { touchUserStreak } from '@/app/api/_streak';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type DailyQuestionRow = {
  id: string;
  question_id?: string | null;
  questionId?: string | null;
  date?: string | null;
  question_date?: string | null;
  created_at?: string | null;
};

type QuestionRow = {
  id: string;
  title: string;
  slug: string | null;
  difficulty: string;
  free_preview?: boolean | null;
  is_free_preview?: boolean | null;
  topic_id: string | null;
};

type TopicRow = {
  id?: string | null;
  name?: string | null;
  title?: string | null;
  slug?: string | null;
};

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function mapQuestion(question: QuestionRow, topic: TopicRow | null) {
  const topicName = (topic?.name ?? topic?.title ?? '').trim() || 'General';
  const topicSlug =
    (topic?.slug ?? '').trim() ||
    topicName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

  return {
    id: question.id,
    title: question.title,
    slug: question.slug,
    difficulty: question.difficulty,
    freePreview: Boolean(question.free_preview ?? question.is_free_preview),
    topicId: question.topic_id,
    topic: {
      id: topic?.id ?? question.topic_id ?? 'general',
      name: topicName,
      slug: topicSlug,
    },
  };
}

function getDailyQuestionId(row: DailyQuestionRow | null): string | null {
  if (!row) return null;
  if (typeof row.question_id === 'string' && row.question_id) return row.question_id;
  if (typeof row.questionId === 'string' && row.questionId) return row.questionId;
  return null;
}

async function findTodayDailyQuestion(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  today: string,
) {
  const byDate = await supabase
    .from('daily_questions')
    .select('*')
    .eq('date', today)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!byDate.error) {
    return (byDate.data?.[0] ?? null) as DailyQuestionRow | null;
  }

  const byQuestionDate = await supabase
    .from('daily_questions')
    .select('*')
    .eq('question_date', today)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!byQuestionDate.error) {
    return (byQuestionDate.data?.[0] ?? null) as DailyQuestionRow | null;
  }

  return null;
}

async function insertDailyQuestion(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  today: string,
  questionId: string,
) {
  const payloads = [
    { question_id: questionId, date: today },
    { question_id: questionId, question_date: today },
    { question_id: questionId, date: today, created_at: new Date().toISOString() },
    { question_id: questionId, question_date: today, created_at: new Date().toISOString() },
  ];

  for (const payload of payloads) {
    const { data, error } = await supabase
      .from('daily_questions')
      .insert(payload)
      .select('*')
      .limit(1);

    if (!error) {
      return (data?.[0] ?? null) as DailyQuestionRow | null;
    }
  }

  return null;
}

async function pickRandomQuestionId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<string | null> {
  const { data, error } = await supabase.from('questions').select('id');
  if (error) return null;
  const ids = (data ?? [])
    .map((row) => (typeof row.id === 'string' ? row.id : null))
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return null;
  return ids[Math.floor(Math.random() * ids.length)];
}

async function updateDailyQuestionRow(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  rowId: string,
  questionId: string,
) {
  const payloads = [{ question_id: questionId }, { questionId }];
  for (const payload of payloads) {
    const { error } = await supabase.from('daily_questions').update(payload).eq('id', rowId);
    if (!error) return;
  }
}

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const today = toDateOnly(new Date());
  let dailyRow = await findTodayDailyQuestion(auth.supabase, today);

  if (!dailyRow) {
    const randomQuestionId = await pickRandomQuestionId(auth.supabase);
    if (!randomQuestionId) {
      return jsonError('Failed to load question pool.', 500);
    }
    dailyRow = await insertDailyQuestion(auth.supabase, today, randomQuestionId);

    if (!dailyRow) {
      dailyRow = await findTodayDailyQuestion(auth.supabase, today);
    }
  }

  const dailyQuestionId = getDailyQuestionId(dailyRow);
  if (!dailyQuestionId) {
    return jsonError('Daily question is unavailable.', 404);
  }

  const { data: question, error: questionError } = await auth.supabase
    .from('questions')
    .select('*')
    .eq('id', dailyQuestionId)
    .maybeSingle();

  if (questionError) {
    return jsonError('Failed to load daily question details.', 500);
  }

  let resolvedQuestion = question as QuestionRow | null;
  let resolvedQuestionId = dailyQuestionId;
  if (!resolvedQuestion) {
    const fallbackQuestionId = await pickRandomQuestionId(auth.supabase);
    if (!fallbackQuestionId) {
      return jsonError('No questions available for daily question.', 404);
    }

    resolvedQuestionId = fallbackQuestionId;
    if (dailyRow?.id) {
      await updateDailyQuestionRow(auth.supabase, dailyRow.id, fallbackQuestionId);
    }

    const fallbackQuestion = await auth.supabase
      .from('questions')
      .select('*')
      .eq('id', fallbackQuestionId)
      .maybeSingle();

    if (fallbackQuestion.error || !fallbackQuestion.data) {
      return jsonError('Failed to load daily question details.', 500);
    }

    resolvedQuestion = fallbackQuestion.data as QuestionRow;
  }

  const topicId =
    typeof (resolvedQuestion as Record<string, unknown>).topic_id === 'string'
      ? ((resolvedQuestion as Record<string, unknown>).topic_id as string)
      : null;

  let topic: TopicRow | null = null;
  if (topicId) {
    const topicResult = await auth.supabase.from('topics').select('*').eq('id', topicId).maybeSingle();
    if (!topicResult.error && topicResult.data) {
      topic = topicResult.data as TopicRow;
    }
  }

  const viewPayloads = [
    { user_id: auth.user.id, question_id: resolvedQuestionId, viewed_at: new Date().toISOString() },
    { user_id: auth.user.id, question_id: resolvedQuestionId, created_at: new Date().toISOString() },
    { user_id: auth.user.id, question_id: resolvedQuestionId },
  ];
  for (const payload of viewPayloads) {
    const { error: viewError } = await auth.supabase.from('question_views').insert(payload);
    if (!viewError) break;
  }
  await touchUserStreak(auth.supabase, auth.user.id);

  const response = NextResponse.json({
    date: dailyRow?.date ?? dailyRow?.question_date ?? today,
    question: mapQuestion(resolvedQuestion, topic),
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }

  return response;
}
