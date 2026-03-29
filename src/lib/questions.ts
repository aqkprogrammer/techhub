import { z } from 'zod';

export const MAX_TITLE_LENGTH = 150;
export const MIN_TITLE_LENGTH = 10;
export const MAX_EDITOR_FIELD_CHARS = 50_000;
export const MAX_FOLLOW_UPS = 10;

export const DifficultyInputSchema = z.enum([
  'easy',
  'medium',
  'hard',
  'junior',
  'mid',
  'senior',
]);

export type DifficultyInput = z.infer<typeof DifficultyInputSchema>;
export type DifficultyDb = 'junior' | 'mid' | 'senior';

export type FollowUpItem = {
  question: string;
  answer: string;
};

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const followUpSchema = z.object({
  question: z.string().trim().max(500).default(''),
  answer: z.string().trim().max(5_000).default(''),
});

export const answerInputSchema = z.object({
  shortAnswer: z.string().trim().min(1, 'Short answer is required.').max(MAX_EDITOR_FIELD_CHARS),
  deepExplanation: z.string().trim().max(MAX_EDITOR_FIELD_CHARS).optional().default(''),
  realWorldExample: z.string().trim().max(MAX_EDITOR_FIELD_CHARS).optional().default(''),
  commonMistakes: z.string().trim().max(MAX_EDITOR_FIELD_CHARS).optional().default(''),
  followUps: z.array(followUpSchema).max(MAX_FOLLOW_UPS).optional().default([]),
});

export const createQuestionPayloadSchema = z.object({
  title: z.string().trim().min(MIN_TITLE_LENGTH).max(MAX_TITLE_LENGTH),
  slug: z.string().trim().min(1).max(180).regex(slugRegex, {
    message: 'Slug may only contain lowercase letters, numbers, and hyphens.',
  }),
  difficulty: DifficultyInputSchema,
  topicId: z.string().uuid(),
  freePreview: z.boolean().optional(),
  isFreePreview: z.boolean().optional(),
  answer: answerInputSchema,
});

export const updateQuestionPayloadSchema = z
  .object({
    title: z.string().trim().min(MIN_TITLE_LENGTH).max(MAX_TITLE_LENGTH).optional(),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .regex(slugRegex, {
        message: 'Slug may only contain lowercase letters, numbers, and hyphens.',
      })
      .optional(),
    difficulty: DifficultyInputSchema.optional(),
    topicId: z.string().uuid().optional(),
    freePreview: z.boolean().optional(),
    isFreePreview: z.boolean().optional(),
    answer: answerInputSchema.optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.slug !== undefined ||
      value.difficulty !== undefined ||
      value.topicId !== undefined ||
      value.freePreview !== undefined ||
      value.isFreePreview !== undefined ||
      value.answer !== undefined,
    {
      message: 'No changes provided.',
    },
  );

function withSingleSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function slugifyQuestion(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function sanitizeRichText(value: string, maxChars = MAX_EDITOR_FIELD_CHARS): string {
  const sliced = value.slice(0, maxChars);

  return sliced
    .replace(/<\s*script/gi, '&lt;script')
    .replace(/<\s*\/\s*script\s*>/gi, '&lt;/script&gt;')
    .replace(/<\s*style/gi, '&lt;style')
    .replace(/<\s*\/\s*style\s*>/gi, '&lt;/style&gt;')
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/\u0000/g, '')
    .trim();
}

export function mapDifficultyInputToDb(value: DifficultyInput): DifficultyDb {
  if (value === 'easy' || value === 'junior') return 'junior';
  if (value === 'medium' || value === 'mid') return 'mid';
  return 'senior';
}

export function parseCommonMistakes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? withSingleSpaces(entry) : ''))
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(/\n|;/)
      .map((entry) => withSingleSpaces(entry))
      .filter((entry) => entry.length > 0);
  }

  return [];
}

export function commonMistakesToText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  return parseCommonMistakes(value).join('\n');
}

function parseFollowUpObject(value: Record<string, unknown>): FollowUpItem | null {
  const question = typeof value.question === 'string' ? value.question.trim() : '';
  const answer = typeof value.answer === 'string' ? value.answer.trim() : '';
  if (!question && !answer) return null;
  return {
    question: question.slice(0, 500),
    answer: answer.slice(0, 5_000),
  };
}

