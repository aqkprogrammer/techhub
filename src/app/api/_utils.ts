import { NextResponse } from 'next/server';

import type { Answer, Question, QuestionListItem, QuestionMetrics, QuestionWithAnswer, Topic, Company, Tag } from '@techhub/types';
import { setAuthCookies } from './auth/_shared';
import { requireAuthenticatedUser } from './account/_auth';

export type QuestionRow = {
  id: string;
  title: string;
  difficulty: Question['difficulty'];
  difficulty_weight: number;
  workspace_id: string;
  topic_id: string;
  is_free_preview?: boolean | null;
  free_preview?: boolean | null;
  popularity_score: number | string;
  created_at: string;
  updated_at: string;
  topics?:
    | { id: string; name: string; workspace_id?: string }
    | Array<{ id: string; name: string; workspace_id?: string }>
    | null;
  question_companies?: { company: { id: string; name: string; workspace_id?: string } | null }[];
  question_tags?: { tag: { id: string; name: string; workspace_id?: string } | null }[];
  question_metrics?: {
    question_id: string;
    views: number;
    completions: number;
    bookmarks: number;
    upvotes: number;
    downvotes: number;
    last_viewed_at: string | null;
  }[];
  answers?: {
    id: string;
    question_id: string;
    short_answer: string;
    deep_explanation: string;
    real_world_example: string;
    common_mistakes: unknown;
    follow_up_questions?: unknown;
    follow_ups?: unknown;
    created_at: string;
    updated_at: string;
  }[];
};

export const jsonError = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export type RequireAdminOptions = {
  request?: Request | null;
};

export const requireAdmin = async (
  supabase: { from: (table: string) => any },
  options?: RequireAdminOptions
): Promise<{ response: NextResponse | null }> => {
  const request = options?.request ?? null;
  if (!request) {
    return { response: jsonError('Unauthorized.', 401) };
  }

  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return { response: auth.response };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (profileError) {
    return { response: jsonError(profileError.message ?? 'Failed to verify admin role.', 500) };
  }

  if (profile?.role !== 'admin') {
    const response = jsonError('Forbidden.', 403);
    if (auth.session) {
      setAuthCookies(response, auth.session);
    }
    return { response };
  }

  return { response: null };
};

export const mapTopic = (row: QuestionRow): Topic => {
  const topic = Array.isArray(row.topics) ? (row.topics[0] ?? null) : (row.topics ?? null);
  return {
    id: topic?.id ?? row.topic_id,
    name: topic?.name ?? 'Unknown',
    workspaceId: topic?.workspace_id ?? row.workspace_id,
  };
};

function readStringField(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  return typeof record[key] === 'string' ? record[key] : null;
}

export const mapCompanies = (row: QuestionRow): Company[] =>
  (row.question_companies ?? [])
    .map((item) => item.company)
    .filter((company): company is NonNullable<typeof company> => Boolean(company))
    .map((company) => {
      return {
        id: company.id,
        name: company.name,
        workspaceId:
          readStringField(company, 'workspace_id') ??
          readStringField(company, 'workspaceId') ??
          row.workspace_id,
      };
    });

export const mapTags = (row: QuestionRow): Tag[] =>
  (row.question_tags ?? [])
    .map((item) => item.tag)
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
    .map((tag) => {
      return {
        id: tag.id,
        name: tag.name,
        workspaceId:
          readStringField(tag, 'workspace_id') ??
          readStringField(tag, 'workspaceId') ??
          row.workspace_id,
      };
    });

export const mapMetrics = (row: QuestionRow): QuestionMetrics | undefined => {
  const metrics = row.question_metrics?.[0];
  if (!metrics) return undefined;
  return {
    questionId: metrics.question_id,
    views: metrics.views,
    completions: metrics.completions,
    bookmarks: metrics.bookmarks,
    upvotes: metrics.upvotes,
    downvotes: metrics.downvotes,
    lastViewedAt: metrics.last_viewed_at,
  };
};

export const mapQuestion = (row: QuestionRow): Question => ({
  id: row.id,
  title: row.title,
  difficulty: row.difficulty,
  difficultyWeight: row.difficulty_weight,
  workspaceId: row.workspace_id,
  topicId: row.topic_id,
  companyIds: mapCompanies(row).map((company) => company.id),
  tagIds: mapTags(row).map((tag) => tag.id),
  isFreePreview: Boolean(row.free_preview ?? row.is_free_preview ?? false),
  popularityScore: Number(row.popularity_score),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(/\n|;/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
}

function toFollowUpQuestionList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') return entry.trim();
        if (!entry || typeof entry !== 'object') return '';
        const row = entry as Record<string, unknown>;
        const question = typeof row.question === 'string' ? row.question.trim() : '';
        if (question) return question;
        return typeof row.answer === 'string' ? row.answer.trim() : '';
      })
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        return toFollowUpQuestionList(JSON.parse(trimmed));
      } catch {
        // Fall through to line-based parsing.
      }
    }

    return trimmed
      .split(/\n|;/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
}

export const mapAnswer = (row: QuestionRow): Answer | undefined => {
  const answer = row.answers?.[0];
  if (!answer) return undefined;
  return {
    id: answer.id,
    questionId: answer.question_id,
    shortAnswer: answer.short_answer,
    deepExplanation: answer.deep_explanation,
    realWorldExample: answer.real_world_example,
    commonMistakes: toStringList(answer.common_mistakes),
    followUpQuestions: toFollowUpQuestionList(
      answer.follow_ups ?? answer.follow_up_questions
    ),
    createdAt: answer.created_at,
    updatedAt: answer.updated_at,
  };
};

export const mapQuestionListItem = (row: QuestionRow): QuestionListItem => ({
  question: mapQuestion(row),
  topic: mapTopic(row),
  companies: mapCompanies(row),
  tags: mapTags(row),
  metrics: mapMetrics(row),
});

export const mapQuestionWithAnswer = (row: QuestionRow): QuestionWithAnswer => ({
  question: mapQuestion(row),
  topic: mapTopic(row),
  companies: mapCompanies(row),
  tags: mapTags(row),
  metrics: mapMetrics(row),
  answer: mapAnswer(row),
});
