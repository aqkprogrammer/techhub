import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuthenticatedUser } from '@/app/api/account/_auth';
import { setAuthCookies } from '@/app/api/auth/_shared';
import { jsonError, requireAdmin } from '@/app/api/_utils';
import {
  buildAnswerPayloadVariants,
  buildQuestionInsertPayloadVariants,
  createQuestionPayloadSchema,
  getTopicNameFromJoinedRow,
  mapAnswerRowToApi,
  mapDifficultyInputToDb,
  normalizeAnswerInput,
  normalizeValidationError,
  type DifficultyInput,
} from '@/lib/questions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const querySchema = z.object({
  search: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  topic_id: z.string().uuid().optional(),
  topicId: z.string().uuid().optional(),
  difficulty: z.string().trim().toLowerCase().optional(),
  free_preview: z.string().trim().toLowerCase().optional(),
  sort_by: z.string().trim().toLowerCase().optional(),
  sort_order: z.string().trim().toLowerCase().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).optional(),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

type QuestionRow = {
  id: string;
  title: string;
  slug: string | null;
  difficulty: string;
  topic_id: string;
  free_preview: boolean | null;
  is_free_preview?: boolean | null;
  created_at: string;
  updated_at: string;
  topic: Record<string, unknown> | Record<string, unknown>[] | null;
};

const FALLBACK_COMPAT_ERROR_CODES = new Set(['42703', '42804', '22P02', 'PGRST204']);

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

