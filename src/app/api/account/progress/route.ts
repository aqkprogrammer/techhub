import { NextResponse } from 'next/server';
import { z } from 'zod';

import { touchUserStreak } from '@/app/api/_streak';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { jsonError, setAuthCookies } from '../../auth/_shared';
import { requireAuthenticatedUser } from '../_auth';

const querySchema = z.object({
  questionIds: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  details: z.string().optional(),
});

const upsertBodySchema = z
  .object({
    questionId: z.string().uuid(),
    completed: z.boolean().optional(),
    bookmarked: z.boolean().optional(),
    touchViewed: z.boolean().optional().default(false),
  })
  .refine(
    (value) =>
      value.completed !== undefined ||
      value.bookmarked !== undefined ||
      value.touchViewed,
    {
      message:
        'At least one field is required: completed, bookmarked, or touchViewed.',
    }
  );

type UserProgressRow = {
  id: string;
  user_id: string;
  question_id: string;
  completed: boolean | null;
  bookmarked: boolean | null;
  last_viewed: string | null;
};

type ProgressQuestionRow = {
  id: string;
  title: string;
  slug: string | null;
  difficulty: 'junior' | 'mid' | 'senior';
  free_preview: boolean | null;
  topic_id: string;
  topic: { id: string; name: string | null } | null;
};

