import { NextResponse } from 'next/server';
import type { Session } from '@supabase/supabase-js';
import { z } from 'zod';

import { requireAuthenticatedUser } from '@/app/api/account/_auth';
import { hasPaidSubscription } from '@/app/api/_security';
import { setAuthCookies } from '@/app/api/auth/_shared';
import { mapAnswerRowToApi } from '@/lib/questions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { jsonError } from '../../../_utils';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

async function getPaidAccessForRequest(
  request: Request,
  supabase: ReturnType<typeof createSupabaseServerClient>,
) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return {
      hasPaidAccess: false,
      refreshedSession: null as Session | null,
    };
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    return {
      hasPaidAccess: false,
      refreshedSession: auth.session,
    };
  }

  const latest = Array.isArray(data) ? data[0] : null;
  return {
    hasPaidAccess: hasPaidSubscription(
      latest as {
        status?: string | null;
        plan?: string | null;
        is_lifetime?: boolean | null;
        expires_at?: string | null;
        current_period_end?: string | null;
      } | null,
    ),
    refreshedSession: auth.session,
  };
}

export async function GET(request: Request, context: RouteContext) {
  const params = await context.params;
  const parsed = paramsSchema.safeParse({ id: params.id });
  if (!parsed.success) {
    return jsonError('Invalid question id.');
  }

  const supabase = createSupabaseServerClient();
  const { data: questionData, error: questionError } = await supabase
    .from('questions')
    .select('*')
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (questionError) {
    return jsonError('Failed to load question.', 500);
  }
  if (!questionData) {
    return jsonError('Question not found.', 404);
  }

  const isFreePreview = Boolean(
    (questionData as Record<string, unknown>).free_preview ??
      (questionData as Record<string, unknown>).is_free_preview,
  );

  const access = await getPaidAccessForRequest(request, supabase);
  const unlocked = isFreePreview || access.hasPaidAccess;

  if (!unlocked) {
    const response = NextResponse.json({
      questionId: parsed.data.id,
      count: 0,
      items: [],
      locked: true,
      freePreview: false,
    });
    if (access.refreshedSession) {
      setAuthCookies(response, access.refreshedSession);
    }
    return response;
  }

  const { data, error } = await supabase
    .from('answers')
    .select('*')
    .eq('question_id', parsed.data.id)
    .order('created_at', { ascending: false });

  if (error) {
    return jsonError('Failed to load answers.', 500);
  }

  const items = (data ?? []).map((row) => mapAnswerRowToApi(row as Record<string, unknown>));

  const response = NextResponse.json({
    questionId: parsed.data.id,
    count: items.length,
    items,
    locked: false,
    freePreview: isFreePreview,
  });

  if (access.refreshedSession) {
    setAuthCookies(response, access.refreshedSession);
  }

  return response;
}
