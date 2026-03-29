import type { Difficulty, QuestionWithAnswer } from '@techhub/types';
import { QuestionIdParamSchema } from '@techhub/types';

import { mapAnswerRowToApi } from '@/lib/questions';
import { getServerUserFromCookies } from '@/lib/auth/server-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hasPaidSubscription } from '@/app/api/_security';

import { getDummyQuestionListingData, DUMMY_QUESTION_IDS } from './data';

const selectClause = `
  id,
  title,
  slug,
  difficulty,
  topic_id,
  free_preview,
  is_free_preview,
  created_at,
  updated_at,
  topic:topics(*),
  answers(*)
`;

export type QuestionDetailData = Awaited<ReturnType<typeof getQuestionDetail>>;

const DUMMY_WS = '00000000-0000-0000-0000-000000000001';
const DUMMY_ANSWER = {
  id: '40000000-0000-0000-0000-000000000001',
  questionId: '',
  shortAnswer:
    'This is dummy answer content. Replace with real API or Supabase data. The virtual DOM is a lightweight copy of the real DOM that React keeps in memory and uses to compute the minimal set of changes needed for the next render.',
  deepExplanation:
    'Dummy deep explanation. When you connect Supabase or your API, full answers will load here. React batches updates and reconciles the virtual DOM with the real DOM efficiently.',
  realWorldExample:
    'Dummy real-world example. In production, this section would contain concrete code or scenario examples.',
  commonMistakes: ['Forgetting dependency arrays in useEffect', 'Mutating state directly'],
  followUpQuestions: ['How does React Fiber improve reconciliation?', 'What is the commit phase?'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function toDifficulty(value: unknown): Difficulty {
  const normalized = typeof value === 'string' ? value.toLowerCase() : 'mid';
  if (normalized === 'easy' || normalized === 'junior') return 'junior';
  if (normalized === 'hard' || normalized === 'senior') return 'senior';
  return 'mid';
}

function toDifficultyWeight(difficulty: Difficulty): number {
  if (difficulty === 'junior') return 1;
  if (difficulty === 'mid') return 2;
  return 3;
}

export async function getQuestionDetail(id: string) {
  const parsed = QuestionIdParamSchema.safeParse({ id });
  if (!parsed.success) return null;

  const supabase = createSupabaseServerClient();

  if (!supabase) {
    if (!DUMMY_QUESTION_IDS.has(id.toLowerCase())) return null;
    const { questions } = getDummyQuestionListingData({});
    const entry = questions.find((q) => q.id.toLowerCase() === id.toLowerCase());
    if (!entry) return null;
    const topic = { id: entry.topic.id, name: entry.topic.name, workspaceId: DUMMY_WS };
    const companiesWithWs = entry.companies.map((c) => ({ ...c, workspaceId: DUMMY_WS }));
    const now = new Date().toISOString();
    const detail: QuestionWithAnswer = {
      question: {
        id: entry.id,
        title: entry.title,
        difficulty: entry.difficulty,
        difficultyWeight: entry.difficultyWeight,
        workspaceId: DUMMY_WS,
        topicId: entry.topic.id,
        companyIds: entry.companies.map((c) => c.id),
        tagIds: [],
        isFreePreview: entry.isFreePreview,
        popularityScore: entry.popularityScore,
        createdAt: entry.createdAt,
        updatedAt: now,
      },
      topic,
      companies: companiesWithWs,
      tags: [],
      answer: entry.isFreePreview
        ? {
            ...DUMMY_ANSWER,
            questionId: entry.id,
            shortAnswer: entry.shortAnswer ?? DUMMY_ANSWER.shortAnswer,
          }
        : undefined,
    };
    return detail;
  }

  const { data, error } = await supabase
    .from('questions')
    .select(selectClause)
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const difficulty = toDifficulty(row.difficulty);
  const isFreePreview = Boolean(row.free_preview ?? row.is_free_preview);
  let hasPaidAccess = false;

  if (!isFreePreview) {
    const { user } = await getServerUserFromCookies();
    if (user) {
      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!subscriptionsError) {
        const latestSubscription = Array.isArray(subscriptions) ? subscriptions[0] : null;
        hasPaidAccess = hasPaidSubscription(
          latestSubscription as {
            status?: string | null;
            plan?: string | null;
            is_lifetime?: boolean | null;
            expires_at?: string | null;
            current_period_end?: string | null;
          } | null,
        );
      }
    }
  }

  const topicRowRaw = Array.isArray(row.topic)
    ? (row.topic[0] as Record<string, unknown> | undefined)
    : (row.topic as Record<string, unknown> | null);

  const topicId = typeof row.topic_id === 'string' ? row.topic_id : '';
  const topicName =
    (topicRowRaw && typeof topicRowRaw.name === 'string' && topicRowRaw.name.trim()) ||
    (topicRowRaw && typeof topicRowRaw.title === 'string' && topicRowRaw.title.trim()) ||
    'Unknown';
  const topicWorkspaceId =
    (topicRowRaw && typeof topicRowRaw.workspace_id === 'string' && topicRowRaw.workspace_id.trim()) ||
    DUMMY_WS;

  const answersRaw = Array.isArray(row.answers) ? (row.answers as Record<string, unknown>[]) : [];
  const latestAnswer = answersRaw[0] ?? null;
  const mappedAnswer = latestAnswer ? mapAnswerRowToApi(latestAnswer) : null;

  const mapped: QuestionWithAnswer = {
    question: {
      id: String(row.id),
      title: String(row.title ?? ''),
      difficulty,
      difficultyWeight: toDifficultyWeight(difficulty),
      workspaceId: DUMMY_WS,
      topicId,
      companyIds: [],
      tagIds: [],
      isFreePreview,
      popularityScore: 0,
      createdAt: String(row.created_at ?? new Date().toISOString()),
      updatedAt: String(row.updated_at ?? new Date().toISOString()),
    },
    topic: {
      id: topicId,
      name: topicName,
      workspaceId: topicWorkspaceId,
    },
    companies: [],
    tags: [],
    answer:
      (isFreePreview || hasPaidAccess) && mappedAnswer
        ? {
            id: mappedAnswer.id ?? '',
            questionId: mappedAnswer.questionId ?? parsed.data.id,
            shortAnswer: mappedAnswer.shortAnswer ?? '',
            deepExplanation: mappedAnswer.deepExplanation ?? '',
            realWorldExample: mappedAnswer.realWorldExample ?? '',
            commonMistakes: mappedAnswer.commonMistakes,
            followUpQuestions: mappedAnswer.followUps
              .map((entry) => entry.question)
              .filter((entry) => entry.length > 0),
            createdAt: mappedAnswer.createdAt ?? new Date().toISOString(),
            updatedAt: mappedAnswer.updatedAt ?? new Date().toISOString(),
          }
        : undefined,
  };

  return mapped;
}
