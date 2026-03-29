import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { setAuthCookies } from '../../auth/_shared';
import { requireAuthenticatedUser } from '../../account/_auth';

export const runtime = 'nodejs';

const bodySchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1).max(1000),
});

const ACTIVE_ACCESS_STATUSES = new Set(['active', 'trialing']);

type AnswerRow = Record<string, unknown>;

type QuestionRow = {
  id: string;
  title: string;
  difficulty: 'junior' | 'mid' | 'senior';
  free_preview: boolean | null;
  topic_id: string;
  created_at: string | null;
  topic:
    | { id: string; name: string | null }
    | { id: string; name: string | null }[]
    | null;
  answers?: AnswerRow[] | null;
};

type ExportQuestion = {
  id: string;
  title: string;
  difficulty: 'junior' | 'mid' | 'senior';
  topicName: string;
  freePreview: boolean;
  shortAnswer: string | null;
  deepExplanation: string | null;
  realWorldExample: string | null;
  commonMistakes: string[];
  followUps: string[];
};

type DrawPageState = {
  commands: string[];
  cursorY: number;
};

type TopicRow = {
  id: string;
  name: string | null;
};

function normalizeSubscriptionStatus(value: unknown): string {
  if (typeof value !== 'string') return 'inactive';
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'inactive';
  return normalized;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 44;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const BODY_FONT = 11;
const LINE_HEIGHT = 16;

function normalizePlainText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1 ($2)')
    .replace(/\u2011|\u2012|\u2013|\u2014/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .trim();
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function textWidthApprox(value: string, fontSize: number): number {
  return value.length * (fontSize * 0.52);
}

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const source = normalizePlainText(text);
  if (!source) return [];

  const lines: string[] = [];
  const paragraphs = source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/);
    let line = '';

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidthApprox(candidate, fontSize) <= maxWidth) {
        line = candidate;
        continue;
      }

      if (line) lines.push(line);
      line = word;
    }

    if (line) lines.push(line);
  }

  return lines;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') return normalizePlainText(entry);
        if (!entry || typeof entry !== 'object') return '';

        const row = entry as Record<string, unknown>;
        const question = typeof row.question === 'string' ? normalizePlainText(row.question) : '';
        const answer = typeof row.answer === 'string' ? normalizePlainText(row.answer) : '';
        if (!question && !answer) return '';
        if (!answer) return question;
        if (!question) return answer;
        return `${question} - ${answer}`;
      })
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        return toStringArray(JSON.parse(trimmed));
      } catch {
        // Fall through to line splitting below.
      }
    }

    return value
      .split(/\n|;/)
      .map((entry) => normalizePlainText(entry))
      .filter((entry) => entry.length > 0);
  }

  return [];
}

function pickLatestAnswer(rows: AnswerRow[] | null | undefined): AnswerRow | null {
  if (!rows || rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => {
    const aDate = typeof a.created_at === 'string' ? Date.parse(a.created_at) : 0;
    const bDate = typeof b.created_at === 'string' ? Date.parse(b.created_at) : 0;
    return bDate - aDate;
  });
  return sorted[0] ?? null;
}

function mapExportQuestion(row: QuestionRow): ExportQuestion {
  const answer = pickLatestAnswer(row.answers);
  const topic =
    row.topic && Array.isArray(row.topic) ? (row.topic[0] ?? null) : row.topic;
  const shortAnswer =
    (answer?.short_answer as string | undefined) ??
    (answer?.shortAnswer as string | undefined) ??
    (answer?.content as string | undefined) ??
    null;
  const deepExplanation =
    (answer?.deep_explanation as string | undefined) ??
    (answer?.deepExplanation as string | undefined) ??
    null;
  const realWorldExample =
    (answer?.real_world_example as string | undefined) ??
    (answer?.realWorldExample as string | undefined) ??
    null;
  const commonMistakes = toStringArray(
    answer?.common_mistakes ?? answer?.commonMistakes ?? []
  );
  const followUps = toStringArray(
    answer?.follow_ups ?? answer?.follow_up_questions ?? answer?.followUps ?? []
  );

  return {
    id: row.id,
    title: normalizePlainText(row.title),
    difficulty: row.difficulty,
    topicName: normalizePlainText(topic?.name ?? 'Unknown'),
    freePreview: Boolean(row.free_preview),
    shortAnswer: shortAnswer ? normalizePlainText(shortAnswer) : null,
    deepExplanation: deepExplanation ? normalizePlainText(deepExplanation) : null,
    realWorldExample: realWorldExample ? normalizePlainText(realWorldExample) : null,
    commonMistakes,
    followUps,
  };
}

