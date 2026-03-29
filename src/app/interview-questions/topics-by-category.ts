/**
 * Shared taxonomy helpers for interview questions.
 * Topics are no longer hardcoded by category; category/topic mapping is API/DB-driven.
 */

export type CategoryId = 'fullstack' | 'dsa' | 'system-design' | 'ml';

export const CATEGORY_IDS: CategoryId[] = [
  'fullstack',
  'dsa',
  'system-design',
  'ml',
];

export type TopicDisplay = {
  id?: string;
  name: string;
  slug: string;
  count: number;
};

export type CategoryLookup = {
  byId: Map<string, CategoryId>;
  bySlug: Map<string, CategoryId>;
  byName: Map<string, CategoryId>;
};

export const TOPIC_ICONS: Record<string, string> = {
  'net-core': '🔷', adonet: '🔗', aspnet: '🌐', 'aspnet-mvc': '📐', 'aspnet-web-api': '🔌',
  'agile-scrum': '📋', android: '🤖', angular: '🅰', angularjs: '📐', azure: '☁',
  'azure-service-bus': '🚌', csharp: 'C#', 'cosmos-db': '🌍', css: '🎨',
  'dependency-injection': '💉', 'design-patterns': '📐', devops: '🔄', 'entity-framework': '🗃',
  flutter: '🔥', git: '📂', golang: '🐹', graphql: '◉', html5: '5', ionic: '📱',
  java: '☕', javascript: '📜', jquery: 'jQ', kotlin: 'K', linq: 'L', laravel: 'L',
  mongodb: '🍃', mysql: '🐬', 'node-js': '⬢', oop: 'O', 'objective-c': '🍎',
  php: '🐘', pwa: '📱', python: '🐍', react: '⚛', 'react-hooks': '🪝', 'react-native': '📱',
  'reactive-programming': '↻', redis: '🔴', redux: '📦', ruby: '💎', 'ruby-on-rails': '🛤',
  rust: '🦀', sql: '🗄', spring: '🍃', swift: '🐦', tsql: 'T', typescript: 'TS',
  'unit-testing': '✅', 'ux-design': '✨', vuejs: '💚', wcf: '⚙', wpf: '🪟',
  'web-security': '🔒', websockets: '🔌', xamarin: 'X', ios: '🍎',
  arrays: '📊', backtracking: '↩', 'big-o-notation': 'O', 'binary-tree': '🌳',
  'bit-manipulation': '🔢', blockchain: '⛓', 'data-structures': '📚', 'divide-conquer': '✂',
  'dynamic-programming': '📈', 'fibonacci-series': '📐', 'graph-theory': '🕸', 'greedy-algorithms': '📉',
  'hash-tables': '#', 'heaps-maps': '🗺', 'linked-lists': '🔗', queues: '📥', recursion: '🔄',
  searching: '🔍', sorting: '↕', stacks: '📚', strings: '📝', trees: '🌲', trie: 'T',
  'api-design': '🔌', 'availability-reliability': '✓', 'cap-theorem': 'C', cdn: '🌐',
  caching: '💾', 'clean-architecture': '🏛', concurrency: '⏱', cryptography: '🔐', ddd: 'D',
  databases: '🗄', docker: '🐳', kubernetes: '⎈', 'layering-middleware': '📦',
  'load-balancing': '⚖', microservices: '🔀', nosql: '📄', 'reactive-systems': '↻',
  soa: 'S', 'software-architecture': '🏗', 'software-testing': '🧪',
  'aws-machine-learning': '☁', 'anomaly-detection': '📉', 'apache-spark': '⚡', autoencoders: '🧠',
  'azure-ml': '☁', 'bias-variance': '📊', 'big-o-notation-ml': 'O', chatgpt: '🤖', classification: '🏷',
  clustering: '🔵', cnn: '🖼', 'computer-vision': '👁', 'cost-function': '📉',
  'curse-of-dimensionality': '📐', 'data-mining': '⛏', 'data-processing': '⚙', 'data-structures-ml': '📚',
  'databases-ml': '🗄', 'decision-trees': '🌳', 'deep-learning': '🧠', 'dimensionality-reduction': '↕',
  'ensemble-learning': '👥', 'feature-engineering': '🔧', 'game-theory': '♟', 'genetic-algorithms': '🧬',
  'gradient-descent': '📉', hadoop: '🐘', julia: 'J', 'k-means-clustering': 'K', 'k-nearest-neighbors': 'K',
  keras: 'K', 'linear-algebra': '∑', 'linear-regression': '📈', llms: '🤖', llmops: '⚙',
  'logistic-regression': '📊', matlab: 'M', 'model-evaluation': '✓', mlops: '⚙', 'naive-bayes': '📊',
  'neural-networks': '🧠', nlp: '💬', numpy: 'np', optimisation: '⚙', pandas: 'pd', pca: 'P',
  probability: '🎲', pytorch: '🔥', 'python-ml': '🐍', 'q-learning': 'Q', r: 'R',
  'random-forest': '🌲', 'recommendation-systems': '⭐', 'reinforcement-learning': '🎮', rnn: '↻',
  'scikit-learn': '📊', scala: 'S', 'searching-ml': '🔍', 'sorting-ml': '↕', 'sql-ml': '🗄',
  statistics: '📊', 'supervised-learning': '📗', svm: 'S', tensorflow: 'T', 'time-series': '📈',
  'unsupervised-learning': '📘',
};

