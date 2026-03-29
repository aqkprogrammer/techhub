import { NextResponse } from 'next/server';

import { IncrementQuestionMetricsBodySchema, QuestionIdParamSchema } from '@techhub/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { jsonError, requireAdmin } from '../../../../_utils';

export async function POST(request: Request, context: { params: { id: string } }) {
  const idParsed = QuestionIdParamSchema.safeParse({ id: context.params.id });
  if (!idParsed.success) return jsonError('Invalid question id.');

  const body = await request.json().catch(() => null);
  const parsed = IncrementQuestionMetricsBodySchema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid request body.');

  const supabase = createSupabaseServerClient();
  const { response } = await requireAdmin(supabase, { request });
  if (response) return response;

  const { error } = await supabase.rpc('increment_question_metrics', {
    p_question_id: idParsed.data.id,
    p_views: parsed.data.views,
    p_completions: parsed.data.completions,
    p_bookmarks: parsed.data.bookmarks,
    p_upvotes: parsed.data.upvotes,
    p_downvotes: parsed.data.downvotes,
  });

  if (error) return jsonError('Failed to update metrics.', 500);
  return NextResponse.json({ ok: true });
}
