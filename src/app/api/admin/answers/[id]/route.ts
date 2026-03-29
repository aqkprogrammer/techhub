import { NextResponse } from 'next/server';

import { QuestionIdParamSchema, UpdateAnswerBodySchema } from '@techhub/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { jsonError, requireAdmin } from '../../../_utils';

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const idParsed = QuestionIdParamSchema.safeParse({ id: context.params.id });
  if (!idParsed.success) return jsonError('Invalid answer id.');

  const body = await request.json().catch(() => null);
  const parsed = UpdateAnswerBodySchema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid request body.');

  const { questionId, ...rest } = parsed.data;
  const update: Record<string, unknown> = {};

  if (rest.shortAnswer !== undefined) update.short_answer = rest.shortAnswer;
  if (rest.deepExplanation !== undefined) update.deep_explanation = rest.deepExplanation;
  if (rest.realWorldExample !== undefined) update.real_world_example = rest.realWorldExample;
  if (rest.commonMistakes !== undefined) update.common_mistakes = rest.commonMistakes;
  if (rest.followUpQuestions !== undefined) update.follow_up_questions = rest.followUpQuestions;

  if (Object.keys(update).length === 0) {
    return jsonError('No changes provided.');
  }

  const supabase = createSupabaseServerClient();
  const { response } = await requireAdmin(supabase, { request });
  if (response) return response;
  const { error } = await supabase.from('answers').update(update).eq('id', idParsed.data.id);
  if (error) return jsonError('Failed to update answer.', 500);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  const parsed = QuestionIdParamSchema.safeParse({ id: context.params.id });
  if (!parsed.success) return jsonError('Invalid answer id.');

  const supabase = createSupabaseServerClient();
  const { response } = await requireAdmin(supabase, { request });
  if (response) return response;
  const { error } = await supabase.from('answers').delete().eq('id', parsed.data.id);
  if (error) return jsonError('Failed to delete answer.', 500);

  return NextResponse.json({ ok: true });
}