async function tryInsertQuestion(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  payloads: Array<Record<string, unknown>>,
) {
  let lastError: { code?: string; message?: string } | null = null;

  for (const payload of payloads) {
    const { data, error } = await supabase.from('questions').insert(payload).select('*').maybeSingle();
    if (!error && data) {
      return data as Record<string, unknown>;
    }

    lastError = { code: error?.code, message: error?.message };

    if (!error || !FALLBACK_COMPAT_ERROR_CODES.has(error.code ?? '')) {
      break;
    }
  }

  throw new Error(lastError?.message || 'Failed to create question.');
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return jsonError('Invalid query parameters.');
  }

  const searchTerm = parsed.data.search ?? parsed.data.q;
  const topicId = parsed.data.topic_id ?? parsed.data.topicId;
  const difficultyRaw = parsed.data.difficulty;
  const difficulty: DifficultyInput | null =
    difficultyRaw === 'easy' ||
    difficultyRaw === 'medium' ||
    difficultyRaw === 'hard' ||
    difficultyRaw === 'junior' ||
    difficultyRaw === 'mid' ||
    difficultyRaw === 'senior'
      ? (difficultyRaw as DifficultyInput)
      : null;
  if (difficultyRaw && !difficulty) {
    return jsonError('difficulty must be one of Easy, Medium, Hard (or junior, mid, senior).');
  }
  const freePreviewFilter =
    parsed.data.free_preview === 'true'
      ? true
      : parsed.data.free_preview === 'false'
        ? false
        : null;
  if (
    parsed.data.free_preview &&
    parsed.data.free_preview !== 'true' &&
    parsed.data.free_preview !== 'false'
  ) {
    return jsonError('free_preview must be true or false.');
  }

  const sortBy =
    parsed.data.sort_by === 'title' ||
    parsed.data.sort_by === 'created_at' ||
    parsed.data.sort_by === 'difficulty'
      ? parsed.data.sort_by
      : 'created_at';
  const sortOrder = parsed.data.sort_order === 'asc' ? 'asc' : 'desc';
  const page = parsed.data.page;
  const limit = parsed.data.limit ?? parsed.data.pageSize;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = createSupabaseServerClient();

  const runQuery = async (previewColumn: 'free_preview' | 'is_free_preview' = 'free_preview') => {
    let query = supabase
      .from('questions')
      .select(
        `
        *,
        topic:topics ( * )
      `,
        { count: 'exact' },
      )
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to);

    if (topicId) query = query.eq('topic_id', topicId);
    if (difficulty) {
      const mappedDifficulty = mapDifficultyInputToDb(difficulty);
      const difficultyFilters = Array.from(new Set([difficulty, mappedDifficulty]));
      query = query.in('difficulty', difficultyFilters);
    }
    if (searchTerm) query = query.ilike('title', `%${searchTerm}%`);
    if (freePreviewFilter !== null) query = query.eq(previewColumn, freePreviewFilter);

    return query;
  };

  let { data, error, count } = await runQuery('free_preview');
  if (error?.code === '42703' && freePreviewFilter !== null) {
    const retry = await runQuery('is_free_preview');
    data = retry.data;
    error = retry.error;
    count = retry.count;
  }
  if (error) return jsonError('Failed to load questions.', 500);

  const rows = (data ?? []) as unknown as QuestionRow[];
  const questionIds = rows.map((row) => row.id);

  let answerCountByQuestionId: Record<string, number> = {};
  if (questionIds.length > 0) {
    const { data: answerRows, error: answerError } = await supabase
      .from('answers')
      .select('question_id')
      .in('question_id', questionIds);

    if (answerError) return jsonError('Failed to load answer counts.', 500);

    answerCountByQuestionId = (answerRows ?? []).reduce<Record<string, number>>((acc, row) => {
      const questionIdValue = typeof row.question_id === 'string' ? row.question_id : null;
      if (!questionIdValue) return acc;
      acc[questionIdValue] = (acc[questionIdValue] ?? 0) + 1;
      return acc;
    }, {});
  }

  const items = rows.map((row) => {
    const topicName = getTopicNameFromJoinedRow(row.topic);

    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      difficulty: row.difficulty,
      topicId: row.topic_id,
      topic:
        topicName
          ? {
              id: row.topic_id,
              name: topicName,
            }
          : null,
      freePreview: row.free_preview ?? row.is_free_preview ?? false,
      answerCount: answerCountByQuestionId[row.id] ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  return NextResponse.json({
    page,
    limit,
    pageSize: limit,
    total: count ?? items.length,
    search: searchTerm ?? null,
    topic_id: topicId ?? null,
    difficulty: difficulty ?? null,
    free_preview: freePreviewFilter,
    sort_by: sortBy,
    sort_order: sortOrder,
    items,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createQuestionPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(normalizeValidationError(parsed.error));
  }

  const supabase = createSupabaseServerClient();
  const { response } = await requireAdmin(supabase, { request });
  if (response) return response;

  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const normalized = parsed.data;
  const freePreview = normalized.freePreview ?? normalized.isFreePreview ?? false;

  const { data: existingSlugRows, error: slugLookupError } = await supabase
    .from('questions')
    .select('id')
    .eq('slug', normalized.slug)
    .limit(1);

  if (slugLookupError) {
    return jsonError('Failed to validate slug uniqueness.', 500);
  }

  if ((existingSlugRows ?? []).length > 0) {
    return jsonError('Slug already exists. Please choose a different slug.', 409);
  }

  const questionPayloads = buildQuestionInsertPayloadVariants({
    title: normalized.title,
    slug: normalized.slug,
    difficulty: mapDifficultyInputToDb(normalized.difficulty),
    topicId: normalized.topicId,
    freePreview,
    createdBy: auth.user.id,
  });

  let createdQuestion: Record<string, unknown>;
  try {
    createdQuestion = await tryInsertQuestion(supabase, questionPayloads);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Failed to create question.', 500);
  }

  const questionId = typeof createdQuestion.id === 'string' ? createdQuestion.id : '';
  if (!questionId) {
    return jsonError('Question was created but response payload is invalid.', 500);
  }

  const answerInput = normalizeAnswerInput(normalized.answer);

  try {
    const answer = await persistSingleAnswer(supabase, questionId, answerInput);

    const responseJson = NextResponse.json(
      {
        question: {
          id: questionId,
          title: createdQuestion.title,
          slug: createdQuestion.slug,
          difficulty: createdQuestion.difficulty,
          topicId: createdQuestion.topic_id,
          freePreview: Boolean(createdQuestion.free_preview ?? createdQuestion.is_free_preview ?? false),
          createdAt: createdQuestion.created_at,
          updatedAt: createdQuestion.updated_at,
        },
        answer,
      },
      { status: 201 },
    );

    if (auth.session) {
      setAuthCookies(responseJson, auth.session);
    }

    return responseJson;
  } catch (error) {
    await supabase.from('questions').delete().eq('id', questionId);
    return jsonError(error instanceof Error ? error.message : 'Failed to save answer.', 500);
  }
}