function newPage(): DrawPageState {
  return {
    commands: [],
    cursorY: PAGE_HEIGHT - MARGIN_TOP,
  };
}

function addCommand(page: DrawPageState, command: string) {
  page.commands.push(command);
}

function drawRect(
  page: DrawPageState,
  x: number,
  y: number,
  width: number,
  height: number,
  color: [number, number, number]
) {
  addCommand(
    page,
    `${color[0]} ${color[1]} ${color[2]} rg ${x} ${y} ${width} ${height} re f`
  );
}

function drawText(
  page: DrawPageState,
  text: string,
  options: {
    x: number;
    y: number;
    size: number;
    font: 'F1' | 'F2';
    color?: [number, number, number];
  }
) {
  const sanitized = escapePdfText(normalizePlainText(text));
  const color = options.color ?? [0.11, 0.14, 0.2];
  addCommand(
    page,
    `BT /${options.font} ${options.size} Tf ${color[0]} ${color[1]} ${color[2]} rg 1 0 0 1 ${options.x} ${options.y} Tm (${sanitized}) Tj ET`
  );
}

function ensureSpace(pages: DrawPageState[], neededHeight: number): DrawPageState {
  let page = pages[pages.length - 1];
  if (page.cursorY - neededHeight < MARGIN_BOTTOM) {
    pages.push(newPage());
    page = pages[pages.length - 1];
  }
  return page;
}

function drawWrappedParagraph(
  pages: DrawPageState[],
  text: string,
  options: {
    size?: number;
    font?: 'F1' | 'F2';
    color?: [number, number, number];
    leading?: number;
    indent?: number;
  } = {}
) {
  const fontSize = options.size ?? BODY_FONT;
  const leading = options.leading ?? LINE_HEIGHT;
  const indent = options.indent ?? 0;
  const lines = wrapText(text, CONTENT_WIDTH - indent, fontSize);

  if (lines.length === 0) return;

  for (const line of lines) {
    const page = ensureSpace(pages, leading + 4);
    drawText(page, line, {
      x: MARGIN_X + indent,
      y: page.cursorY,
      size: fontSize,
      font: options.font ?? 'F1',
      color: options.color,
    });
    page.cursorY -= leading;
  }
}

function drawSectionHeading(pages: DrawPageState[], title: string) {
  const page = ensureSpace(pages, 26);
  drawText(page, title, {
    x: MARGIN_X,
    y: page.cursorY,
    size: 11,
    font: 'F2',
    color: [0.3, 0.35, 0.78],
  });
  page.cursorY -= 18;
}

function drawDivider(pages: DrawPageState[]) {
  const page = ensureSpace(pages, 20);
  const startY = page.cursorY;
  const endX = MARGIN_X + CONTENT_WIDTH;
  addCommand(page, `0.87 0.89 0.95 RG ${MARGIN_X} ${startY} m ${endX} ${startY} l S`);
  page.cursorY -= 14;
}

