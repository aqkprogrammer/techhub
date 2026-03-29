import { NextResponse } from 'next/server';
import { z } from 'zod';

import { setAuthCookies } from '@/app/api/auth/_shared';
import { requirePaidApiUser } from '@/app/api/_security';
import { jsonError } from '@/app/api/_utils';
import { createOpenAiChatCompletion, parseJsonObject } from '@/lib/openai';
import { getLearningDashboardData } from '@/lib/learning-dashboard';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const coachSchema = z.object({
  weakTopics: z.array(z.string().trim().min(1)).max(10).optional(),
});

type CoachTopic = {
  topic: string;
  reason: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
};

type CoachResponse = {
  recommendations: CoachTopic[];
  summary: string;
};

function normalizeRecommendation(value: unknown): CoachTopic | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const topic = typeof row.topic === 'string' ? row.topic.trim() : '';
  const reason = typeof row.reason === 'string' ? row.reason.trim() : '';
  const action = typeof row.action === 'string' ? row.action.trim() : '';
  const priorityRaw = typeof row.priority === 'string' ? row.priority.trim().toLowerCase() : 'medium';
  const priority = priorityRaw === 'high' || priorityRaw === 'low' ? priorityRaw : 'medium';
  if (!topic || !reason || !action) return null;
  return { topic, reason, action, priority };
}

export async function POST(request: Request) {
  const auth = await requirePaidApiUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = coachSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid coach request.');
  }

  const dashboard = await getLearningDashboardData(auth.supabase, auth.user.id);
  const weakTopics =
    parsed.data.weakTopics && parsed.data.weakTopics.length > 0
      ? parsed.data.weakTopics
      : dashboard.weakTopics.map((topic) => `${topic.topicName} (${topic.progressPercent}% complete)`);

  const prompt = `You are an AI career coach helping someone prepare for technical interviews.
Recommend next topics based on this user context:
- XP points: ${dashboard.xpPoints}
- Overall progress: ${dashboard.overallProgressPercent}%
- Daily streak: ${dashboard.dailyStreak}
- Weak topics: ${weakTopics.join(', ') || 'None provided'}

Return JSON with:
{
  "summary": "short coaching summary",
  "recommendations": [
    { "topic": "...", "reason": "...", "action": "...", "priority": "high|medium|low" }
  ]
}

Return 4 recommendations maximum.`;

  let completion = '';
  try {
    completion = await createOpenAiChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      requireJson: true,
      temperature: 0.35,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Failed to generate coaching plan.', 500);
  }

  let parsedResponse: CoachResponse;
  try {
    parsedResponse = parseJsonObject<CoachResponse>(completion);
  } catch {
    return jsonError('AI returned invalid coaching response.', 500);
  }

  const recommendations = (Array.isArray(parsedResponse.recommendations)
    ? parsedResponse.recommendations
    : []
  )
    .map(normalizeRecommendation)
    .filter((entry): entry is CoachTopic => Boolean(entry))
    .slice(0, 4);

  const response = NextResponse.json({
    summary:
      typeof parsedResponse.summary === 'string' && parsedResponse.summary.trim()
        ? parsedResponse.summary.trim()
        : 'Focus on one weak area at a time and practice with deliberate repetition.',
    recommendations,
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }
  return response;
}