export function parseFollowUps(value: unknown): FollowUpItem[] {
  if (!value) return [];

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return parseFollowUps(parsed);
    } catch {
      return trimmed
        .split(/\n|;/)
        .map((entry) => withSingleSpaces(entry))
        .filter((entry) => entry.length > 0)
        .slice(0, MAX_FOLLOW_UPS)
        .map((question) => ({ question, answer: '' }));
    }
  }

  if (!Array.isArray(value)) return [];

  const mapped = value
    .map((entry) => {
      if (typeof entry === 'string') {
        const text = withSingleSpaces(entry);
        if (!text) return null;
        return { question: text, answer: '' } satisfies FollowUpItem;
      }

      if (!entry || typeof entry !== 'object') return null;
      return parseFollowUpObject(entry as Record<string, unknown>);
    })
    .filter((entry): entry is FollowUpItem => Boolean(entry));

  return mapped.slice(0, MAX_FOLLOW_UPS);
}

export function normalizeAnswerInput(input: z.infer<typeof answerInputSchema>) {
  return {
    shortAnswer: sanitizeRichText(input.shortAnswer),
    deepExplanation: sanitizeRichText(input.deepExplanation ?? ''),
    realWorldExample: sanitizeRichText(input.realWorldExample ?? ''),
    commonMistakes: sanitizeRichText(input.commonMistakes ?? ''),
    followUps: parseFollowUps(input.followUps ?? []),
  };
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  const entries = Object.entries(value).filter(([, entry]) => entry !== undefined);
  return Object.fromEntries(entries) as T;
}

function dedupePayloads(payloads: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const unique: Array<Record<string, unknown>> = [];

  for (const payload of payloads) {
    const cleaned = removeUndefined(payload);
    const key = JSON.stringify(cleaned);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(cleaned);
  }

  return unique;
}

export function buildQuestionInsertPayloadVariants(input: {
  title: string;
  slug: string;
  difficulty: DifficultyDb;
  topicId: string;
  freePreview: boolean;
  createdBy?: string;
}): Array<Record<string, unknown>> {
  return dedupePayloads([
    {
      title: input.title,
      slug: input.slug,
      difficulty: input.difficulty,
      topic_id: input.topicId,
      free_preview: input.freePreview,
      created_by: input.createdBy,
    },
    {
      title: input.title,
      slug: input.slug,
      difficulty: input.difficulty,
      topic_id: input.topicId,
      free_preview: input.freePreview,
    },
    {
      title: input.title,
      slug: input.slug,
      difficulty: input.difficulty,
      topic_id: input.topicId,
      is_free_preview: input.freePreview,
      created_by: input.createdBy,
    },
    {
      title: input.title,
      slug: input.slug,
      difficulty: input.difficulty,
      topic_id: input.topicId,
      is_free_preview: input.freePreview,
    },
  ]);
}

export function buildQuestionUpdatePayloadVariants(input: {
  title?: string;
  slug?: string;
  difficulty?: DifficultyDb;
  topicId?: string;
  freePreview?: boolean;
}): Array<Record<string, unknown>> {
  const base: Record<string, unknown> = {};

  if (input.title !== undefined) base.title = input.title;
  if (input.slug !== undefined) base.slug = input.slug;
  if (input.difficulty !== undefined) base.difficulty = input.difficulty;
  if (input.topicId !== undefined) base.topic_id = input.topicId;

  if (input.freePreview === undefined) {
    return [base];
  }

  return dedupePayloads([
    {
      ...base,
      free_preview: input.freePreview,
    },
    {
      ...base,
      is_free_preview: input.freePreview,
    },
  ]);
}

