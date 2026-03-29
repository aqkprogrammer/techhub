import Link from 'next/link';
import { notFound } from 'next/navigation';

import RichContent from '@/components/rich-content';
import { mapAnswerRowToApi } from '@/lib/questions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const difficultyStyleMap: Record<string, string> = {
  junior: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  easy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  mid: 'bg-amber-50 text-amber-700 border-amber-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  senior: 'bg-rose-50 text-rose-700 border-rose-200',
  hard: 'bg-rose-50 text-rose-700 border-rose-200',
};

type QuestionViewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuestionViewPage({ params }: QuestionViewPageProps) {
  const { id } = await params;

  const supabase = createSupabaseServerClient();

  const [{ data: question, error: questionError }, { data: answers, error: answerError }] = await Promise.all([
    supabase
      .from('questions')
      .select('*')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('answers').select('*').eq('question_id', id).order('created_at', { ascending: false }).limit(1),
  ]);

  if (questionError || !question) {
    notFound();
  }

  if (answerError) {
    throw new Error(answerError.message || 'Failed to load answer data.');
  }

  const { data: topic } = await supabase
    .from('topics')
    .select('*')
    .eq('id', question.topic_id)
    .maybeSingle();

  const topicName =
    (typeof topic?.name === 'string' && topic.name.trim()) ||
    (typeof topic?.title === 'string' && topic.title.trim()) ||
    question.topic_id;

  const answerRow = answers?.[0] ?? null;
  const answer = answerRow ? mapAnswerRowToApi(answerRow as Record<string, unknown>) : null;

  const difficulty = String(question.difficulty ?? 'mid').toLowerCase();
  const difficultyClass = difficultyStyleMap[difficulty] ?? 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/admin/questions" className="hover:text-slate-800">
              Questions
            </Link>
            <span>/</span>
            <span className="text-slate-700">View</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">{question.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">Slug: {question.slug ?? 'no-slug'}</span>
            <span className={`rounded-md border px-2 py-1 capitalize ${difficultyClass}`}>{difficulty}</span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">Topic: {topicName}</span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
              {Boolean(question.free_preview ?? question.is_free_preview) ? 'Free preview' : 'Premium'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/questions/${id}/edit`}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Edit
          </Link>
          <Link
            href="/admin/questions"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Back to list
          </Link>
        </div>
      </div>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Short answer</h2>
        {answer?.shortAnswer ? (
          <RichContent content={answer.shortAnswer} className="text-sm" />
        ) : (
          <p className="text-sm text-slate-500">No short answer added yet.</p>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Deep explanation</h2>
        {answer?.deepExplanation ? (
          <RichContent content={answer.deepExplanation} className="text-sm" />
        ) : (
          <p className="text-sm text-slate-500">No deep explanation added yet.</p>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Real-world example</h2>
        {answer?.realWorldExample ? (
          <RichContent content={answer.realWorldExample} className="text-sm" />
        ) : (
          <p className="text-sm text-slate-500">No real-world example added yet.</p>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Common mistakes</h2>
        {answer?.commonMistakesText ? (
          <RichContent content={answer.commonMistakesText} className="text-sm" />
        ) : (
          <p className="text-sm text-slate-500">No common mistakes added yet.</p>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Follow-ups</h2>
        {answer?.followUps.length ? (
          <div className="space-y-3">
            {answer.followUps.map((followUp, index) => (
              <div key={`${index}-${followUp.question}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{followUp.question || 'Follow-up question'}</p>
                {followUp.answer ? (
                  <div className="mt-2">
                    <RichContent content={followUp.answer} className="text-sm" />
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No follow-up answer provided.</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No follow-up entries.</p>
        )}
      </section>
    </div>
  );
}
