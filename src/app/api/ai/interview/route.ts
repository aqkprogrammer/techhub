import { NextResponse } from 'next/server';
import { z } from 'zod';

import { setAuthCookies } from '@/app/api/auth/_shared';
import { requirePaidApiUser } from '@/app/api/_security';
import { jsonError } from '@/app/api/_utils';
import { createOpenAiChatCompletion } from '@/lib/openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import {
  interviewDifficultySchema,
  loadAiInterview,
  normalizeDifficulty,
  parseAiMessages,
  saveAiInterview,
  sanitizePromptInput,
  type AiMessage,
} from '../_shared';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const interviewRequestSchema = z.object({
  topic: z.string().trim().min(2).max(120),
  difficulty: interviewDifficultySchema,
  interviewId: z.string().uuid().optional(),
  message: z.string().trim().max(4000).optional(),
});

function toChatMessages(messages: AiMessage) {
  return {
    role: messages.role,
    content: messages.content,
  } as { role: 'assistant' | 'user'; content: string };
}

async function getAiQuestionOrFollowUp(options: {
  topic: string;
  difficulty: string;
  history: AiMessage[];
}) {
  const systemPrompt =
    'You are a senior software engineering interviewer. Stay concise, technical, and realistic.';

  const userPrompt =
    options.history.length === 0
      ? `Ask the candidate a challenging interview question about ${options.topic}. Difficulty ${options.difficulty}. Then ask exactly one follow-up question in the same reply.`
      : `Continue this interview. Ask one challenging follow-up question about ${options.topic} at ${options.difficulty} difficulty, based on the candidate's previous answer.`;

  const completion = await createOpenAiChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      ...options.history.map((entry) => toChatMessages(entry)),
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
  });

  return completion.trim();
}

export async function POST(request: Request) {
  const auth = await requirePaidApiUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = interviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid interview request.');
  }

  const topic = sanitizePromptInput(parsed.data.topic, 120);
  const difficulty = normalizeDifficulty(parsed.data.difficulty);
  const userMessage = parsed.data.message ? sanitizePromptInput(parsed.data.message) : null;
  const supabase = auth.supabase as ReturnType<typeof createSupabaseServerClient>;

  let history: AiMessage[] = [];
  let interviewId = parsed.data.interviewId ?? null;

  if (interviewId) {
    const existing = await loadAiInterview(supabase, interviewId, auth.user.id);
    if (!existing) {
      return jsonError('Interview session not found.', 404);
    }
    history = parseAiMessages((existing as Record<string, unknown>).messages);
  }

  if (userMessage) {
    history.push({
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    });
  }

  let assistantMessage = '';
  try {
    assistantMessage = await getAiQuestionOrFollowUp({
      topic,
      difficulty,
      history,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'AI interview generation failed.', 500);
  }

  history.push({
    role: 'assistant',
    content: assistantMessage,
    createdAt: new Date().toISOString(),
  });

  let saved: Record<string, unknown>;
  try {
    saved = (await saveAiInterview(supabase, {
      interviewId: interviewId ?? undefined,
      userId: auth.user.id,
      topic,
      difficulty,
      messages: history,
    })) as Record<string, unknown>;
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Failed to persist interview.', 500);
  }

  interviewId = typeof saved.id === 'string' ? saved.id : interviewId;

  const response = NextResponse.json({
    interviewId,
    topic,
    difficulty,
    messages: history,
    assistantMessage,
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }

  return response;
}
