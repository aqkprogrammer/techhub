import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Company, Topic } from '@techhub/types';

import {
  buildCategoryLookup,
  getTopicNameFromRow,
  getTopicSlugFromRow,
  resolveTopicCategory,
  type CategoryId,
} from './topics-by-category';

export type Difficulty = 'junior' | 'mid' | 'senior';

export type TopicOption = Topic & {
  slug: string;
  questionCount: number;
  category: CategoryId | null;
};
export type CompanyOption = Company;
type QuestionTopic = {
  id: string;
  name: string;
};

export type QuestionListEntry = {
  id: string;
  title: string;
  difficulty: Difficulty;
  difficultyWeight: number;
  topic: QuestionTopic;
  companies: Company[];
  isFreePreview: boolean;
  popularityScore: number;
  createdAt: string;
  /** Short answer for inline display on list; present when free preview or when answer is loaded */
  shortAnswer?: string;
  /** When true, question is a code challenge (code-based answer or coding task) */
  isCodeChallenge?: boolean;
};

export type QuestionFilters = {
  topicSlug?: string;
  category?: CategoryId;
  difficulty?: Difficulty;
  companyId?: string;
  /** When true, only return questions that are code challenges */
  codeOnly?: boolean;
};

export type QuestionListingData = {
  questions: QuestionListEntry[];
  topics: TopicOption[];
  companies: CompanyOption[];
  activeTopic?: TopicOption;
  totalQuestions?: number;
};