type UserProgressWithQuestionRow = UserProgressRow & {
  question?: ProgressQuestionRow | ProgressQuestionRow[] | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function shouldIncludeDetails(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function getQuestionRow(row: UserProgressWithQuestionRow): ProgressQuestionRow | null {
  const value = row.question;
  if (!value) return null;
  if (Array.isArray(value)) {
    return (value[0] ?? null) as ProgressQuestionRow | null;
  }
  return value as ProgressQuestionRow;
}

function mapProgressRow(row: UserProgressWithQuestionRow, includeDetails: boolean) {
  const question = includeDetails ? getQuestionRow(row) : null;

  return {
    id: row.id,
    userId: row.user_id,
    questionId: row.question_id,
    completed: Boolean(row.completed),
    bookmarked: Boolean(row.bookmarked),
    lastViewed: row.last_viewed,
    ...(question
      ? {
          question: {
            id: question.id,
            title: question.title,
            slug: question.slug,
            difficulty: question.difficulty,
            freePreview: Boolean(question.free_preview),
            topicId: question.topic_id,
            topic: question.topic
              ? {
                  id: question.topic.id,
                  name: question.topic.name ?? 'Unknown',
                  slug: slugify(question.topic.name ?? ''),
                }
              : null,
          },
        }
      : {}),
  };
}

function parseQuestionIds(raw: string | undefined): string[] | null {
  if (!raw) return [];

  const ids = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (ids.length === 0) return [];
  if (ids.length > 250) return null;

  const parsed = z.array(z.string().uuid()).safeParse(ids);
  if (!parsed.success) return null;
  return Array.from(new Set(parsed.data));
}

async function syncBookmarkTable(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  questionId: string,
  bookmarked: boolean,
) {
  if (bookmarked) {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('bookmarks')
      .upsert(
        { user_id: userId, question_id: questionId, created_at: nowIso },
        { onConflict: 'user_id,question_id' },
      );

    if (!error) return;

    await supabase.from('bookmarks').insert({
      user_id: userId,
      question_id: questionId,
      created_at: nowIso,
    });
    return;
  }

  await supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('question_id', questionId);
}

async function trackQuestionView(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  questionId: string,
) {
  const payloads = [
    { user_id: userId, question_id: questionId, viewed_at: new Date().toISOString() },
    { user_id: userId, question_id: questionId, created_at: new Date().toISOString() },
    { user_id: userId, question_id: questionId },
  ];

  for (const payload of payloads) {
    const { error } = await supabase.from('question_views').insert(payload);
    if (!error) break;
  }

  await touchUserStreak(supabase, userId);
}

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const parsedQuery = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  );
  if (!parsedQuery.success) {
    return jsonError('Invalid query parameters.');
  }

  const questionIds = parseQuestionIds(parsedQuery.data.questionIds);
  if (questionIds === null) {
    return jsonError('questionIds must be a comma-separated list of UUIDs.');
  }
  const includeDetails = shouldIncludeDetails(parsedQuery.data.details);
  const resolvedLimit =
    questionIds.length > 0
      ? Math.min(Math.max(questionIds.length, parsedQuery.data.limit), 250)
      : parsedQuery.data.limit;

  const admin = createSupabaseServerClient();
  const selectClause = includeDetails
    ? `
      id,
      user_id,
      question_id,
      completed,
      bookmarked,
      last_viewed,
      question:questions (
        id,
        title,
        slug,
        difficulty,
        free_preview,
        topic_id,
        topic:topics ( id, name )
      )
    `
    : 'id, user_id, question_id, completed, bookmarked, last_viewed';
  let query = admin
    .from('user_progress')
    .select(selectClause)
    .eq('user_id', auth.user.id)
    .order('last_viewed', { ascending: false })
    .limit(resolvedLimit);

  if (questionIds.length > 0) {
    query = query.in('question_id', questionIds);
  }

  const { data, error } = await query;
  if (error) {
    return jsonError('Failed to load user progress.', 500);
  }

  const rows = (data ?? []) as unknown as UserProgressWithQuestionRow[];
  const items = rows.map((row) => mapProgressRow(row, includeDetails));
  const completedCount = rows.reduce(
    (count, row) => count + (row.completed ? 1 : 0),
    0
  );
  const bookmarkedCount = rows.reduce(
    (count, row) => count + (row.bookmarked ? 1 : 0),
    0
  );
  const response = NextResponse.json({
    total: items.length,
    completedCount,
    bookmarkedCount,
    items,
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }

  return response;
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const parsedBody = upsertBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError(
      parsedBody.error.issues[0]?.message ?? 'Invalid progress payload.'
    );
  }

  const admin = createSupabaseServerClient();
  const questionId = parsedBody.data.questionId;

  const { data: question, error: questionError } = await admin
    .from('questions')
    .select('id')
    .eq('id', questionId)
    .maybeSingle();

  if (questionError) {
    return jsonError('Failed to validate question.', 500);
  }
  if (!question) {
    return jsonError('Question not found.', 404);
  }

  const { data: existingRows, error: existingError } = await admin
    .from('user_progress')
    .select('id, user_id, question_id, completed, bookmarked, last_viewed')
    .eq('user_id', auth.user.id)
    .eq('question_id', questionId)
    .limit(1);

  if (existingError) {
    return jsonError('Failed to load existing progress.', 500);
  }

  const existing = (existingRows?.[0] ?? null) as UserProgressRow | null;
  const nowIso = new Date().toISOString();

  const basePayload = {
    user_id: auth.user.id,
    question_id: questionId,
    completed: parsedBody.data.completed ?? existing?.completed ?? false,
    bookmarked: parsedBody.data.bookmarked ?? existing?.bookmarked ?? false,
    ...(parsedBody.data.touchViewed ? { last_viewed: nowIso } : {}),
  };

  const mutation = existing
    ? admin
        .from('user_progress')
        .update(basePayload)
        .eq('id', existing.id)
        .eq('user_id', auth.user.id)
        .select('id, user_id, question_id, completed, bookmarked, last_viewed')
        .single()
    : admin
        .from('user_progress')
        .insert(basePayload)
        .select('id, user_id, question_id, completed, bookmarked, last_viewed')
        .single();

  const { data, error } = await mutation;
  if (error || !data) {
    return jsonError('Failed to save user progress.', 500);
  }

  if (parsedBody.data.bookmarked !== undefined) {
    await syncBookmarkTable(admin, auth.user.id, questionId, parsedBody.data.bookmarked);
  }

  if (parsedBody.data.touchViewed) {
    await trackQuestionView(admin, auth.user.id, questionId);
  }

  const response = NextResponse.json({
    item: mapProgressRow(data as UserProgressWithQuestionRow, false),
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }

  return response;
}
