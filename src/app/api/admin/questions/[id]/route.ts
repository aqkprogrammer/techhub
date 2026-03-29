import { NextResponse } from 'next/server';

import { QuestionIdParamSchema, UpdateQuestionBodySchema, type Difficulty } from '@techhub/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { jsonError, requireAdmin } from '../../../_utils';

const difficultyWeightMap: Record<Difficulty, number> = {
  junior: 1,
  mid: 2,
  senior: 3,
};

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const idParsed = QuestionIdParamSchema.safeParse({ id: context.params.id });
  if (!idParsed.success) return jsonError('Invalid question id.');

  const body = await request.json().catch(() => null);
  const parsed = UpdateQuestionBodySchema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid request body.');
  if (parsed.data.workspaceId !== undefined) {
    return jsonError('workspaceId cannot be changed.');
  }

  const supabase = createSupabaseServerClient();
  const { response } = await requireAdmin(supabase, { request });
  if (response) return response;
  const update: Record<string, unknown> = {};

  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.difficulty !== undefined) {
    update.difficulty = parsed.data.difficulty;
    if (parsed.data.difficultyWeight === undefined) {
      update.difficulty_weight = difficultyWeightMap[parsed.data.difficulty];
    }
  }
  if (parsed.data.difficultyWeight !== undefined) {
    update.difficulty_weight = parsed.data.difficultyWeight;
  }
  if (parsed.data.topicId !== undefined) update.topic_id = parsed.data.topicId;
  if (parsed.data.isFreePreview !== undefined) update.free_preview = parsed.data.isFreePreview;

  if (Object.keys(update).length) {
    const { error } = await supabase
      .from('questions')
      .update(update)
      .eq('id', idParsed.data.id);
    if (error) return jsonError('Failed to update question.', 500);
  }

  if (parsed.data.companyIds !== undefined) {
    const { error: deleteError } = await supabase
      .from('question_companies')
      .delete()
      .eq('question_id', idParsed.data.id);
    if (deleteError) return jsonError('Failed to update companies.', 500);

    const companySet = Array.from(new Set(parsed.data.companyIds));
    if (companySet.length) {
      const { error: insertError } = await supabase.from('question_companies').insert(
        companySet.map((companyId) => ({
          question_id: idParsed.data.id,
          company_id: companyId,
        }))
      );
      if (insertError) return jsonError('Failed to update companies.', 500);
    }
  }

  if (parsed.data.tagIds !== undefined) {
    const { error: deleteError } = await supabase
      .from('question_tags')
      .delete()
      .eq('question_id', idParsed.data.id);
    if (deleteError) return jsonError('Failed to update tags.', 500);

    const tagSet = Array.from(new Set(parsed.data.tagIds));
    if (tagSet.length) {
      const { error: insertError } = await supabase.from('question_tags').insert(
        tagSet.map((tagId) => ({
          question_id: idParsed.data.id,
          tag_id: tagId,
        }))
      );
      if (insertError) return jsonError('Failed to update tags.', 500);
    }
  }

  if (
    Object.keys(update).length === 0 &&
    parsed.data.companyIds === undefined &&
    parsed.data.tagIds === undefined
  ) {
    return jsonError('No changes provided.');
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  const parsed = QuestionIdParamSchema.safeParse({ id: context.params.id });
  if (!parsed.success) return jsonError('Invalid question id.');

  const supabase = createSupabaseServerClient();
  const { response } = await requireAdmin(supabase, { request });
  if (response) return response;
  const { error } = await supabase.from('questions').delete().eq('id', parsed.data.id);
  if (error) return jsonError('Failed to delete question.', 500);

  return NextResponse.json({ ok: true });
}