function sortQuestionsByAccess(questions: QuestionListEntry[]): QuestionListEntry[] {
  return [...questions].sort((a, b) => {
    if (a.isFreePreview !== b.isFreePreview) {
      return a.isFreePreview ? -1 : 1;
    }

    const aCreatedAt = Date.parse(a.createdAt);
    const bCreatedAt = Date.parse(b.createdAt);
    if (Number.isFinite(aCreatedAt) && Number.isFinite(bCreatedAt) && aCreatedAt !== bCreatedAt) {
      return bCreatedAt - aCreatedAt;
    }

    return b.popularityScore - a.popularityScore;
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function readStringField(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** UUIDs for dummy data so detail page and filters work without Supabase. Replace with real API later. */
const DUMMY_WS = '00000000-0000-0000-0000-000000000001';
const DUMMY_TOPICS = {
  react: { id: '10000000-0000-0000-0000-000000000001', name: 'React' },
  javascript: { id: '10000000-0000-0000-0000-000000000002', name: 'JavaScript' },
  typescript: { id: '10000000-0000-0000-0000-000000000003', name: 'TypeScript' },
  nodejs: { id: '10000000-0000-0000-0000-000000000004', name: 'Node.js' },
};
const DUMMY_COMPANIES = {
  google: { id: '20000000-0000-0000-0000-000000000001', name: 'Google', workspaceId: DUMMY_WS },
  meta: { id: '20000000-0000-0000-0000-000000000002', name: 'Meta', workspaceId: DUMMY_WS },
  amazon: { id: '20000000-0000-0000-0000-000000000003', name: 'Amazon', workspaceId: DUMMY_WS },
};

/** Dummy data when Supabase is not configured. Replace with real API later. */
export function getDummyQuestionListingData(filters: QuestionFilters): QuestionListingData {
  const dummyTopics: TopicOption[] = [
    { ...DUMMY_TOPICS.react, slug: 'react', questionCount: 4, category: 'fullstack' },
    { ...DUMMY_TOPICS.javascript, slug: 'javascript', questionCount: 3, category: 'fullstack' },
    { ...DUMMY_TOPICS.typescript, slug: 'typescript', questionCount: 3, category: 'fullstack' },
    { ...DUMMY_TOPICS.nodejs, slug: 'node-js', questionCount: 2, category: 'fullstack' },
  ].map((t) => ({ ...t, workspaceId: DUMMY_WS } as TopicOption));
  const dummyTopicById = new Map(dummyTopics.map((topic) => [topic.id, topic]));
  const dummyCompanies: CompanyOption[] = Object.values(DUMMY_COMPANIES);
  const allDummyQuestions: QuestionListEntry[] = [
    {
      id: '30000000-0000-0000-0000-000000000001',
      title: 'What is the virtual DOM and how does React use it?',
      difficulty: 'junior',
      difficultyWeight: 1,
      topic: { id: DUMMY_TOPICS.react.id, name: DUMMY_TOPICS.react.name },
      companies: [DUMMY_COMPANIES.google],
      isFreePreview: true,
      popularityScore: 0.95,
      createdAt: new Date().toISOString(),
      shortAnswer:
        'The virtual DOM is a lightweight JavaScript representation of the real DOM. React keeps a copy in memory, computes the minimal set of changes when state updates, and then patches the real DOM. This batching and diffing improves performance compared to updating the DOM directly.',
    },
    {
      id: '30000000-0000-0000-0000-000000000002',
      title: 'Explain the difference between $scope and $rootScope in Angular.',
      difficulty: 'mid',
      difficultyWeight: 2,
      topic: { id: DUMMY_TOPICS.javascript.id, name: DUMMY_TOPICS.javascript.name },
      companies: [DUMMY_COMPANIES.meta],
      isFreePreview: false,
      popularityScore: 0.88,
      createdAt: new Date().toISOString(),
    },
    {
      id: '30000000-0000-0000-0000-000000000003',
      title: 'What is the equivalent of ng-if and ng-show in React? Show with code.',
      difficulty: 'junior',
      difficultyWeight: 1,
      topic: { id: DUMMY_TOPICS.react.id, name: DUMMY_TOPICS.react.name },
      companies: [DUMMY_COMPANIES.google, DUMMY_COMPANIES.amazon],
      isFreePreview: true,
      popularityScore: 0.82,
      createdAt: new Date().toISOString(),
      isCodeChallenge: true,
      shortAnswer: `React uses conditional rendering instead of ng-if/ng-show:

\`\`\`jsx
// ng-if equivalent: render only when true
{isVisible && <Message />}

// ng-show equivalent: hide with CSS
<div style={{ display: isVisible ? 'block' : 'none' }}>Content</div>

// Or with a class
<div className={isVisible ? 'visible' : 'hidden'}>Content</div>
\`\`\`

React reconciles by diffing the virtual DOM; only changed nodes update the real DOM.`,
    },
    {
      id: '30000000-0000-0000-0000-000000000004',
      title: 'Provide an example of any simple Custom React Hook. Why do we need Custom Hooks?',
      difficulty: 'junior',
      difficultyWeight: 1,
      topic: { id: DUMMY_TOPICS.react.id, name: DUMMY_TOPICS.react.name },
      companies: [DUMMY_COMPANIES.meta],
      isFreePreview: true,
      popularityScore: 0.9,
      createdAt: new Date().toISOString(),
      isCodeChallenge: true,
      shortAnswer: `Custom hooks let you reuse stateful logic. Example:

\`\`\`javascript
function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);
  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  return { count, increment, decrement };
}
\`\`\`

Usage in a component:

\`\`\`javascript
function Counter() {
  const { count, increment, decrement } = useCounter(0);
  return (
    <div>
      <span>{count}</span>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  );
}
\`\`\`

We need custom hooks to share logic between components without repeating code or using render props/HOCs.`,
    },
    {
      id: '30000000-0000-0000-0000-000000000005',
      title: 'Describe the event loop and microtasks vs macrotasks.',
      difficulty: 'senior',
      difficultyWeight: 3,
      topic: { id: DUMMY_TOPICS.javascript.id, name: DUMMY_TOPICS.javascript.name },
      companies: [DUMMY_COMPANIES.google, DUMMY_COMPANIES.amazon],
      isFreePreview: false,
      popularityScore: 0.85,
      createdAt: new Date().toISOString(),
    },
    {
      id: '30000000-0000-0000-0000-000000000006',
      title: 'What is the difference between interface and type in TypeScript?',
      difficulty: 'junior',
      difficultyWeight: 1,
      topic: { id: DUMMY_TOPICS.typescript.id, name: DUMMY_TOPICS.typescript.name },
      companies: [DUMMY_COMPANIES.meta],
      isFreePreview: true,
      popularityScore: 0.78,
      createdAt: new Date().toISOString(),
      shortAnswer:
        'Both describe object shapes. interface can be extended and merged (declaration merging); type can represent unions, primitives, and tuples. Prefer interface for object contracts; use type for unions, intersections, and mapped types.',
    },
    {
      id: '30000000-0000-0000-0000-000000000007',
      title: 'How would you design a scalable REST API in Node.js?',
      difficulty: 'senior',
      difficultyWeight: 3,
      topic: { id: DUMMY_TOPICS.nodejs.id, name: DUMMY_TOPICS.nodejs.name },
      companies: [DUMMY_COMPANIES.amazon],
      isFreePreview: false,
      popularityScore: 0.72,
      createdAt: new Date().toISOString(),
    },
    {
      id: '30000000-0000-0000-0000-000000000008',
      title: 'Explain closures and lexical scope in JavaScript.',
      difficulty: 'junior',
      difficultyWeight: 1,
      topic: { id: DUMMY_TOPICS.javascript.id, name: DUMMY_TOPICS.javascript.name },
      companies: [DUMMY_COMPANIES.google],
      isFreePreview: true,
      popularityScore: 0.9,
      createdAt: new Date().toISOString(),
      shortAnswer:
        'A closure is a function that retains access to variables from its enclosing scope even after that scope has finished. Lexical scope means the scope is determined by where the function is defined, not where it is called. Together they allow private state and factory patterns.',
    },
    {
      id: '30000000-0000-0000-0000-000000000009',
      title: 'What are generics in TypeScript and when do you use them?',
      difficulty: 'mid',
      difficultyWeight: 2,
      topic: { id: DUMMY_TOPICS.typescript.id, name: DUMMY_TOPICS.typescript.name },
      companies: [DUMMY_COMPANIES.meta],
      isFreePreview: false,
      popularityScore: 0.8,
      createdAt: new Date().toISOString(),
    },
    {
      id: '30000000-0000-0000-0000-00000000000a',
      title: 'Describe the React component lifecycle and key methods.',
      difficulty: 'mid',
      difficultyWeight: 2,
      topic: { id: DUMMY_TOPICS.react.id, name: DUMMY_TOPICS.react.name },
      companies: [DUMMY_COMPANIES.google, DUMMY_COMPANIES.amazon],
      isFreePreview: false,
      popularityScore: 0.87,
      createdAt: new Date().toISOString(),
    },
    {
      id: '30000000-0000-0000-0000-00000000000b',
      title: 'How does Node.js handle async I/O and the event-driven model?',
      difficulty: 'senior',
      difficultyWeight: 3,
      topic: { id: DUMMY_TOPICS.nodejs.id, name: DUMMY_TOPICS.nodejs.name },
      companies: [DUMMY_COMPANIES.amazon],
      isFreePreview: false,
      popularityScore: 0.75,
      createdAt: new Date().toISOString(),
    },
    {
      id: '30000000-0000-0000-0000-00000000000c',
      title: 'What are discriminated unions and how do you type them in TypeScript?',
      difficulty: 'senior',
      difficultyWeight: 3,
      topic: { id: DUMMY_TOPICS.typescript.id, name: DUMMY_TOPICS.typescript.name },
      companies: [DUMMY_COMPANIES.google],
      isFreePreview: false,
      popularityScore: 0.7,
      createdAt: new Date().toISOString(),
    },
  ];

  let activeTopic = filters.topicSlug
    ? dummyTopics.find((t) => t.slug === filters.topicSlug)
    : undefined;

  let questions = [...allDummyQuestions].filter((q) => {
      if (filters.category) {
        const questionTopic = dummyTopicById.get(q.topic.id);
        if (!questionTopic || questionTopic.category !== filters.category) return false;
      }
      if (filters.topicSlug && activeTopic && q.topic.id !== activeTopic.id) return false;
      if (filters.difficulty && q.difficulty !== filters.difficulty) return false;
      if (filters.companyId && !q.companies.some((c) => c.id === filters.companyId)) return false;
      if (filters.codeOnly && !q.isCodeChallenge) return false;
      return true;
    });

  if (activeTopic && !dummyTopics.some((t) => t.slug === activeTopic.slug)) {
    questions = [];
  }

  return {
    questions: sortQuestionsByAccess(questions),
    topics: dummyTopics,
    companies: dummyCompanies,
    activeTopic,
    totalQuestions: allDummyQuestions.length,
  };
}

/** Set of dummy question UUIDs for detail fallback when Supabase is null. */
export const DUMMY_QUESTION_IDS = new Set(
  [
    '30000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000004',
    '30000000-0000-0000-0000-000000000005',
    '30000000-0000-0000-0000-000000000006',
    '30000000-0000-0000-0000-000000000007',
    '30000000-0000-0000-0000-000000000008',
    '30000000-0000-0000-0000-000000000009',
    '30000000-0000-0000-0000-00000000000a',
    '30000000-0000-0000-0000-00000000000b',
    '30000000-0000-0000-0000-00000000000c',
  ].map((s) => s.toLowerCase()),
);

export async function getQuestionListingData(
  filters: QuestionFilters,
): Promise<QuestionListingData> {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return getDummyQuestionListingData(filters);
  }

  const [topicsResponse, companiesResponse, countResponse, totalCountResponse, topicCategoriesResponse] = await Promise.all([
    supabase.from('topics').select('*'),
    supabase.from('companies').select('*').order('name', { ascending: true }),
    supabase.from('questions').select('topic_id'),
    supabase.from('questions').select('id', { count: 'exact', head: true }),
    supabase.from('topic_categories').select('*'),
  ]);

  if (topicsResponse.error) {
    console.error('Failed to load topics', topicsResponse.error);
  }
  if (companiesResponse.error) {
    console.error('Failed to load companies', companiesResponse.error);
  }
  if (topicCategoriesResponse.error && topicCategoriesResponse.error.code !== '42P01') {
    console.error('Failed to load topic categories', topicCategoriesResponse.error);
  }

  const topicCounts = (countResponse.data ?? []).reduce<Record<string, number>>((acc, row) => {
    const id = row.topic_id;
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});

  const categoryLookup = buildCategoryLookup(
    topicCategoriesResponse.error && topicCategoriesResponse.error.code === '42P01'
      ? []
      : (topicCategoriesResponse.data ?? []),
  );

  const topics = ((topicsResponse.data ?? []) as Record<string, unknown>[])
    .map((topicRow) => {
      const id = readStringField(topicRow, 'id');
      const name = getTopicNameFromRow(topicRow);
      if (!id || !name) return null;

      const slug = getTopicSlugFromRow(topicRow) ?? slugify(name);
      const workspaceId = readStringField(topicRow, 'workspace_id') ?? DUMMY_WS;

      return {
        id,
        name,
        workspaceId,
        slug,
        questionCount: topicCounts[id] ?? 0,
        category: resolveTopicCategory(topicRow, categoryLookup),
      } satisfies TopicOption;
    })
    .filter((topic): topic is TopicOption => Boolean(topic))
    .sort((a, b) => a.name.localeCompare(b.name));

  const hasExplicitCategories = topics.some((topic) => topic.category !== null);
  const normalizedTopics = hasExplicitCategories
    ? topics
    : topics.map((topic) => ({ ...topic, category: 'fullstack' as const }));

  const totalQuestions =
    typeof totalCountResponse.count === 'number'
      ? totalCountResponse.count
      : (countResponse.data ?? []).length;

  const companies = ((companiesResponse.data ?? []) as Record<string, unknown>[])
    .map((companyRow) => {
      const id = readStringField(companyRow, 'id');
      const name = readStringField(companyRow, 'name');
      if (!id || !name) return null;

      return {
        id,
        name,
        workspaceId: readStringField(companyRow, 'workspace_id') ?? DUMMY_WS,
      } satisfies CompanyOption;
    })
    .filter((company): company is CompanyOption => Boolean(company))
    .sort((a, b) => a.name.localeCompare(b.name));
  const activeTopic = filters.topicSlug
    ? normalizedTopics.find((topic) => topic.slug === filters.topicSlug)
    : undefined;

  const categoryTopicIds = filters.category
    ? normalizedTopics
        .filter((topic) => topic.category === filters.category)
        .map((topic) => topic.id)
    : [];

  type QuestionRow = {
    id: string;
    title: string;
    difficulty: Difficulty;
    topic_id: string;
    free_preview: boolean | null;
    created_at: string;
    topic: { id: string; name: string } | Array<{ id: string; name: string }> | null;
  };

  let query = supabase
    .from('questions')
    .select(
      `
        id,
        title,
        difficulty,
        topic_id,
        free_preview,
        created_at,
        topic:topics ( id, name )
      `,
    )
    .order('created_at', { ascending: false });

  if (activeTopic) {
    query = query.eq('topic_id', activeTopic.id);
  } else if (categoryTopicIds.length > 0) {
    query = query.in('topic_id', categoryTopicIds);
  }
  if (filters.difficulty) {
    query = query.eq('difficulty', filters.difficulty);
  }
  const { data, error } = await query;

  if (error) {
    console.error('Failed to load questions', error);
  }

  const rows = (data ?? []) as unknown as QuestionRow[];

  let questions: QuestionListEntry[] = rows.map((row) => {
    const topicRelation = Array.isArray(row.topic) ? row.topic[0] ?? null : row.topic;
    const difficultyWeight = row.difficulty === 'junior' ? 1 : row.difficulty === 'mid' ? 2 : 3;
    return {
      id: row.id,
      title: row.title,
      difficulty: row.difficulty,
      difficultyWeight,
      topic: topicRelation ?? { id: row.topic_id, name: 'Unknown' },
      companies: [],
      isFreePreview: row.free_preview ?? false,
      popularityScore: 0,
      createdAt: row.created_at,
      shortAnswer: undefined,
      isCodeChallenge: undefined,
    };
  });

  if (filters.codeOnly) {
    questions = questions.filter((q) => q.isCodeChallenge);
  }

  return {
    questions: sortQuestionsByAccess(questions),
    topics: normalizedTopics,
    companies,
    activeTopic,
    totalQuestions,
  };
}
