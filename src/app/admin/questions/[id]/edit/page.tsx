import Link from 'next/link';
import { notFound } from 'next/navigation';

import { mapAnswerRowToApi, parseFollowUps } from '@/lib/questions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import AddQuestionForm, { type QuestionEditorInitialData } from '../../new/AddQuestionForm';

type EditQuestionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditQuestionPage({ params }: EditQuestionPageProps) {
  const { id } = await params;

  const supabase = createSupabaseServerClient();

  const [{ data: question, error: questionError }, { data: answers, error: answerError }] = await Promise.all([
    supabase.from('questions').select('*').eq('id', id).maybeSingle(),
    supabase.from('answers').select('*').eq('question_id', id).order('created_at', { ascending: false }).limit(1),
  ]);

  if (questionError || !question) {
    notFound();
  }

  if (answerError) {
    throw new Error(answerError.message || 'Failed to load answer data.');
  }

  const latestAnswer = answers?.[0] ?? null;
  const mappedAnswer = latestAnswer ? mapAnswerRowToApi(latestAnswer as Record<string, unknown>) : null;

  const initialData: QuestionEditorInitialData = {
    question: {
      id: String(question.id),
      title: String(question.title ?? ''),
      slug: typeof question.slug === 'string' ? question.slug : '',
      difficulty: (question.difficulty ?? 'mid') as QuestionEditorInitialData['question']['difficulty'],
      topicId: String(question.topic_id ?? ''),
      freePreview: Boolean(question.free_preview ?? question.is_free_preview ?? false),
    },
    answer: mappedAnswer
      ? {
          shortAnswer: mappedAnswer.shortAnswer ?? '',
          deepExplanation: mappedAnswer.deepExplanation ?? '',
          realWorldExample: mappedAnswer.realWorldExample ?? '',
          commonMistakes: mappedAnswer.commonMistakesText ?? '',
          followUps: parseFollowUps(mappedAnswer.followUps),
        }
      : {
          shortAnswer: '',
          deepExplanation: '',
          realWorldExample: '',
          commonMistakes: '',
          followUps: [],
        },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/admin/questions" className="hover:text-slate-800">
          Questions
        </Link>
        <span>/</span>
        <Link href={`/admin/questions/${id}`} className="hover:text-slate-800">
          View
        </Link>
        <span>/</span>
        <span className="text-slate-700">Edit</span>
      </div>
      <AddQuestionForm mode="edit" questionId={id} initialData={initialData} />
    </div>
  );
}

