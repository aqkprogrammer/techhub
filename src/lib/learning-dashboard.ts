import { createSupabaseServerClient } from '@/lib/supabase/server';

type TopicRow = {
  id: string;
  name?: string | null;
  title?: string | null;
  slug?: string | null;
};

type QuestionRow = {
  id: string;
  topic_id: string | null;
  topic?: TopicRow | TopicRow[] | null;
};

type UserProgressRow = {
  question_id: string | null;
  completed: boolean | null;
};

type QuestionViewRow = {
  question_id?: string | null;
  viewed_at?: string | null;
  created_at?: string | null;
};

type QuestionSummaryRow = {
  id: string;
  title: string;
  slug: string | null;
  difficulty: string;
  topic_id: string | null;
  topic?: TopicRow | TopicRow[] | null;
};

type StreakRow = {
  current_streak?: number | null;
  streak?: number | null;
  longest_streak?: number | null;
  last_activity_date?: string | null;
  updated_at?: string | null;
};

export type DashboardTopicProgress = {
  topicId: string;
  topicName: string;
  topicSlug: string;
  completedQuestions: number;
  totalQuestions: number;
  progressPercent: number;
};

export type DashboardQuestionPreview = {
  questionId: string;
  title: string;
  slug: string | null;
  difficulty: string;
  topicName: string;
  topicSlug: string;
  viewedAt: string | null;
};

