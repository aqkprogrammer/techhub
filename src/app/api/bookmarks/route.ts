import { NextResponse } from 'next/server';
import { z } from 'zod';

import { setAuthCookies } from '@/app/api/auth/_shared';
import { requireApiUser } from '@/app/api/_security';
import { jsonError } from '@/app/api/_utils';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const createBookmarkSchema = z.object({
  questionId: z.string().uuid(),
});

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

type BookmarkRow = {
  id: string;
  question_id: string | null;
  created_at?: string | null;
};

type QuestionRow = {
  id: string;
  title: string;
  slug: string | null;
  difficulty: string;
  free_preview?: boolean | null;
  topic_id: string | null;
  topic?: { id: string; name?: string | null; title?: string | null; slug?: string | null }[] | {
    id: string;
    name?: string | null;
    title?: string | null;
    slug?: string | null;
  } | null;
};

function getTopicFromJoined(question: QuestionRow) {
  const value = question.topic;
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function syncProgressBookmark(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  questionId: string,
  bookmarked: boolean,
) {
  const { data: existing } = await supabase
    .from('user_progress')
    .select('id')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from('user_progress')
      .update({ bookmarked, last_viewed: new Date().toISOString() })
      .eq('id', existing.id);
    return;
  }

  await supabase.from('user_progress').insert({
    user_id: userId,
    question_id: questionId,
    bookmarked,
    completed: false,
    last_viewed: new Date().toISOString(),
  });
}

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const parsed = listSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return jsonError('Invalid query parameters.');
  }

  const { data: bookmarkRows, error } = await auth.supabase
    .from('bookmarks')
    .select('id, question_id, created_at')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(parsed.data.limit);

  if (error) {
    return jsonError('Failed to load bookmarks.', 500);
  }

  const rows = (bookmarkRows ?? []) as BookmarkRow[];
  const questionIds = rows
    .map((row) => (typeof row.question_id === 'string' ? row.question_id : null))
    .filter((questionId): questionId is string => Boolean(questionId));

  let questionsById = new Map<string, QuestionRow>();
  if (questionIds.length > 0) {
    const { data: questionRows } = await auth.supabase
      .from('questions')
      .select('id,title,slug,difficulty,free_preview,topic_id,topic:topics(id,name,title,slug)')
      .in('id', questionIds);

    questionsById = new Map(((questionRows ?? []) as QuestionRow[]).map((row) => [row.id, row]));
  }

  const items = rows
    .map((row) => {
      const questionId = row.question_id;
      if (!questionId) return null;
      const question = questionsById.get(questionId);
      if (!question) return null;

      const topic = getTopicFromJoined(question);
      const topicName = (topic?.name ?? topic?.title ?? '').trim() || 'General';
      const topicSlug = (topic?.slug ?? '').trim() || slugify(topicName);

      return {
        id: row.id,
        questionId: question.id,
        createdAt: row.created_at ?? null,
        question: {
          id: question.id,
          title: question.title,
          slug: question.slug,
          difficulty: question.difficulty,
          freePreview: Boolean(question.free_preview),
          topicId: question.topic_id,
          topic: {
            id: topic?.id ?? question.topic_id ?? 'general',
            name: topicName,
            slug: topicSlug,
          },
        },
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const response = NextResponse.json({
    total: items.length,
    items,
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }

  return response;
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createBookmarkSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid bookmark payload.');
  }

  const questionId = parsed.data.questionId;
  const { data: question, error: questionError } = await auth.supabase
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

  const nowIso = new Date().toISOString();

  const { data: upsertedRows, error: upsertError } = await auth.supabase
    .from('bookmarks')
    .upsert(
      {
        user_id: auth.user.id,
        question_id: questionId,
        created_at: nowIso,
      },
      { onConflict: 'user_id,question_id' },
    )
    .select('id, question_id, created_at')
    .limit(1);

  if (upsertError) {
    const { data: existing, error: existingError } = await auth.supabase
      .from('bookmarks')
      .select('id, question_id, created_at')
      .eq('user_id', auth.user.id)
      .eq('question_id', questionId)
      .limit(1);

    if (existingError) {
      return jsonError('Failed to save bookmark.', 500);
    }

    const existingRow = (existing?.[0] ?? null) as BookmarkRow | null;
    if (!existingRow) {
      return jsonError('Failed to save bookmark.', 500);
    }

    await syncProgressBookmark(auth.supabase, auth.user.id, questionId, true);

    const fallbackResponse = NextResponse.json({
      item: {
        id: existingRow.id,
        questionId,
        createdAt: existingRow.created_at ?? null,
      },
    });
    if (auth.session) {
      setAuthCookies(fallbackResponse, auth.session);
    }
    return fallbackResponse;
  }

  await syncProgressBookmark(auth.supabase, auth.user.id, questionId, true);

  const row = (upsertedRows?.[0] ?? null) as BookmarkRow | null;
  const response = NextResponse.json({
    item: {
      id: row?.id ?? null,
      questionId,
      createdAt: row?.created_at ?? nowIso,
    },
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }

  return response;
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const searchParams = new URL(request.url).searchParams;
  const questionId = searchParams.get('questionId');
  if (!questionId) {
    return jsonError('questionId is required.');
  }

  const parsed = z.string().uuid().safeParse(questionId);
  if (!parsed.success) {
    return jsonError('Invalid questionId.');
  }

  const { error } = await auth.supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('question_id', parsed.data);

  if (error) {
    return jsonError('Failed to remove bookmark.', 500);
  }

  await syncProgressBookmark(auth.supabase, auth.user.id, parsed.data, false);

  const response = NextResponse.json({ success: true });
  if (auth.session) {
    setAuthCookies(response, auth.session);
  }
  return response;
}
