import { NextResponse } from 'next/server';
import { z } from 'zod';

import { touchUserStreak } from '@/app/api/_streak';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { jsonError, setAuthCookies } from '../../../auth/_shared';
import { requireAuthenticatedUser } from '../../_auth';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const patchBodySchema = z
  .object({
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

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

function mapProgressRow(row: UserProgressRow) {
  return {
    id: row.id,
    userId: row.user_id,
    questionId: row.question_id,
    completed: Boolean(row.completed),
    bookmarked: Boolean(row.bookmarked),
    lastViewed: row.last_viewed,
  };
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

  await supabase.from('bookmarks').delete().eq('user_id', userId).eq('question_id', questionId);
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

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const params = await context.params;
  const parsedParams = paramsSchema.safeParse({ id: params.id });
  if (!parsedParams.success) {
    return jsonError('Invalid progress id.');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const parsedBody = patchBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError(
      parsedBody.error.issues[0]?.message ?? 'Invalid progress payload.'
    );
  }

  const admin = createSupabaseServerClient();
  const { data: existing, error: existingError } = await admin
    .from('user_progress')
    .select('id, user_id, question_id, completed, bookmarked, last_viewed')
    .eq('id', parsedParams.data.id)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (existingError) {
    return jsonError('Failed to load progress.', 500);
  }
  if (!existing) {
    return jsonError('Progress item not found.', 404);
  }

  const updates: Record<string, unknown> = {};
  if (parsedBody.data.completed !== undefined) {
    updates.completed = parsedBody.data.completed;
  }
  if (parsedBody.data.bookmarked !== undefined) {
    updates.bookmarked = parsedBody.data.bookmarked;
  }
  if (parsedBody.data.touchViewed) {
    updates.last_viewed = new Date().toISOString();
  }

  const { data, error } = await admin
    .from('user_progress')
    .update(updates)
    .eq('id', parsedParams.data.id)
    .eq('user_id', auth.user.id)
    .select('id, user_id, question_id, completed, bookmarked, last_viewed')
    .single();

  if (error || !data) {
    return jsonError('Failed to update progress.', 500);
  }

  if (parsedBody.data.bookmarked !== undefined) {
    await syncBookmarkTable(admin, auth.user.id, existing.question_id, parsedBody.data.bookmarked);
  }

  if (parsedBody.data.touchViewed) {
    await trackQuestionView(admin, auth.user.id, existing.question_id);
  }

  const response = NextResponse.json({
    item: mapProgressRow(data as UserProgressRow),
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }

  return response;
}
