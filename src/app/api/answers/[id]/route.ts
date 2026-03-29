import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapAnswerRowToApi } from '@/lib/questions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { jsonError } from '../../_utils';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const params = await context.params;
  const idParsed = paramsSchema.safeParse({ id: params.id });
  if (!idParsed.success) {
    return jsonError('Invalid question id.');
  }

  const searchParams = new URL(request.url).searchParams;
  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '20');
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize =
    Number.isFinite(pageSize) && pageSize > 0
      ? Math.min(Math.floor(pageSize), 100)
      : 20;
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  const supabase = createSupabaseServerClient();

  const { data: questionData, error: questionError } = await supabase
    .from('questions')
    .select('*')
    .eq('id', idParsed.data.id)
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

  if (!isFreePreview) {
    return NextResponse.json({
      questionId: idParsed.data.id,
      page: safePage,
      pageSize: safePageSize,
      total: 0,
      count: 0,
      items: [],
      locked: true,
      freePreview: false,
    });
  }

  const { data, error, count } = await supabase
    .from('answers')
    .select('*', { count: 'exact' })
    .eq('question_id', idParsed.data.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    return jsonError('Failed to load answers.', 500);
  }

  const items = (data ?? []).map((row) => mapAnswerRowToApi(row as Record<string, unknown>));

  return NextResponse.json({
    questionId: idParsed.data.id,
    page: safePage,
    pageSize: safePageSize,
    total: count ?? items.length,
    count: items.length,
    items,
    locked: false,
    freePreview: true,
  });
}

