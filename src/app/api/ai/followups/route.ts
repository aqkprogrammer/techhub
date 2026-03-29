import { NextResponse } from 'next/server';
import { z } from 'zod';

import { setAuthCookies } from '@/app/api/auth/_shared';
import { requirePaidApiUser } from '@/app/api/_security';
import { jsonError } from '@/app/api/_utils';
import { createOpenAiChatCompletion, parseJsonObject } from '@/lib/openai';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const followupsSchema = z.object({
  question: z.string().trim().min(5).max(8000),
  topic: z.string().trim().min(2).max(120).optional(),
  difficulty: z.string().trim().min(2).max(40).optional(),
});

type FollowUpsJson = {
  questions: string[];
};

function normalizeFollowUps(payload: FollowUpsJson): string[] {
  return (Array.isArray(payload.questions) ? payload.questions : [])
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
    .slice(0, 5);
}

export async function POST(request: Request) {
  const auth = await requirePaidApiUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = followupsSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid follow-up request.');
  }

  const difficulty = parsed.data.difficulty ?? 'mid';
  const topic = parsed.data.topic ?? 'software engineering';
  const prompt = `Generate 5 follow-up technical interview questions.
Return JSON with key "questions" as an array of strings.
Topic: ${topic}
Difficulty: ${difficulty}
Base question/context: ${parsed.data.question}`;

  let completion = '';
  try {
    completion = await createOpenAiChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      requireJson: true,
      temperature: 0.5,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : 'Failed to generate follow-up questions.',
      500,
    );
  }

  let questions: string[] = [];
  try {
    questions = normalizeFollowUps(parseJsonObject<FollowUpsJson>(completion));
  } catch {
    return jsonError('AI returned invalid follow-up response.', 500);
  }

  const response = NextResponse.json({ questions });
  if (auth.session) {
    setAuthCookies(response, auth.session);
  }
  return response;
}