export function buildAnswerPayloadVariants(input: {
  questionId?: string;
  shortAnswer: string;
  deepExplanation: string;
  realWorldExample: string;
  commonMistakes: string;
  followUps: FollowUpItem[];
}): Array<Record<string, unknown>> {
  const followUpQuestions = input.followUps
    .map((entry) => entry.question.trim())
    .filter((entry) => entry.length > 0);
  const followUpLines = input.followUps
    .map((entry) => {
      const question = entry.question.trim();
      const answer = entry.answer.trim();
      if (!question && !answer) return '';
      if (!answer) return question;
      if (!question) return answer;
      return `${question} - ${answer}`;
    })
    .filter((entry) => entry.length > 0);
  const commonMistakesArray = parseCommonMistakes(input.commonMistakes);

  const base = {
    question_id: input.questionId,
    short_answer: input.shortAnswer,
    deep_explanation: input.deepExplanation || null,
    real_world_example: input.realWorldExample || null,
  };

  return dedupePayloads([
    {
      ...base,
      common_mistakes: input.commonMistakes || null,
      follow_ups: input.followUps.length > 0 ? input.followUps : null,
    },
    {
      ...base,
      common_mistakes: commonMistakesArray,
      follow_ups: input.followUps.length > 0 ? input.followUps : null,
    },
    {
      ...base,
      common_mistakes: input.commonMistakes || null,
      follow_up_questions: followUpQuestions.length > 0 ? followUpQuestions : null,
    },
    {
      ...base,
      common_mistakes: commonMistakesArray,
      follow_up_questions: followUpQuestions.length > 0 ? followUpQuestions : null,
    },
    {
      ...base,
      common_mistakes: commonMistakesArray,
      follow_up_questions: followUpLines.length > 0 ? followUpLines : null,
    },
  ]);
}

export type MappedAnswer = {
  id: string | null;
  questionId: string | null;
  shortAnswer: string | null;
  short_answer: string | null;
  deepExplanation: string | null;
  deep_explanation: string | null;
  realWorldExample: string | null;
  real_world_example: string | null;
  commonMistakes: string[];
  common_mistakes: string[];
  commonMistakesText: string;
  common_mistakes_text: string;
  followUps: FollowUpItem[];
  follow_ups: FollowUpItem[];
  follow_up_questions: string[];
  createdAt: string | null;
  created_at: string | null;
  updatedAt: string | null;
  updated_at: string | null;
};

export function mapAnswerRowToApi(row: Record<string, unknown>): MappedAnswer {
  const shortAnswer =
    (typeof row.short_answer === 'string' ? row.short_answer : null) ??
    (typeof row.shortAnswer === 'string' ? row.shortAnswer : null);

  const deepExplanation =
    (typeof row.deep_explanation === 'string' ? row.deep_explanation : null) ??
    (typeof row.deepExplanation === 'string' ? row.deepExplanation : null);

  const realWorldExample =
    (typeof row.real_world_example === 'string' ? row.real_world_example : null) ??
    (typeof row.realWorldExample === 'string' ? row.realWorldExample : null);

  const commonRaw =
    row.common_mistakes ??
    row.commonMistakes ??
    null;

  const followUps = parseFollowUps(
    row.follow_ups ?? row.followUpQuestions ?? row.follow_up_questions ?? row.followUps ?? null,
  );

  const commonMistakesText = commonMistakesToText(commonRaw);
  const commonMistakes = parseCommonMistakes(commonRaw);

  const followUpQuestions = followUps
    .map((entry) => entry.question.trim())
    .filter((entry) => entry.length > 0);

  const id = typeof row.id === 'string' ? row.id : null;
  const questionId = typeof row.question_id === 'string' ? row.question_id : null;
  const createdAt = typeof row.created_at === 'string' ? row.created_at : null;
  const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : null;

  return {
    id,
    questionId,
    shortAnswer,
    short_answer: shortAnswer,
    deepExplanation,
    deep_explanation: deepExplanation,
    realWorldExample,
    real_world_example: realWorldExample,
    commonMistakes,
    common_mistakes: commonMistakes,
    commonMistakesText,
    common_mistakes_text: commonMistakesText,
    followUps,
    follow_ups: followUps,
    follow_up_questions: followUpQuestions,
    createdAt,
    created_at: createdAt,
    updatedAt,
    updated_at: updatedAt,
  };
}

export function getTopicNameFromJoinedRow(topic: unknown): string | null {
  if (!topic) return null;

  const row = Array.isArray(topic) ? topic[0] : topic;
  if (!row || typeof row !== 'object') return null;

  const value = row as Record<string, unknown>;
  const fromName = typeof value.name === 'string' ? value.name.trim() : '';
  if (fromName) return fromName;

  const fromTitle = typeof value.title === 'string' ? value.title.trim() : '';
  return fromTitle || null;
}

export function normalizeValidationError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid request payload.';
}

