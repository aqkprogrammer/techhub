import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { Difficulty } from '@techhub/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { jsonError, requireAdmin } from '../../_utils';

const difficultyWeightMap: Record<Difficulty, number> = {
  junior: 1,
  mid: 2,
  senior: 3,
};

const createQuestionBodySchema = z.object({
  title: z.string().trim().min(3),
  difficulty: z.enum(['junior', 'mid', 'senior']),
  workspaceId: z.string().uuid().optional(),
  topicId: z.string().uuid(),
  companyIds: z.array(z.string().uuid()).default([]),
  tagIds: z.array(z.string().uuid()).default([]),
  isFreePreview: z.boolean().default(false),
  difficultyWeight: z.number().int().min(1).max(3).optional(),
});

function makeInsertVariants(input: {
  title: string;
  difficulty: Difficulty;
  topicId: string;
  workspaceId?: string;
  difficultyWeight?: number;
  isFreePreview: boolean;
}) {
  const base: Record<string, unknown> = {
    title: input.title,
    difficulty: input.difficulty,
    topic_id: input.topicId,
  };

  if (input.workspaceId) {
    base.workspace_id = input.workspaceId;
  }
  if (typeof input.difficultyWeight === 'number') {
    base.difficulty_weight = input.difficultyWeight;
  }

  const variants: Record<string, unknown>[] = [];
  const withFreePreview = { ...base, free_preview: input.isFreePreview };
  variants.push(withFreePreview);

  if ('workspace_id' in withFreePreview) {
    const copy = { ...withFreePreview };
    delete copy.workspace_id;
    variants.push(copy);
  }
  if ('difficulty_weight' in withFreePreview) {
    const copy = { ...withFreePreview };
    delete copy.difficulty_weight;
    variants.push(copy);
  }

  variants.push({ ...base, is_free_preview: input.isFreePreview });

  const deduped: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const variant of variants) {
    const key = JSON.stringify(variant);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(variant);
    }
  }
  return deduped;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createQuestionBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid request body.');
  }

  const supabase = createSupabaseServerClient();
  const { response } = await requireAdmin(supabase, { request });
  if (response) return response;

  const {
    title,
    difficulty,
    workspaceId: rawWorkspaceId,
    topicId,
    companyIds,
    tagIds,
    isFreePreview,
    difficultyWeight,
  } = parsed.data;

  let workspaceId = rawWorkspaceId;
  if (!workspaceId) {
    const { data: topicRow } = await supabase.from('topics').select('*').eq('id', topicId).maybeSingle();
    const inferredWorkspaceId =
      topicRow && typeof (topicRow as Record<string, unknown>).workspace_id === 'string'
        ? ((topicRow as Record<string, unknown>).workspace_id as string)
        : '';
    workspaceId = inferredWorkspaceId || undefined;
  }

  const insertVariants = makeInsertVariants({
    title,
    difficulty,
    topicId,
    workspaceId,
    difficultyWeight: difficultyWeight ?? difficultyWeightMap[difficulty],
    isFreePreview,
  });

  let question: Record<string, unknown> | null = null;
  let lastError: { code?: string; message?: string } | null = null;

  for (const insertPayload of insertVariants) {
    const result = await supabase.from('questions').insert(insertPayload).select('*').single();
    if (!result.error && result.data) {
      question = result.data as Record<string, unknown>;
      lastError = null;
      break;
    }

    lastError = {
      code: result.error?.code,
      message: result.error?.message,
    };

    if (result.error?.code !== '42703') {
      break;
    }
  }

  if (!question) {
    return jsonError(lastError?.message || 'Failed to create question.', 500);
  }

  const questionId = typeof question.id === 'string' ? question.id : '';
  if (!questionId) {
    return jsonError('Question was created but response is invalid.', 500);
  }

  const companySet = Array.from(new Set(companyIds));
  if (companySet.length) {
    const { error: companyError } = await supabase.from('question_companies').insert(
      companySet.map((companyId) => ({
        question_id: questionId,
        company_id: companyId,
      })),
    );
    if (companyError && companyError.code !== '42P01') {
      return jsonError('Failed to link companies.', 500);
    }
  }

  const tagSet = Array.from(new Set(tagIds));
  if (tagSet.length) {
    const { error: tagError } = await supabase.from('question_tags').insert(
      tagSet.map((tagId) => ({
        question_id: questionId,
        tag_id: tagId,
      })),
    );
    if (tagError && tagError.code !== '42P01') {
      return jsonError('Failed to link tags.', 500);
    }
  }

  return NextResponse.json(question, { status: 201 });
}