function buildQuestionsPdf(questions: ExportQuestion[], generatedFor: string): Uint8Array {
  const pages: DrawPageState[] = [newPage()];
  const nowLabel = new Date().toLocaleString();

  {
    const page = pages[0];
    drawRect(page, MARGIN_X, PAGE_HEIGHT - 94, CONTENT_WIDTH, 46, [0.92, 0.94, 1]);
    drawText(page, 'techhub.cafe - Interview Questions PDF', {
      x: MARGIN_X + 12,
      y: PAGE_HEIGHT - 72,
      size: 16,
      font: 'F2',
      color: [0.13, 0.16, 0.27],
    });
    drawText(page, `Generated for: ${generatedFor}`, {
      x: MARGIN_X + 12,
      y: PAGE_HEIGHT - 88,
      size: 10,
      font: 'F1',
      color: [0.32, 0.36, 0.47],
    });
    drawText(page, `Generated at: ${nowLabel}`, {
      x: MARGIN_X + 250,
      y: PAGE_HEIGHT - 88,
      size: 10,
      font: 'F1',
      color: [0.32, 0.36, 0.47],
    });
    page.cursorY = PAGE_HEIGHT - 118;
  }

  questions.forEach((question, index) => {
    const headerPage = ensureSpace(pages, 56);
    drawText(headerPage, `Q${index + 1}. ${question.title}`, {
      x: MARGIN_X,
      y: headerPage.cursorY,
      size: 13,
      font: 'F2',
      color: [0.11, 0.14, 0.2],
    });
    headerPage.cursorY -= 18;

    drawText(headerPage, `Topic: ${question.topicName}   |   Difficulty: ${question.difficulty}`, {
      x: MARGIN_X,
      y: headerPage.cursorY,
      size: 10,
      font: 'F1',
      color: [0.35, 0.39, 0.5],
    });
    headerPage.cursorY -= 16;
    if (!question.freePreview) {
      drawText(headerPage, 'Premium question', {
        x: MARGIN_X,
        y: headerPage.cursorY,
        size: 9,
        font: 'F2',
        color: [0.57, 0.45, 0.08],
      });
      headerPage.cursorY -= 14;
    }

    if (question.shortAnswer) {
      drawSectionHeading(pages, 'Short Answer');
      drawWrappedParagraph(pages, question.shortAnswer);
    }

    if (question.deepExplanation) {
      drawSectionHeading(pages, 'Deep Explanation');
      drawWrappedParagraph(pages, question.deepExplanation);
    }

    if (question.realWorldExample) {
      drawSectionHeading(pages, 'Real-World Example');
      drawWrappedParagraph(pages, question.realWorldExample);
    }

    if (question.commonMistakes.length > 0) {
      drawSectionHeading(pages, 'Common Mistakes');
      question.commonMistakes.forEach((item) => {
        drawWrappedParagraph(pages, `- ${item}`, { indent: 8 });
      });
    }

    if (question.followUps.length > 0) {
      drawSectionHeading(pages, 'Follow-up Questions');
      question.followUps.forEach((item) => {
        drawWrappedParagraph(pages, `- ${item}`, { indent: 8 });
      });
    }

    if (
      !question.shortAnswer &&
      !question.deepExplanation &&
      !question.realWorldExample &&
      question.commonMistakes.length === 0 &&
      question.followUps.length === 0
    ) {
      drawSectionHeading(pages, 'Answer');
      drawWrappedParagraph(
        pages,
        'No answer content is available for this question in the database yet.'
      );
    }

    drawDivider(pages);
  });

  pages.forEach((page, idx) => {
    drawText(page, `Page ${idx + 1} of ${pages.length}`, {
      x: PAGE_WIDTH - MARGIN_X - 90,
      y: 24,
      size: 9,
      font: 'F1',
      color: [0.48, 0.5, 0.6],
    });
  });

  const objects: string[] = [''];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  let nextObjectId = 5;

  for (let i = 0; i < pages.length; i += 1) {
    pageObjectIds.push(nextObjectId);
    nextObjectId += 1;
    contentObjectIds.push(nextObjectId);
    nextObjectId += 1;
  }

  pageObjectIds.forEach((pageObjectId, index) => {
    const contentObjectId = contentObjectIds[index];
    const streamBody = pages[index].commands.join('\n');
    const streamLength = Buffer.byteLength(streamBody, 'utf8');

    objects[contentObjectId] = `<< /Length ${streamLength} >>\nstream\n${streamBody}\nendstream`;
    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
  });

  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds
    .map((id) => `${id} 0 R`)
    .join(' ')}] /Count ${pageObjectIds.length} >>`;

  let pdf = '%PDF-1.4\n%\xFF\xFF\xFF\xFF\n';
  const offsets: number[] = [0];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, 'utf8');
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += '0000000000 65535 f \n';
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${offsets[id].toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid payload.' },
      { status: 400 }
    );
  }

  const uniqueQuestionIds = Array.from(new Set(parsed.data.questionIds));
  const supabase = createSupabaseServerClient();

  const { data: subscriptionRows, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select('plan,status')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (subscriptionError) {
    const isMissingTable =
      subscriptionError.code === 'PGRST205' ||
      subscriptionError.code === '42P01' ||
      /relation .*subscriptions.* does not exist/i.test(subscriptionError.message);
    if (!isMissingTable) {
      return NextResponse.json(
        { error: 'Failed to validate subscription access.' },
        { status: 500 }
      );
    }
  }

  const latestSubscription =
    Array.isArray(subscriptionRows) && subscriptionRows.length > 0
      ? subscriptionRows[0]
      : null;
  const subscriptionStatus = normalizeSubscriptionStatus(latestSubscription?.status);
  const plan =
    typeof latestSubscription?.plan === 'string'
      ? latestSubscription.plan.trim().toLowerCase()
      : '';
  const hasPaidAccess =
    ACTIVE_ACCESS_STATUSES.has(subscriptionStatus) &&
    Boolean(plan) &&
    plan !== 'free';

  const { data: questionData, error: questionError } = await supabase
    .from('questions')
    .select('id, title, difficulty, free_preview, topic_id, created_at')
    .in('id', uniqueQuestionIds);

  if (questionError) {
    console.error('Failed to load questions for PDF export:', questionError);
    return NextResponse.json(
      {
        error: 'Failed to load questions for PDF export.',
        details: questionError.message,
      },
      { status: 500 }
    );
  }

  const baseRows = (questionData ?? []) as Omit<QuestionRow, 'topic' | 'answers'>[];
  const topicIds = Array.from(new Set(baseRows.map((row) => row.topic_id).filter(Boolean)));
  const topicById = new Map<string, TopicRow>();

  if (topicIds.length > 0) {
    const { data: topicsData, error: topicsError } = await supabase
      .from('topics')
      .select('id, name')
      .in('id', topicIds);

    if (topicsError) {
      console.error('Failed to load topics for PDF export:', topicsError);
      return NextResponse.json(
        {
          error: 'Failed to load topics for PDF export.',
          details: topicsError.message,
        },
        { status: 500 }
      );
    }

    ((topicsData ?? []) as TopicRow[]).forEach((topic) => {
      topicById.set(topic.id, topic);
    });
  }

  const { data: answersData, error: answersError } = await supabase
    .from('answers')
    .select('*')
    .in('question_id', uniqueQuestionIds)
    .order('created_at', { ascending: false });

  if (answersError) {
    console.error('Failed to load answers for PDF export:', answersError);
    return NextResponse.json(
      {
        error: 'Failed to load answers for PDF export.',
        details: answersError.message,
      },
      { status: 500 }
    );
  }

  const answersByQuestionId = new Map<string, AnswerRow[]>();
  (answersData ?? []).forEach((answer) => {
    const questionId = (answer as Record<string, unknown>).question_id;
    if (typeof questionId !== 'string') return;
    const existing = answersByQuestionId.get(questionId) ?? [];
    existing.push(answer as AnswerRow);
    answersByQuestionId.set(questionId, existing);
  });

  const rows: QuestionRow[] = baseRows.map((row) => ({
    ...row,
    topic: topicById.get(row.topic_id) ?? null,
    answers: answersByQuestionId.get(row.id) ?? [],
  }));

  const byId = new Map(rows.map((row) => [row.id, row]));
  const orderedRows = uniqueQuestionIds
    .map((id) => byId.get(id))
    .filter((row): row is QuestionRow => Boolean(row));

  if (orderedRows.length === 0) {
    return NextResponse.json(
      { error: 'No questions found for the requested export.' },
      { status: 404 }
    );
  }

  if (!hasPaidAccess) {
    const hasPaidQuestions = orderedRows.some((question) => !Boolean(question.free_preview));
    if (hasPaidQuestions) {
      return NextResponse.json(
        {
          error:
            'Your current plan allows PDF export for free-preview questions only. Upgrade to export paid questions.',
        },
        { status: 403 }
      );
    }
  }

  let pdfData: Uint8Array;
  try {
    pdfData = buildQuestionsPdf(
      orderedRows.map(mapExportQuestion),
      auth.user.email ?? 'techhub user'
    );
  } catch (error) {
    console.error('Failed to build PDF data:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF document.' },
      { status: 500 }
    );
  }

  const response = new NextResponse(Buffer.from(pdfData), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="techhub-interview-questions-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }

  return response;
}
