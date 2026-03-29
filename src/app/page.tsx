import type { Metadata } from 'next';
import Link from 'next/link';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ShowWhenLoggedIn, ShowWhenLoggedOut, ShowWhenNotPaid } from './components/home-auth-visibility';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'techhub.cafe — Ace Your Tech Interview',
  description:
    'Curated technical interview questions with full answers across Full-Stack, JavaScript, TypeScript, React, Node.js, DSA, System Design and ML. Prepare smarter, land your next role.',
  keywords: [
    'technical interview questions',
    'javascript interview questions',
    'react interview questions',
    'system design interview',
    'fullstack developer interview',
    'coding interview prep',
    'DSA problems',
    'machine learning interview questions',
    'typescript interview',
    'node.js interview questions',
  ],
  openGraph: {
    title: 'techhub.cafe — Ace Your Tech Interview',
    description:
      'Curated technical interview questions with full answers across Full-Stack, JavaScript, TypeScript, React, Node.js, DSA, System Design and ML.',
    url: 'https://techhub.cafe',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'techhub.cafe — Ace Your Tech Interview',
    description:
      'Curated technical interview questions with full answers across Full-Stack, JavaScript, TypeScript, React, Node.js, DSA, System Design and ML.',
  },
  alternates: { canonical: 'https://techhub.cafe' },
};

async function getTotalQuestionsCount(): Promise<number | null> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return null;

  const { count, error } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.error('Failed to load total questions count on home page:', error);
    return null;
  }

  return typeof count === 'number' ? count : null;
}