const CATEGORY_ALIASES: Record<CategoryId, Set<string>> = {
  fullstack: new Set([
    'fullstack',
    'full-stack',
    'full-stack-web-mobile',
    'full-stack-web-and-mobile',
    'web-mobile',
    'fullstack-web-mobile',
  ]),
  dsa: new Set([
    'dsa',
    'algorithms',
    'algorithm',
    'algorithms-data-structures',
    'data-structures',
  ]),
  'system-design': new Set([
    'system-design',
    'system-design-architecture',
    'architecture',
    'software-architecture',
  ]),
  ml: new Set([
    'ml',
    'ai',
    'machine-learning',
    'machine-learning-data-science',
    'data-science',
  ]),
};

function normalizeToken(value: string): string {
  return value.toLowerCase().trim();
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function normalizeTopicKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function readStringField(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizeCategoryId(value: string | null | undefined): CategoryId | null {
  if (!value) return null;

  const normalized = normalizeToken(value);
  const direct = CATEGORY_IDS.find((id) => id === normalized);
  if (direct) return direct;

  const slug = slugify(normalized);
  for (const id of CATEGORY_IDS) {
    if (CATEGORY_ALIASES[id].has(slug) || CATEGORY_ALIASES[id].has(normalized)) {
      return id;
    }
  }

  return null;
}

export function isCategoryId(value: string): value is CategoryId {
  return normalizeCategoryId(value) !== null;
}

export function getTopicIcon(topic: TopicDisplay): string {
  const icon = TOPIC_ICONS[topic.slug];
  if (icon) return icon;
  const first = topic.name.replace(/^[^a-zA-Z0-9]*/, '').charAt(0);
  return first ? first.toUpperCase() : '•';
}

export function buildCategoryLookup(rawCategories: unknown[]): CategoryLookup {
  const lookup: CategoryLookup = {
    byId: new Map<string, CategoryId>(),
    bySlug: new Map<string, CategoryId>(),
    byName: new Map<string, CategoryId>(),
  };

  for (const rawEntry of rawCategories) {
    const row = rawEntry && typeof rawEntry === 'object'
      ? (rawEntry as Record<string, unknown>)
      : null;
    if (!row) continue;

    const id = readStringField(row, 'id');
    const name = readStringField(row, 'name') ?? readStringField(row, 'title');
    const slug = readStringField(row, 'slug') ?? (name ? slugify(name) : null);

    const category =
      normalizeCategoryId(slug) ??
      normalizeCategoryId(id) ??
      normalizeCategoryId(name);

    if (!category) continue;

    if (id) lookup.byId.set(id, category);
    if (slug) lookup.bySlug.set(slug, category);
    if (name) lookup.byName.set(normalizeTopicKey(name), category);
  }

  return lookup;
}

export function resolveTopicCategory(
  rawTopic: unknown,
  lookup: CategoryLookup,
): CategoryId | null {
  const topic = rawTopic && typeof rawTopic === 'object'
    ? (rawTopic as Record<string, unknown>)
    : null;
  if (!topic) return null;

  const directCandidates = [
    readStringField(topic, 'category'),
    readStringField(topic, 'category_slug'),
    readStringField(topic, 'categorySlug'),
  ];

  for (const candidate of directCandidates) {
    const category = normalizeCategoryId(candidate);
    if (category) return category;
  }

  const idCandidates = [
    readStringField(topic, 'category_id'),
    readStringField(topic, 'categoryId'),
  ];

  for (const candidate of idCandidates) {
    if (!candidate) continue;
    const byId = lookup.byId.get(candidate);
    if (byId) return byId;
    const normalized = normalizeCategoryId(candidate);
    if (normalized) return normalized;
  }

  const topicSlug = readStringField(topic, 'slug');
  if (topicSlug && lookup.bySlug.has(topicSlug)) {
    return lookup.bySlug.get(topicSlug) ?? null;
  }

  const topicName = readStringField(topic, 'name') ?? readStringField(topic, 'title');
  if (topicName) {
    const byName = lookup.byName.get(normalizeTopicKey(topicName));
    if (byName) return byName;
  }

  return null;
}

export function getTopicNameFromRow(rawTopic: unknown): string | null {
  if (!rawTopic || typeof rawTopic !== 'object') return null;
  const topic = rawTopic as Record<string, unknown>;
  return readStringField(topic, 'name') ?? readStringField(topic, 'title');
}

export function getTopicSlugFromRow(rawTopic: unknown): string | null {
  if (!rawTopic || typeof rawTopic !== 'object') return null;
  const topic = rawTopic as Record<string, unknown>;
  const directSlug = readStringField(topic, 'slug');
  if (directSlug) return directSlug;
  const name = getTopicNameFromRow(topic);
  return name ? slugify(name) : null;
}
