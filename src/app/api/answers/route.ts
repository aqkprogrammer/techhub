import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapAnswerRowToApi } from '@/lib/questions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { jsonError } from '../_utils';

const querySchema = z.object({
  questionId: z.string().uuid(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return jsonError('Invalid query parameters.');
  }

  const { questionId, page, pageSize } = parsed.data;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = createSupabaseServerClient();

  const { data: questionData, error: questionError } = await supabase
    .from('questions')
    .select('*')
    .eq('id', questionId)
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
      page,
      pageSize,
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
    .eq('question_id', questionId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    return jsonError('Failed to load answers.', 500);
  }

  const items = (data ?? []).map((row) => mapAnswerRowToApi(row as Record<string, unknown>));

  return NextResponse.json({
    page,
    pageSize,
    total: count ?? items.length,
    count: items.length,
    items,
    locked: false,
    freePreview: true,
  });
}