export default async function HomePage() {
  const totalQuestions = await getTotalQuestionsCount();
  const questionsLabel =
    totalQuestions !== null
      ? `${totalQuestions.toLocaleString()} interview questions`
      : 'interview questions';

  return (
    <main className="relative min-h-screen">
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16">
        {/* Hero */}
        <section className="text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-[rgb(var(--muted))]">
            techhub.cafe
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-[rgb(var(--text))] sm:text-5xl">
            Kill Your Tech Interview
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-lg text-[rgb(var(--text))]">
            Curated <span className="rounded-md bg-[rgb(var(--accent))]/20 px-1.5 py-0.5 font-semibold text-[rgb(var(--accent))]">{questionsLabel}</span> across
            Full-Stack, JavaScript, TypeScript, React & Node.js — with full answers to help you land your next role.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/interview-questions"
              className="rounded-lg bg-[rgb(var(--accent))] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
            >
              Browse interview questions
            </Link>
            <ShowWhenLoggedIn>
              <Link
                href="/account"
                className="rounded-lg border border-[rgb(var(--border))] px-6 py-3 text-sm font-semibold text-[rgb(var(--text))] transition hover:border-[rgb(var(--accent))]"
              >
                Open your profile
              </Link>
            </ShowWhenLoggedIn>
            <ShowWhenLoggedOut>
              <Link
                href="/login"
                className="rounded-lg border border-[rgb(var(--border))] px-6 py-3 text-sm font-semibold text-[rgb(var(--text))] transition hover:border-[rgb(var(--accent))]"
              >
                Sign in to unlock answers
              </Link>
            </ShowWhenLoggedOut>
          </div>
        </section>

        {/* Promo banner - ML/DS + Also explore */}
        <section className="mt-12 rounded-xl border border-dashed border-[rgb(var(--accent))]/40 bg-[rgb(var(--accent))]/5 px-4 py-4">
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm leading-relaxed text-[rgb(var(--text))]">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent))]/15 text-base" aria-hidden>🤖</span>
            <span className="font-medium">Having Machine Learning & DS Interview?</span>
            <span>Check</span>
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent))]/15 text-base" aria-hidden>☕</span>
            <Link
              href="/interview-questions/ml"
              className="font-bold text-[rgb(var(--accent))] underline-offset-2 hover:underline"
            >
              techhub.cafe
            </Link>
            <span className="text-[rgb(var(--muted))]">— 1704+ Data Science & ML Interview Questions & Answers!</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-[rgb(var(--border))]/60 pt-3 text-xs text-[rgb(var(--muted))]">
            <span className="font-medium text-[rgb(var(--text))]">Also explore:</span>
            <Link href="/interview-questions/fullstack" className="hover:text-[rgb(var(--accent))] hover:underline">
              Full-Stack & Web
            </Link>
            <span aria-hidden>·</span>
            <Link href="/interview-questions/dsa" className="hover:text-[rgb(var(--accent))] hover:underline">
              Algorithms
            </Link>
            <span aria-hidden>·</span>
            <Link href="/interview-questions/system-design" className="hover:text-[rgb(var(--accent))] hover:underline">
              System Design
            </Link>
            <span className="ml-1 hidden sm:inline">— curated answers, one place.</span>
          </div>
        </section>

        {/* Interview tracks */}
        <section className="mt-20">
          <h2 className="text-center text-xl font-bold text-[rgb(var(--text))] sm:text-2xl">
            Choose your interview track
          </h2>
          <p className="mt-2 text-center text-sm text-[rgb(var(--muted))]">
            Follow a focused path based on your target role and company loop.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: 'Full-Stack',
                subtitle: 'Frontend + backend practical rounds',
                href: '/interview-questions/fullstack',
                badge: 'Most popular',
              },
              {
                title: 'Algorithms',
                subtitle: 'DSA patterns and whiteboard depth',
                href: '/interview-questions/dsa',
                badge: 'Coding rounds',
              },
              {
                title: 'System Design',
                subtitle: 'Scalability and architecture interviews',
                href: '/interview-questions/system-design',
                badge: 'Senior tracks',
              },
              {
                title: 'ML & Data Science',
                subtitle: 'Modeling, pipelines, and case rounds',
                href: '/interview-questions/ml',
                badge: 'Specialist roles',
              },
            ].map((track) => (
              <Link
                key={track.href}
                href={track.href}
                className="group rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-5 transition hover:border-[rgb(var(--accent))]/60 hover:shadow-sm"
              >
                <p className="inline-flex rounded-full bg-[rgb(var(--accent))]/15 px-2 py-1 text-xs font-semibold text-[rgb(var(--accent))]">
                  {track.badge}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-[rgb(var(--text))]">{track.title}</h3>
                <p className="mt-1 text-sm text-[rgb(var(--muted))]">{track.subtitle}</p>
                <p className="mt-4 text-sm font-semibold text-[rgb(var(--accent))] group-hover:underline">
                  Explore track
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* What is techhub.cafe */}
        <section className="mt-20">
          <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8 sm:p-10">
            <h2 className="text-xl font-bold text-[rgb(var(--text))] sm:text-2xl">
              What is techhub.cafe?
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[rgb(var(--muted))] sm:text-base">
              techhub.cafe is a developer-focused platform for technical interview preparation. We collect and curate real interview questions from popular topics and companies, with clear short answers, deep explanations, real-world examples, and common pitfalls — so you can prepare efficiently and walk in confident.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-[rgb(var(--muted))] sm:text-base">
              Questions are organized by topic (e.g. React, JavaScript, TypeScript, Node.js), difficulty (junior, mid, senior), and company. You can browse free previews or unlock full access to all answers and export options.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: 'Built for candidates',
                  description: 'Freshers to senior engineers preparing for product and service companies.',
                  icon: '🎯',
                },
                {
                  title: 'Interview-format answers',
                  description: 'Short answer first, then deep explanation and practical follow-through.',
                  icon: '🧩',
                },
                {
                  title: 'Role + difficulty mapped',
                  description: 'Choose junior, mid, or senior tracks and practice at the right level.',
                  icon: '📈',
                },
                {
                  title: 'Actionable prep workflow',
                  description: 'Bookmark, complete, and revisit questions based on your weak areas.',
                  icon: '✅',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4"
                >
                  <span className="text-lg" aria-hidden>{item.icon}</span>
                  <p className="mt-2 text-sm font-semibold text-[rgb(var(--text))]">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[rgb(var(--muted))]">{item.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-dashed border-[rgb(var(--accent))]/40 bg-[rgb(var(--accent))]/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgb(var(--accent))]">
                How to use techhub.cafe
              </p>
              <div className="mt-3 grid gap-3 text-sm text-[rgb(var(--text))] sm:grid-cols-3">
                <p>
                  <span className="font-semibold text-[rgb(var(--accent))]">1.</span> Pick your track
                  (Full-Stack, DSA, System Design, ML).
                </p>
                <p>
                  <span className="font-semibold text-[rgb(var(--accent))]">2.</span> Practice by topic +
                  difficulty and review full answer breakdowns.
                </p>
                <p>
                  <span className="font-semibold text-[rgb(var(--accent))]">3.</span> Track completed and
                  bookmarked questions from your account overview.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mt-16">
          <h2 className="text-center text-xl font-bold text-[rgb(var(--text))] sm:text-2xl">
            What you get
          </h2>
          <p className="mt-2 text-center text-sm text-[rgb(var(--muted))]">
            Everything you need to prepare for technical interviews
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Curated by topic',
                description: 'React, JavaScript, TypeScript, Node.js and more. Find questions for the stack you use.',
                icon: '📚',
              },
              {
                title: 'Difficulty levels',
                description: 'Junior, mid, and senior questions so you can match your target level.',
                icon: '📊',
              },
              {
                title: 'Company tags',
                description: 'See which companies ask what — filter by company when preparing.',
                icon: '🏢',
              },
              {
                title: 'Full answers',
                description: 'Short answers, deep explanations, real-world examples and common mistakes.',
                icon: '✨',
              },
              {
                title: 'Filter & search',
                description: 'Filter by topic, difficulty, company and search by question title.',
                icon: '🔍',
              },
              {
                title: 'Unlock & export',
                description: 'Unlock complete answers and keep your prep structured for fast revision.',
                icon: '🔓',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6 transition hover:border-[rgb(var(--accent))]/50"
              >
                <span className="text-2xl" aria-hidden>{item.icon}</span>
                <h3 className="mt-3 text-lg font-semibold text-[rgb(var(--text))]">{item.title}</h3>
                <p className="mt-2 text-sm text-[rgb(var(--muted))]">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Outcome focused */}
        <section className="mt-20">
          <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8 sm:p-10">
            <h2 className="text-xl font-bold text-[rgb(var(--text))] sm:text-2xl">
              Why candidates stick with techhub.cafe
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Interview-ready explanations', value: 'Short + deep answers' },
                { label: 'Role-focused preparation', value: 'Junior to senior tracks' },
                { label: 'High-signal practice', value: 'Real-world style questions' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
                  <p className="text-sm font-semibold text-[rgb(var(--text))]">{item.value}</p>
                  <p className="mt-1 text-xs text-[rgb(var(--muted))]">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                Popular jump links
              </p>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: 'React interview prep', href: '/interview-questions/fullstack/react' },
                  { label: 'HTML5 & frontend prep', href: '/interview-questions/fullstack/html5' },
                  { label: 'Full-Stack roadmap', href: '/interview-questions/fullstack' },
                  { label: 'DSA problem patterns', href: '/interview-questions/dsa' },
                  { label: 'System design prep', href: '/interview-questions/system-design' },
                  { label: 'ML & Data Science prep', href: '/interview-questions/ml' },
                  { label: 'Browse all categories', href: '/interview-questions' },
                  { label: 'Free preview questions', href: '/interview-questions#questions' },
                  { label: 'Top React + JS rounds', href: '/interview-questions/fullstack' },
                  { label: 'Interview cheat-sheet flow', href: '/interview-questions/dsa' },
                  { label: 'Success path for freshers', href: '/interview-questions/fullstack' },
                  { label: 'Senior interview path', href: '/interview-questions/system-design' },
                  { label: 'Recruiter mode', href: '/interview-questions?hiring=true' },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="rounded-full border border-[rgb(var(--border))] px-4 py-2 text-xs font-semibold text-[rgb(var(--text))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]"
                  >
                    {item.label}
                  </Link>
                ))}
                <ShowWhenNotPaid>
                  <Link
                    href="/pricing"
                    className="rounded-full border border-[rgb(var(--accent))]/50 bg-[rgb(var(--accent))]/10 px-4 py-2 text-xs font-semibold text-[rgb(var(--accent))] transition hover:border-[rgb(var(--accent))]"
                  >
                    Compare pricing plans
                  </Link>
                </ShowWhenNotPaid>
                <ShowWhenLoggedIn>
                  <Link
                    href="/account/subscription"
                    className="rounded-full border border-[rgb(var(--accent))]/50 bg-[rgb(var(--accent))]/10 px-4 py-2 text-xs font-semibold text-[rgb(var(--accent))] transition hover:border-[rgb(var(--accent))]"
                  >
                    Manage your subscription
                  </Link>
                </ShowWhenLoggedIn>
                <ShowWhenLoggedOut>
                  <Link
                    href="/signup"
                    className="rounded-full border border-[rgb(var(--accent))]/50 bg-[rgb(var(--accent))]/10 px-4 py-2 text-xs font-semibold text-[rgb(var(--accent))] transition hover:border-[rgb(var(--accent))]"
                  >
                    Create free account
                  </Link>
                </ShowWhenLoggedOut>
              </div>
            </div>
          </div>
        </section>

        {/* Topics teaser */}
        <section className="mt-20">
          <h2 className="text-center text-xl font-bold text-[rgb(var(--text))] sm:text-2xl">
            Browse by topic
          </h2>
          <p className="mt-2 text-center text-sm text-[rgb(var(--muted))]">
            Jump straight to the tech you&apos;re prepping for
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {[
              { name: 'React', icon: '⚛️', href: '/interview-questions/fullstack/react' },
              { name: 'JavaScript', icon: '📜', href: '/interview-questions/fullstack/javascript' },
              { name: 'TypeScript', icon: '🟦', href: '/interview-questions/fullstack/typescript' },
              { name: 'Node.js', icon: '⬢', href: '/interview-questions/fullstack/node-js' },
              { name: 'System Design', icon: '🏗️', href: '/interview-questions/system-design' },
              { name: 'Algorithms', icon: '🧠', href: '/interview-questions/dsa' },
              { name: 'SQL', icon: '🗄️', href: '/interview-questions/fullstack/sql' },
              { name: 'Python', icon: '🐍', href: '/interview-questions/fullstack/python' },
              { name: 'Java', icon: '☕', href: '/interview-questions/fullstack/java' },
              { name: 'ML & Data Science', icon: '🤖', href: '/interview-questions/ml' },
            ].map((topic) => (
              <Link
                key={topic.href}
                href={topic.href}
                className="group inline-flex items-center gap-2 rounded-full border-2 border-[rgb(var(--accent))]/60 bg-[rgb(var(--bg))] px-5 py-2.5 text-sm font-medium text-[rgb(var(--text))] transition hover:-translate-y-0.5 hover:border-[rgb(var(--accent))] hover:bg-[rgb(var(--card))]"
              >
                <span className="text-base" aria-hidden>{topic.icon}</span>
                <span>{topic.name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-20 rounded-3xl border-2 border-[rgb(var(--accent))]/30 bg-[rgb(var(--accent))]/10 p-8 sm:p-10">
          <div className="flex flex-col items-center gap-6 text-center lg:flex-row lg:justify-between lg:text-left">
            <div>
              <h2 className="text-xl font-bold text-[rgb(var(--text))] sm:text-2xl">
                Ready to prepare?
              </h2>
              <p className="mt-2 text-sm text-[rgb(var(--muted))]">
                Browse hundreds of interview questions with full answers and prepare faster.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 shrink-0">
              <Link
                href="/interview-questions"
                className="rounded-lg bg-[rgb(var(--accent))] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                See all questions
              </Link>
              <ShowWhenLoggedIn>
                <Link
                  href="/account/subscription"
                  className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-6 py-3 text-sm font-semibold text-[rgb(var(--text))] transition hover:border-[rgb(var(--accent))]"
                >
                  Manage subscription
                </Link>
              </ShowWhenLoggedIn>
              <ShowWhenLoggedOut>
                <Link
                  href="/login"
                  className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-6 py-3 text-sm font-semibold text-[rgb(var(--text))] transition hover:border-[rgb(var(--accent))]"
                >
                  Sign in
                </Link>
              </ShowWhenLoggedOut>
            </div>
          </div>
        </section>

        {/* Footer links */}
        <section className="mt-16 border-t border-[rgb(var(--border))] pt-10">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            Quick links
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link
              href="/interview-questions"
              className="group inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-4 py-2 text-[rgb(var(--accent))] transition hover:-translate-y-0.5 hover:border-[rgb(var(--accent))]/50 hover:bg-[rgb(var(--accent))]/10"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--accent))]/15">📚</span>
              <span className="font-medium">Interview questions</span>
            </Link>
            <Link
              href="/interview-questions/fullstack"
              className="group inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-4 py-2 text-[rgb(var(--accent))] transition hover:-translate-y-0.5 hover:border-[rgb(var(--accent))]/50 hover:bg-[rgb(var(--accent))]/10"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--accent))]/15">💻</span>
              <span className="font-medium">Full-Stack</span>
            </Link>
            <Link
              href="/interview-questions/dsa"
              className="group inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-4 py-2 text-[rgb(var(--accent))] transition hover:-translate-y-0.5 hover:border-[rgb(var(--accent))]/50 hover:bg-[rgb(var(--accent))]/10"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--accent))]/15">🧠</span>
              <span className="font-medium">Algorithms</span>
            </Link>
            <Link
              href="/interview-questions/system-design"
              className="group inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-4 py-2 text-[rgb(var(--accent))] transition hover:-translate-y-0.5 hover:border-[rgb(var(--accent))]/50 hover:bg-[rgb(var(--accent))]/10"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--accent))]/15">🏗️</span>
              <span className="font-medium">System Design</span>
            </Link>
            <Link
              href="/interview-questions/ml"
              className="group inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-4 py-2 text-[rgb(var(--accent))] transition hover:-translate-y-0.5 hover:border-[rgb(var(--accent))]/50 hover:bg-[rgb(var(--accent))]/10"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--accent))]/15">🤖</span>
              <span className="font-medium">ML & Data Science</span>
            </Link>
            <ShowWhenLoggedIn>
              <Link
                href="/account/settings"
                className="group inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-4 py-2 text-[rgb(var(--accent))] transition hover:-translate-y-0.5 hover:border-[rgb(var(--accent))]/50 hover:bg-[rgb(var(--accent))]/10"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--accent))]/15">⚙️</span>
                <span className="font-medium">Account settings</span>
              </Link>
            </ShowWhenLoggedIn>
            <ShowWhenLoggedIn>
              <Link
                href="/account/subscription"
                className="group inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-4 py-2 text-[rgb(var(--accent))] transition hover:-translate-y-0.5 hover:border-[rgb(var(--accent))]/50 hover:bg-[rgb(var(--accent))]/10"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--accent))]/15">💳</span>
                <span className="font-medium">Subscription</span>
              </Link>
            </ShowWhenLoggedIn>
            <ShowWhenLoggedOut>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-4 py-2 text-[rgb(var(--accent))] transition hover:-translate-y-0.5 hover:border-[rgb(var(--accent))]/50 hover:bg-[rgb(var(--accent))]/10"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--accent))]/15">🔓</span>
                <span className="font-medium">Sign in</span>
              </Link>
            </ShowWhenLoggedOut>
            <ShowWhenLoggedOut>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-4 py-2 text-[rgb(var(--accent))] transition hover:-translate-y-0.5 hover:border-[rgb(var(--accent))]/50 hover:bg-[rgb(var(--accent))]/10"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--accent))]/15">✨</span>
                <span className="font-medium">Create account</span>
              </Link>
            </ShowWhenLoggedOut>
          </div>
        </section>
      </div>
    </main>
  );
}