export type LearningDashboardData = {
  xpPoints: number;
  totalQuestions: number;
  completedQuestions: number;
  overallProgressPercent: number;
  dailyStreak: number;
  longestStreak: number;
  recommendedTopics: DashboardTopicProgress[];
  weakTopics: DashboardTopicProgress[];
  topicProgress: DashboardTopicProgress[];
  recentlyViewed: DashboardQuestionPreview[];
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function getTopicFromJoined(question: QuestionRow | QuestionSummaryRow): TopicRow | null {
  const value = question.topic;
  if (!value) return null;
  if (Array.isArray(value)) {
    return (value[0] ?? null) as TopicRow | null;
  }
  return value as TopicRow;
}

function normalizeTopicName(topic: TopicRow | null): string {
  const fromName = typeof topic?.name === 'string' ? topic.name.trim() : '';
  if (fromName) return fromName;
  const fromTitle = typeof topic?.title === 'string' ? topic.title.trim() : '';
  if (fromTitle) return fromTitle;
  return 'General';
}

function normalizeTopicSlug(topic: TopicRow | null, fallbackName: string): string {
  const fromSlug = typeof topic?.slug === 'string' ? topic.slug.trim() : '';
  if (fromSlug) return fromSlug;
  return slugify(fallbackName);
}

async function loadQuestionViews(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  limit: number,
) {
  const attemptViewedAt = await supabase
    .from('question_views')
    .select('*')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .limit(limit);

  if (!attemptViewedAt.error) {
    return (attemptViewedAt.data ?? []) as QuestionViewRow[];
  }

  const attemptCreatedAt = await supabase
    .from('question_views')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!attemptCreatedAt.error) {
    return (attemptCreatedAt.data ?? []) as QuestionViewRow[];
  }

  return [];
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export async function getLearningDashboardData(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
): Promise<LearningDashboardData> {
  const [questionsResult, progressResult, streakResult, views] = await Promise.all([
    supabase
      .from('questions')
      .select('id, topic_id, topic:topics(id,name,title,slug)'),
    supabase
      .from('user_progress')
      .select('question_id, completed')
      .eq('user_id', userId),
    supabase.from('user_streaks').select('*').eq('user_id', userId).maybeSingle(),
    loadQuestionViews(supabase, userId, 30),
  ]);

  const questionRows = (questionsResult.data ?? []) as QuestionRow[];
  const progressRows = (progressResult.data ?? []) as UserProgressRow[];
  const streakRow = (streakResult.data ?? null) as StreakRow | null;

  const topicTotals = new Map<
    string,
    { name: string; slug: string; total: number; completed: number }
  >();
  const questionTopicById = new Map<string, { topicId: string; name: string; slug: string }>();

  for (const question of questionRows) {
    const joinedTopic = getTopicFromJoined(question);
    const topicId = question.topic_id ?? joinedTopic?.id ?? 'general';
    const topicName = normalizeTopicName(joinedTopic);
    const topicSlug = normalizeTopicSlug(joinedTopic, topicName);

    const current = topicTotals.get(topicId) ?? {
      name: topicName,
      slug: topicSlug,
      total: 0,
      completed: 0,
    };
    current.total += 1;
    topicTotals.set(topicId, current);
    questionTopicById.set(question.id, { topicId, name: topicName, slug: topicSlug });
  }

  const completedQuestionIds = new Set<string>();
  for (const row of progressRows) {
    const questionId = row.question_id;
    if (!questionId) continue;
    if (row.completed) {
      completedQuestionIds.add(questionId);
      const topicInfo = questionTopicById.get(questionId);
      if (topicInfo) {
        const topic = topicTotals.get(topicInfo.topicId);
        if (topic) {
          topic.completed += 1;
        }
      }
    }
  }

  const topicProgress = Array.from(topicTotals.entries())
    .map(([topicId, value]) => ({
      topicId,
      topicName: value.name,
      topicSlug: value.slug,
      completedQuestions: value.completed,
      totalQuestions: value.total,
      progressPercent: value.total > 0 ? Math.round((value.completed / value.total) * 100) : 0,
    }))
    .sort((a, b) => b.totalQuestions - a.totalQuestions);

  const weakTopics = [...topicProgress]
    .filter((item) => item.totalQuestions > 0 && item.progressPercent < 80)
    .sort((a, b) => {
      if (a.progressPercent !== b.progressPercent) return a.progressPercent - b.progressPercent;
      return b.totalQuestions - a.totalQuestions;
    })
    .slice(0, 5);

  const recommendedTopics = weakTopics.length > 0 ? weakTopics.slice(0, 4) : topicProgress.slice(0, 4);

  const totalQuestions = questionRows.length;
  const completedQuestions = completedQuestionIds.size;
  const overallProgressPercent =
    totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0;

  const currentStreak = toNumber(streakRow?.current_streak ?? streakRow?.streak, 0);
  const longestStreak = toNumber(streakRow?.longest_streak, currentStreak);
  const uniqueViewedQuestions = new Set(
    views
      .map((view) => (typeof view.question_id === 'string' ? view.question_id : ''))
      .filter((questionId) => questionId.length > 0),
  );
  const xpPoints = completedQuestions * 10 + currentStreak * 5 + uniqueViewedQuestions.size * 2;

  const recentQuestionIds = Array.from(
    new Set(
      views
        .map((view) => (typeof view.question_id === 'string' ? view.question_id : ''))
        .filter((questionId) => questionId.length > 0),
    ),
  ).slice(0, 12);

  let recentQuestionRows: QuestionSummaryRow[] = [];
  if (recentQuestionIds.length > 0) {
    const { data } = await supabase
      .from('questions')
      .select('id,title,slug,difficulty,topic_id,topic:topics(id,name,title,slug)')
      .in('id', recentQuestionIds);
    recentQuestionRows = (data ?? []) as QuestionSummaryRow[];
  }

  const recentMap = new Map(recentQuestionRows.map((row) => [row.id, row]));
  const viewedAtByQuestionId = new Map<string, string | null>();
  for (const view of views) {
    const questionId = typeof view.question_id === 'string' ? view.question_id : null;
    if (!questionId || viewedAtByQuestionId.has(questionId)) continue;
    const viewedAt =
      typeof view.viewed_at === 'string'
        ? view.viewed_at
        : typeof view.created_at === 'string'
          ? view.created_at
          : null;
    viewedAtByQuestionId.set(questionId, viewedAt);
  }

  const recentlyViewed: DashboardQuestionPreview[] = recentQuestionIds
    .map((questionId) => {
      const row = recentMap.get(questionId);
      if (!row) return null;
      const joinedTopic = getTopicFromJoined(row);
      const topicName = normalizeTopicName(joinedTopic);
      return {
        questionId: row.id,
        title: row.title,
        slug: row.slug,
        difficulty: row.difficulty,
        topicName,
        topicSlug: normalizeTopicSlug(joinedTopic, topicName),
        viewedAt: viewedAtByQuestionId.get(row.id) ?? null,
      };
    })
    .filter((item): item is DashboardQuestionPreview => Boolean(item));

  return {
    xpPoints,
    totalQuestions,
    completedQuestions,
    overallProgressPercent,
    dailyStreak: currentStreak,
    longestStreak,
    recommendedTopics,
    weakTopics,
    topicProgress,
    recentlyViewed,
  };
}
