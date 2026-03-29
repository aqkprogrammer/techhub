import { NextResponse } from 'next/server';
import type { Session } from '@supabase/supabase-js';
import { z } from 'zod';

import { requireAuthenticatedUser } from '@/app/api/account/_auth';
import { hasPaidSubscription } from '@/app/api/_security';
import { setAuthCookies } from '@/app/api/auth/_shared';
import { jsonError, requireAdmin } from '@/app/api/_utils';
import {
  buildAnswerPayloadVariants,
  buildQuestionUpdatePayloadVariants,
  mapAnswerRowToApi,
  mapDifficultyInputToDb,
  normalizeAnswerInput,
  normalizeValidationError,
  updateQuestionPayloadSchema,
} from '@/lib/questions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

const FALLBACK_COMPAT_ERROR_CODES = new Set(['42703', '42804', '22P02', 'PGRST204']);

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

async function runAnswerWriteWithFallback(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  options: {
    mode: 'insert' | 'update';
    answerId?: string;
    questionId: string;
    payload: ReturnType<typeof normalizeAnswerInput>;
  },
) {
  const variants = buildAnswerPayloadVariants({
    questionId: options.mode === 'insert' ? options.questionId : undefined,
    shortAnswer: options.payload.shortAnswer,
    deepExplanation: options.payload.deepExplanation,
    realWorldExample: options.payload.realWorldExample,
    commonMistakes: options.payload.commonMistakes,
    followUps: options.payload.followUps,
  });

  let lastError: { code?: string; message?: string } | null = null;

  for (const variant of variants) {
    const query =
      options.mode === 'insert'
        ? supabase.from('answers').insert(variant)
        : supabase.from('answers').update(variant).eq('id', options.answerId!);

    const { data, error } = await query.select('*').maybeSingle();

    if (!error && data) {
      return data as Record<string, unknown>;
    }

    lastError = { code: error?.code, message: error?.message };
    if (!error || !FALLBACK_COMPAT_ERROR_CODES.has(error.code ?? '')) {
      break;
    }
  }

  throw new Error(lastError?.message || 'Failed to save answer.');
}

async function persistSingleAnswer(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  questionId: string,
  normalizedAnswer: ReturnType<typeof normalizeAnswerInput>,
) {
  const { data: existingAnswers, error: existingError } = await supabase
    .from('answers')
    .select('id, created_at')
    .eq('question_id', questionId)
    .order('created_at', { ascending: false });

  if (existingError) {
    throw new Error(existingError.message || 'Failed to validate answer relation.');
  }

  const primary = existingAnswers?.[0];

  let savedAnswer: Record<string, unknown>;
  if (primary?.id) {
    savedAnswer = await runAnswerWriteWithFallback(supabase, {
      mode: 'update',
      answerId: primary.id,
      questionId,
      payload: normalizedAnswer,
    });

    const duplicateIds = (existingAnswers ?? [])
      .slice(1)
      .map((row) => row.id)
      .filter((id): id is string => typeof id === 'string');

    if (duplicateIds.length > 0) {
      await supabase.from('answers').delete().in('id', duplicateIds);
    }
  } else {
    savedAnswer = await runAnswerWriteWithFallback(supabase, {
      mode: 'insert',
      questionId,
      payload: normalizedAnswer,
    });
  }

  return mapAnswerRowToApi(savedAnswer);
}

async function runQuestionUpdateWithFallback(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  questionId: string,
  payloads: Array<Record<string, unknown>>,
) {
  let lastError: { code?: string; message?: string } | null = null;

  for (const payload of payloads) {
    if (Object.keys(payload).length === 0) {
      return;
    }

    const { error } = await supabase.from('questions').update(payload).eq('id', questionId);
    if (!error) {
      return;
    }

    lastError = { code: error.code, message: error.message };

    if (!FALLBACK_COMPAT_ERROR_CODES.has(error.code ?? '')) {
      break;
    }
  }

  throw new Error(lastError?.message || 'Failed to update question.');
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
    .select(
      `
      *,
      topic:topics ( * )
    `,
    )
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (questionError) return jsonError('Failed to load question.', 500);
  if (!questionData) return jsonError('Question not found.', 404);

  const isFreePreview = Boolean(
    (questionData as Record<string, unknown>).free_preview ??
      (questionData as Record<string, unknown>).is_free_preview,
  );
  const access = await getPaidAccessForRequest(request, supabase);
  const unlocked = isFreePreview || access.hasPaidAccess;

  const { data: answerRows, error: answerError } = await supabase
    .from('answers')
    .select('*')
    .eq('question_id', parsed.data.id)
    .order('created_at', { ascending: false });

  if (answerError) return jsonError('Failed to load answers.', 500);

  const mappedAnswers = (answerRows ?? []).map((row) => mapAnswerRowToApi(row as Record<string, unknown>));
  const answerCount = mappedAnswers.length;

  const response = NextResponse.json({
    question: {
      id: questionData.id,
      title: questionData.title,
      slug: questionData.slug,
      difficulty: questionData.difficulty,
      topicId: questionData.topic_id,
      topic: Array.isArray(questionData.topic) ? (questionData.topic[0] ?? null) : questionData.topic,
      freePreview: isFreePreview,
      createdAt: questionData.created_at,
      updatedAt: questionData.updated_at,
    },
    answerCount,
    answer: unlocked ? mappedAnswers[0] ?? null : null,
  });

  if (access.refreshedSession) {
    setAuthCookies(response, access.refreshedSession);
  }

  return response;
}

