import { z } from 'zod';

export const DifficultySchema = z.enum(['junior', 'mid', 'senior']);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const DifficultyWeightSchema = z.number().int().min(1).max(3);
export const PopularityScoreSchema = z.number().min(0);

export const TopicSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  workspaceId: z.string().uuid(),
});
export type Topic = z.infer<typeof TopicSchema>;

export const CompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  workspaceId: z.string().uuid(),
});
export type Company = z.infer<typeof CompanySchema>;

export const TagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  workspaceId: z.string().uuid(),
});
export type Tag = z.infer<typeof TagSchema>;

export const QuestionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(3),
  difficulty: DifficultySchema,
  difficultyWeight: DifficultyWeightSchema,
  workspaceId: z.string().uuid(),
  topicId: z.string().uuid(),
  companyIds: z.array(z.string().uuid()),
  tagIds: z.array(z.string().uuid()),
  isFreePreview: z.boolean(),
  popularityScore: PopularityScoreSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Question = z.infer<typeof QuestionSchema>;

export const AnswerSchema = z.object({
  id: z.string().uuid(),
  questionId: z.string().uuid(),
  shortAnswer: z.string().min(1),
  deepExplanation: z.string().min(1),
  realWorldExample: z.string().min(1),
  commonMistakes: z.array(z.string().min(1)),
  followUpQuestions: z.array(z.string().min(1)),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Answer = z.infer<typeof AnswerSchema>;

export const QuestionMetricsSchema = z.object({
  questionId: z.string().uuid(),
  views: z.number().int().min(0),
  completions: z.number().int().min(0),
  bookmarks: z.number().int().min(0),
  upvotes: z.number().int().min(0),
  downvotes: z.number().int().min(0),
  lastViewedAt: z.string().nullable(),
});
export type QuestionMetrics = z.infer<typeof QuestionMetricsSchema>;

export const QuestionListItemSchema = z.object({
  question: QuestionSchema,
  topic: TopicSchema,
  companies: z.array(CompanySchema),
  tags: z.array(TagSchema),
  metrics: QuestionMetricsSchema.optional(),
});
export type QuestionListItem = z.infer<typeof QuestionListItemSchema>;

export const QuestionWithAnswerSchema = z.object({
  question: QuestionSchema,
  topic: TopicSchema,
  companies: z.array(CompanySchema),
  tags: z.array(TagSchema),
  metrics: QuestionMetricsSchema.optional(),
  answer: AnswerSchema.optional(),
});
export type QuestionWithAnswer = z.infer<typeof QuestionWithAnswerSchema>;

export const QuestionListQuerySchema = z.object({
  q: z.string().min(1).optional(),
  difficulty: DifficultySchema.optional(),
  workspaceId: z.string().uuid().optional(),
  topicId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  freePreview: z.coerce.boolean().optional(),
  sort: z.enum(['relevance', 'popular', 'new', 'difficulty']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const QuestionIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const CreateQuestionBodySchema = z.object({
  title: z.string().min(3),
  difficulty: DifficultySchema,
  workspaceId: z.string().uuid(),
  topicId: z.string().uuid(),
  companyIds: z.array(z.string().uuid()).default([]),
  tagIds: z.array(z.string().uuid()).default([]),
  isFreePreview: z.boolean(),
  difficultyWeight: DifficultyWeightSchema.optional(),
});

export const UpdateQuestionBodySchema = CreateQuestionBodySchema.partial();

export const CreateAnswerBodySchema = z.object({
  questionId: z.string().uuid(),
  shortAnswer: z.string().min(1),
  deepExplanation: z.string().min(1),
  realWorldExample: z.string().min(1),
  commonMistakes: z.array(z.string().min(1)).default([]),
  followUpQuestions: z.array(z.string().min(1)).default([]),
});

export const UpdateAnswerBodySchema = CreateAnswerBodySchema.partial();

export const CreateTopicBodySchema = z.object({
  name: z.string().min(1),
  workspaceId: z.string().uuid(),
});

export const CreateCompanyBodySchema = z.object({
  name: z.string().min(1),
  workspaceId: z.string().uuid(),
});

export const CreateTagBodySchema = z.object({
  name: z.string().min(1),
  workspaceId: z.string().uuid(),
});

export const IncrementQuestionMetricsBodySchema = z
  .object({
    views: z.number().int().min(0).default(0),
    completions: z.number().int().min(0).default(0),
    bookmarks: z.number().int().min(0).default(0),
    upvotes: z.number().int().min(0).default(0),
    downvotes: z.number().int().min(0).default(0),
  })
  .refine(
    (data) =>
      data.views > 0 ||
      data.completions > 0 ||
      data.bookmarks > 0 ||
      data.upvotes > 0 ||
      data.downvotes > 0,
    {
      message: 'At least one metric increment must be greater than zero.',
    }
  );
