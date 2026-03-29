import Link from 'next/link';
import { redirect } from 'next/navigation';

import LearningCoach from '@/components/dashboard/learning-coach';
import { getServerUserFromCookies } from '@/lib/auth/server-user';
import { getLearningDashboardData } from '@/lib/learning-dashboard';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function formatViewedDate(value: string | null) {
  if (!value) return 'Recently viewed';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recently viewed';
  return `Viewed ${parsed.toLocaleDateString()}`;
}

function toTopicHref(topicSlug: string, topicName: string) {
  return `/interview-questions?q=${encodeURIComponent(topicName)}#questions`;
}

function progressBarColor(percent: number) {
  if (percent >= 80) return 'bg-emerald-500';
  if (percent >= 45) return 'bg-amber-500';
  return 'bg-rose-500';
}

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const auth = await getServerUserFromCookies();
  if (!auth.user) {
    redirect('/login?next=%2Fdashboard');
  }

  const supabase = createSupabaseServerClient();
  const [dashboard, profileResult] = await Promise.all([
    getLearningDashboardData(supabase, auth.user.id),
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', auth.user.id)
      .maybeSingle(),
  ]);

  const userName =
    (typeof profileResult.data?.full_name === 'string' && profileResult.data.full_name.trim()) ||
    (typeof auth.user.user_metadata?.full_name === 'string' && auth.user.user_metadata.full_name.trim()) ||
    auth.user.email?.split('@')[0] ||
    'Developer';

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <section className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
        <p className="text-sm text-[rgb(var(--muted))]">Welcome back</p>
        <h1 className="mt-1 text-2xl font-bold text-[rgb(var(--text))]">{userName}</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-[rgb(var(--accent))]/30 bg-[rgb(var(--accent))]/10 px-3 py-1 text-[rgb(var(--accent))]">
            XP {dashboard.xpPoints}
          </span>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-700 dark:text-emerald-300">
            Daily streak {dashboard.dailyStreak}
          </span>
          <span className="rounded-full border border-[rgb(var(--border))] px-3 py-1 text-[rgb(var(--muted))]">
            Longest streak {dashboard.longestStreak}
          </span>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5">
          <p className="text-sm text-[rgb(var(--muted))]">Learning Progress</p>
          <p className="mt-2 text-2xl font-semibold text-[rgb(var(--text))]">
            {dashboard.completedQuestions}/{dashboard.totalQuestions}
          </p>
          <p className="text-xs text-[rgb(var(--muted))]">{dashboard.overallProgressPercent}% complete</p>
          <div className="mt-3 h-2 rounded-full bg-[rgb(var(--border))]">
            <div
              className={`h-2 rounded-full ${progressBarColor(dashboard.overallProgressPercent)}`}
              style={{ width: `${dashboard.overallProgressPercent}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5">
          <p className="text-sm text-[rgb(var(--muted))]">Daily Streak</p>
          <p className="mt-2 text-2xl font-semibold text-[rgb(var(--text))]">{dashboard.dailyStreak} days</p>
          <p className="text-xs text-[rgb(var(--muted))]">Keep practicing daily to maintain momentum.</p>
        </div>
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5">
          <p className="text-sm text-[rgb(var(--muted))]">Recommended Topics</p>
          <p className="mt-2 text-2xl font-semibold text-[rgb(var(--text))]">
            {dashboard.recommendedTopics.length}
          </p>
          <p className="text-xs text-[rgb(var(--muted))]">AI-selected areas to focus next.</p>
        </div>
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5">
          <p className="text-sm text-[rgb(var(--muted))]">Continue Learning</p>
          <Link
            href="/interview-questions#questions"
            className="mt-2 inline-flex rounded-lg bg-[rgb(var(--accent))] px-3 py-2 text-sm font-semibold text-white"
          >
            Resume Questions
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5">
          <h2 className="text-lg font-semibold text-[rgb(var(--text))]">Recommended Topics</h2>
          {dashboard.recommendedTopics.length === 0 ? (
            <p className="mt-3 text-sm text-[rgb(var(--muted))]">No recommendations yet. Start solving questions.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {dashboard.recommendedTopics.map((topic) => (
                <li key={topic.topicId} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={toTopicHref(topic.topicSlug, topic.topicName)}
                      className="text-sm font-semibold text-[rgb(var(--text))] hover:text-[rgb(var(--accent))] hover:underline"
                    >
                      {topic.topicName}
                    </Link>
                    <span className="text-xs text-[rgb(var(--muted))]">{topic.progressPercent}%</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-[rgb(var(--border))]">
                    <div
                      className={`h-1.5 rounded-full ${progressBarColor(topic.progressPercent)}`}
                      style={{ width: `${topic.progressPercent}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5">
          <h2 className="text-lg font-semibold text-[rgb(var(--text))]">Recently Viewed Questions</h2>
          {dashboard.recentlyViewed.length === 0 ? (
            <p className="mt-3 text-sm text-[rgb(var(--muted))]">No recent activity yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {dashboard.recentlyViewed.slice(0, 8).map((item) => (
                <li key={item.questionId} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-3">
                  <Link
                    href={`/interview-questions?q=${encodeURIComponent(item.title)}#questions`}
                    className="text-sm font-semibold text-[rgb(var(--text))] hover:text-[rgb(var(--accent))] hover:underline"
                  >
                    {item.title}
                  </Link>
                  <p className="mt-1 text-xs text-[rgb(var(--muted))]">
                    {item.topicName} · {item.difficulty} · {formatViewedDate(item.viewedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-6">
        <LearningCoach weakTopics={dashboard.weakTopics.map((topic) => topic.topicName)} />
      </section>
    </main>
  );
}