export async function PUT(request: Request, context: RouteContext) {
  const params = await context.params;
  const idParsed = paramsSchema.safeParse({ id: params.id });
  if (!idParsed.success) {
    return jsonError('Invalid question id.');
  }

  const body = await request.json().catch(() => null);
  const parsed = updateQuestionPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(normalizeValidationError(parsed.error));
  }

  const supabase = createSupabaseServerClient();
  const { response } = await requireAdmin(supabase, { request });
  if (response) return response;

  const { data: currentQuestion, error: currentQuestionError } = await supabase
    .from('questions')
    .select('*')
    .eq('id', idParsed.data.id)
    .maybeSingle();

  if (currentQuestionError) {
    return jsonError('Failed to load current question.', 500);
  }
  if (!currentQuestion) {
    return jsonError('Question not found.', 404);
  }

  if (parsed.data.slug) {
    const { data: matchingSlugs, error: slugError } = await supabase
      .from('questions')
      .select('id')
      .eq('slug', parsed.data.slug)
      .neq('id', idParsed.data.id)
      .limit(1);

    if (slugError) {
      return jsonError('Failed to validate slug uniqueness.', 500);
    }

    if ((matchingSlugs ?? []).length > 0) {
      return jsonError('Slug already exists. Please choose a different slug.', 409);
    }
  }

  const freePreviewValue =
    parsed.data.freePreview !== undefined
      ? parsed.data.freePreview
      : parsed.data.isFreePreview !== undefined
        ? parsed.data.isFreePreview
        : undefined;

  const questionUpdatePayloads = buildQuestionUpdatePayloadVariants({
    title: parsed.data.title,
    slug: parsed.data.slug,
    difficulty:
      parsed.data.difficulty !== undefined
        ? mapDifficultyInputToDb(parsed.data.difficulty)
        : undefined,
    topicId: parsed.data.topicId,
    freePreview: freePreviewValue,
  });

  try {
    await runQuestionUpdateWithFallback(supabase, idParsed.data.id, questionUpdatePayloads);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Failed to update question.', 500);
  }

  let savedAnswer: ReturnType<typeof mapAnswerRowToApi> | null = null;
  if (parsed.data.answer) {
    try {
      const normalizedAnswer = normalizeAnswerInput(parsed.data.answer);
      savedAnswer = await persistSingleAnswer(supabase, idParsed.data.id, normalizedAnswer);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : 'Failed to update answer.', 500);
    }
  }

  const { data: updatedQuestion, error: updatedQuestionError } = await supabase
    .from('questions')
    .select('*')
    .eq('id', idParsed.data.id)
    .maybeSingle();

  if (updatedQuestionError || !updatedQuestion) {
    return jsonError('Question updated, but failed to reload question data.', 500);
  }

  if (!savedAnswer) {
    const { data: latestAnswer } = await supabase
      .from('answers')
      .select('*')
      .eq('question_id', idParsed.data.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestAnswer) {
      savedAnswer = mapAnswerRowToApi(latestAnswer as Record<string, unknown>);
    }
  }

  return NextResponse.json({
    question: {
      id: updatedQuestion.id,
      title: updatedQuestion.title,
      slug: updatedQuestion.slug,
      difficulty: updatedQuestion.difficulty,
      topicId: updatedQuestion.topic_id,
      freePreview: Boolean(updatedQuestion.free_preview ?? updatedQuestion.is_free_preview ?? false),
      createdAt: updatedQuestion.created_at,
      updatedAt: updatedQuestion.updated_at,
    },
    answer: savedAnswer,
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const params = await context.params;
  const parsed = paramsSchema.safeParse({ id: params.id });
  if (!parsed.success) {
    return jsonError('Invalid question id.');
  }

  const supabase = createSupabaseServerClient();
  const { response } = await requireAdmin(supabase, { request });
  if (response) return response;

  const { error: answerDeleteError } = await supabase.from('answers').delete().eq('question_id', parsed.data.id);
  if (answerDeleteError && answerDeleteError.code !== '42P01') {
    return jsonError('Failed to delete related answers.', 500);
  }

  const { error: questionDeleteError } = await supabase.from('questions').delete().eq('id', parsed.data.id);
  if (questionDeleteError) {
    return jsonError('Failed to delete question.', 500);
  }

  return NextResponse.json({ ok: true });
}
