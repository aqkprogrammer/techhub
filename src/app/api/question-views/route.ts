import { NextResponse } from 'next/server';
import { z } from 'zod';

import { setAuthCookies } from '@/app/api/auth/_shared';
import { requireApiUser } from '@/app/api/_security';
import { jsonError } from '@/app/api/_utils';
import { touchUserStreak } from '@/app/api/_streak';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const createViewSchema = z.object({
  questionId: z.string().uuid(),
});

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const parsed = listSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return jsonError('Invalid query parameters.');

  const byViewedAt = await auth.supabase
    .from('question_views')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('viewed_at', { ascending: false })
    .limit(parsed.data.limit);

  const rows = byViewedAt.error
    ? await auth.supabase
        .from('question_views')
        .select('*')
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false })
        .limit(parsed.data.limit)
    : byViewedAt;

  if (rows.error) return jsonError('Failed to load question views.', 500);

  const response = NextResponse.json({ items: rows.data ?? [] });
  if (auth.session) {
    setAuthCookies(response, auth.session);
  }
  return response;
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createViewSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid question view payload.');
  }

  const questionId = parsed.data.questionId;

  const payloads = [
    { user_id: auth.user.id, question_id: questionId, viewed_at: new Date().toISOString() },
    { user_id: auth.user.id, question_id: questionId, created_at: new Date().toISOString() },
    { user_id: auth.user.id, question_id: questionId },
  ];

  let saved = false;
  for (const payload of payloads) {
    const { error } = await auth.supabase.from('question_views').insert(payload);
    if (!error) {
      saved = true;
      break;
    }
  }

  if (!saved) {
    return jsonError('Failed to track question view.', 500);
  }

  await touchUserStreak(auth.supabase, auth.user.id);

  const response = NextResponse.json({ success: true });
  if (auth.session) {
    setAuthCookies(response, auth.session);
  }
  return response;
}
