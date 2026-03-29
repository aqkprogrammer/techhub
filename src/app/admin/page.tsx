import {
  BookOpenText,
  CircleDollarSign,
  FileQuestion,
  Users,
} from 'lucide-react';

import { createSupabaseServerClient } from '@/lib/supabase/server';

const cards = [
  { key: 'users', label: 'Total Users', icon: Users },
  { key: 'questions', label: 'Total Questions', icon: FileQuestion },
  { key: 'paidQuestions', label: 'Paid Questions', icon: CircleDollarSign },
  { key: 'topics', label: 'Total Topics', icon: BookOpenText },
] as const;

export default async function AdminPage() {
  const supabase = createSupabaseServerClient();
  const [usersResult, questionsResult, paidQuestionsResult, topicsResult] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('questions').select('id', { count: 'exact', head: true }),
    supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('free_preview', false),
    supabase.from('topics').select('id', { count: 'exact', head: true }),
  ]);

  const stats = {
    users: usersResult.count ?? 0,
    questions: questionsResult.count ?? 0,
    paidQuestions: paidQuestionsResult.count ?? 0,
    topics: topicsResult.count ?? 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Snapshot of platform activity and content inventory.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.key}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-slate-600">{card.label}</p>
                <span className="rounded-md bg-slate-100 p-2 text-slate-600">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">
                {stats[card.key].toLocaleString()}
              </p>
            </article>
          );
        })}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Quick Summary</h2>
        <p className="mt-2 text-sm text-slate-600">
          Use the sidebar to manage questions, topics, users, and security settings.
          All actions are role-protected and executed server-side.
        </p>
      </section>
    </div>
  );
}
