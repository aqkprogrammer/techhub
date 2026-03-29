import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const interviewDifficultySchema = z.enum([
  'easy',
  'medium',
  'hard',
  'junior',
  'mid',
  'senior',
]);

export type InterviewDifficulty = z.infer<typeof interviewDifficultySchema>;

export type AiMessage = {
  role: 'assistant' | 'user';
  content: string;
  createdAt: string;
};

export function normalizeDifficulty(value: InterviewDifficulty): 'junior' | 'mid' | 'senior' {
  if (value === 'easy' || value === 'junior') return 'junior';
  if (value === 'medium' || value === 'mid') return 'mid';
  return 'senior';
}

export function sanitizePromptInput(value: string, max = 4000): string {
  return value.replace(/\u0000/g, '').trim().slice(0, max);
}

export function parseAiMessages(value: unknown): AiMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const role = row.role === 'assistant' || row.role === 'user' ? row.role : null;
      const content = typeof row.content === 'string' ? row.content.trim() : '';
      const createdAt = typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString();
      if (!role || !content) return null;
      return {
        role,
        content,
        createdAt,
      } satisfies AiMessage;
    })
    .filter((entry): entry is AiMessage => Boolean(entry));
}

export async function loadAiInterview(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  interviewId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from('ai_interviews')
    .select('*')
    .eq('id', interviewId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return null;
  }
  return data ?? null;
}

export async function saveAiInterview(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  options: {
    interviewId?: string;
    userId: string;
    topic: string;
    difficulty: string;
    messages: AiMessage[];
  },
) {
  const basePayload = {
    user_id: options.userId,
    topic: options.topic,
    difficulty: options.difficulty,
    messages: options.messages,
    updated_at: new Date().toISOString(),
  };

  if (options.interviewId) {
    const { data, error } = await supabase
      .from('ai_interviews')
      .update(basePayload)
      .eq('id', options.interviewId)
      .eq('user_id', options.userId)
      .select('*')
      .maybeSingle();
    if (!error && data) return data;
  }

  const payloadVariants = [
    {
      ...basePayload,
      created_at: new Date().toISOString(),
    },
    {
      user_id: options.userId,
      messages: options.messages,
    },
  ];

  for (const payload of payloadVariants) {
    const { data, error } = await supabase.from('ai_interviews').insert(payload).select('*').maybeSingle();
    if (!error && data) return data;
  }

  throw new Error('Failed to save AI interview conversation.');
}
