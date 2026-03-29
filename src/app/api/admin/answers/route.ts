import { NextResponse } from 'next/server';

import { CreateAnswerBodySchema } from '@techhub/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { jsonError, requireAdmin } from '../../_utils';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = CreateAnswerBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid request body.');
  }

  const supabase = createSupabaseServerClient();
  const { response } = await requireAdmin(supabase, { request });
  if (response) return response;
  const {
    questionId,
    shortAnswer,
    deepExplanation,
    realWorldExample,
    commonMistakes,
    followUpQuestions,
  } = parsed.data;

  const { data: answer, error } = await supabase
    .from('answers')
    .insert({
      question_id: questionId,
      short_answer: shortAnswer,
      deep_explanation: deepExplanation,
      real_world_example: realWorldExample,
      common_mistakes: commonMistakes,
      follow_up_questions: followUpQuestions,
    })
    .select('*')
    .single();

  if (error || !answer) return jsonError('Failed to create answer.', 500);
  return NextResponse.json(answer, { status: 201 });
}
