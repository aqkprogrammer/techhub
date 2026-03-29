import { NextResponse } from 'next/server';
import { z } from 'zod';

import { setAuthCookies } from '@/app/api/auth/_shared';
import { requirePaidApiUser } from '@/app/api/_security';
import { jsonError } from '@/app/api/_utils';
import { createOpenAiChatCompletion, parseJsonObject } from '@/lib/openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const evaluateSchema = z.object({
  questionId: z.string().uuid().optional(),
  question: z.string().trim().min(5).max(8000),
  userAnswer: z.string().trim().min(10).max(12000),
});

type EvaluationJson = {
  score: number;
  strengths: string[];
  missingConcepts: string[];
  improvements: string[];
  summary?: string;
};

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
    .slice(0, 8);
}

function normalizeEvaluation(value: EvaluationJson): EvaluationJson {
  return {
    score: Math.max(0, Math.min(100, Number(value.score) || 0)),
    strengths: normalizeList(value.strengths),
    missingConcepts: normalizeList(value.missingConcepts),
    improvements: normalizeList(value.improvements),
    summary: typeof value.summary === 'string' ? value.summary.trim() : undefined,
  };
}

async function persistReview(options: {
  supabase: ReturnType<typeof createSupabaseServerClient>;
  userId: string;
  questionId?: string;
  question: string;
  userAnswer: string;
  evaluation: EvaluationJson;
}) {
  const payloads = [
    {
      user_id: options.userId,
      question_id: options.questionId ?? null,
      question: options.question,
      user_answer: options.userAnswer,
      score: options.evaluation.score,
      strengths: options.evaluation.strengths,
      missing_concepts: options.evaluation.missingConcepts,
      improvements: options.evaluation.improvements,
      review_json: options.evaluation,
      created_at: new Date().toISOString(),
    },
    {
      user_id: options.userId,
      question_id: options.questionId ?? null,
      user_answer: options.userAnswer,
      review: options.evaluation,
    },
    {
      user_id: options.userId,
      question_id: options.questionId ?? null,
      user_answer: options.userAnswer,
      review_json: options.evaluation,
    },
  ];

  for (const payload of payloads) {
    const { error } = await options.supabase.from('ai_answer_reviews').insert(payload);
    if (!error) return;
  }
}

export async function POST(request: Request) {
  const auth = await requirePaidApiUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = evaluateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid evaluation request.');
  }

  const prompt =
    'Evaluate this technical interview answer like a senior interviewer. Return JSON with keys: score (0-100), strengths (array), missingConcepts (array), improvements (array), summary (string).';

  let responseText = '';
  try {
    responseText = await createOpenAiChatCompletion({
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: `Question:\n${parsed.data.question}\n\nCandidate Answer:\n${parsed.data.userAnswer}`,
        },
      ],
      requireJson: true,
      temperature: 0.2,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Failed to evaluate answer.', 500);
  }

  let evaluation: EvaluationJson;
  try {
    evaluation = normalizeEvaluation(parseJsonObject<EvaluationJson>(responseText));
  } catch {
    return jsonError('AI returned invalid evaluation JSON.', 500);
  }

  await persistReview({
    supabase: auth.supabase,
    userId: auth.user.id,
    questionId: parsed.data.questionId,
    question: parsed.data.question,
    userAnswer: parsed.data.userAnswer,
    evaluation,
  });

  const response = NextResponse.json({
    evaluation,
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }
  return response;
}
