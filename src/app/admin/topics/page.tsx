import { createSupabaseServerClient } from '@/lib/supabase/server';

import {
  createTopicAction,
  deleteTopicAction,
  updateTopicAction,
} from '../actions';

type SearchParams = Record<string, string | string[] | undefined>;

type TopicCategory = {
  id: string;
  name: string;
  slug: string;
};

type TopicView = {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  createdAt: string | null;
  updatedAt: string | null;
};

function getSingleParam(value?: string | string[]) {
  if (!value) return '';
  return Array.isArray(value) ? value[0] ?? '' : value;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : '';
}

function getTopicName(row: Record<string, unknown>) {
  const name = readString(row, 'name');
  if (name) return name;
  return readString(row, 'title');
}

function getTopicSlug(row: Record<string, unknown>, name: string) {
  const slug = readString(row, 'slug');
  if (slug) return slug;
  return slugify(name);
}

function getTopicCategoryId(row: Record<string, unknown>) {
  return readString(row, 'category_id') || readString(row, 'categoryId');
}

type AdminTopicsPageProps = {
  searchParams?: Promise<SearchParams>;
};

export default async function AdminTopicsPage({ searchParams }: AdminTopicsPageProps) {
  const params = searchParams ? await searchParams : {};
  const status = getSingleParam(params.status);
  const feedbackMessage = getSingleParam(params.message);

  const supabase = createSupabaseServerClient();
  const [categoriesResponse, topicsResponse] = await Promise.all([
    supabase.from('topic_categories').select('*').order('name', { ascending: true }),
    supabase.from('topics').select('*'),
  ]);

  const categories = ((categoriesResponse.data ?? []) as Record<string, unknown>[])
    .map((row) => {
      const id = readString(row, 'id');
      const name = readString(row, 'name') || readString(row, 'title');
      if (!id || !name) return null;
      return {
        id,
        name,
        slug: readString(row, 'slug') || slugify(name),
      } satisfies TopicCategory;
    })
    .filter((item): item is TopicCategory => Boolean(item));

  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const topics = ((topicsResponse.data ?? []) as Record<string, unknown>[])
    .map((row) => {
      const id = readString(row, 'id');
      const name = getTopicName(row);
      if (!id || !name) return null;
      return {
        id,
        name,
        slug: getTopicSlug(row, name),
        categoryId: getTopicCategoryId(row),
        createdAt: readString(row, 'created_at') || null,
        updatedAt: readString(row, 'updated_at') || null,
      } satisfies TopicView;
    })
    .filter((item): item is TopicView => Boolean(item))
    .sort((a, b) => a.name.localeCompare(b.name));

  const topicsByCategory = categories.map((category) => ({
    category,
    count: topics.filter((topic) => topic.categoryId === category.id).length,
  }));

  const hasCategoryError = Boolean(categoriesResponse.error);
  const hasTopicsError = Boolean(topicsResponse.error);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Topics</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage topics under topic categories. Category selection is required for create and edit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700">
            Categories: {categories.length}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700">
            Topics: {topics.length}
          </span>
        </div>
      </div>

      {feedbackMessage ? (
        <p
          className={`rounded-md border px-3 py-2 text-sm ${
            status === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedbackMessage}
        </p>
      ) : null}

      {hasCategoryError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load topic categories: {categoriesResponse.error?.message}
        </p>
      ) : null}

      {hasTopicsError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load topics: {topicsResponse.error?.message}
        </p>
      ) : null}

      {!hasCategoryError && categories.length > 0 ? (
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          {topicsByCategory.map(({ category, count }) => (
            <div key={category.id} className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">{category.slug}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{category.name}</p>
              <p className="mt-1 text-xs text-slate-600">{count} topics</p>
            </div>
          ))}
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Create Topic</h2>
        <form action={createTopicAction} className="mt-3 grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-700">Topic Category *</label>
            <select
              name="categoryId"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              required
              defaultValue=""
              disabled={categories.length === 0}
            >
              <option value="" disabled>
                {categories.length === 0 ? 'No categories available' : 'Select category'}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-700">Topic Name *</label>
            <input
              type="text"
              name="name"
              placeholder="e.g. React"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              required
            />
          </div>
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-700">Slug (optional)</label>
            <input
              type="text"
              name="slug"
              placeholder="react"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <div className="flex items-end md:col-span-1">
            <button
              type="submit"
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={categories.length === 0}
            >
              Add
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Edit or Delete Topics</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {topics.map((topic) => {
            const currentCategory = categoryMap.get(topic.categoryId);
            return (
              <div key={topic.id} className="space-y-3 px-4 py-4">
                <form action={updateTopicAction} className="grid gap-3 lg:grid-cols-12">
                  <input type="hidden" name="id" value={topic.id} />
                  <div className="lg:col-span-4">
                    <label className="mb-1 block text-xs font-medium text-slate-700">Topic Name</label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={topic.name}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      required
                    />
                  </div>
                  <div className="lg:col-span-4">
                    <label className="mb-1 block text-xs font-medium text-slate-700">Topic Category</label>
                    <select
                      name="categoryId"
                      defaultValue={topic.categoryId}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      required
                    >
                      <option value="" disabled>
                        Select category
                      </option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="lg:col-span-3">
                    <label className="mb-1 block text-xs font-medium text-slate-700">Slug</label>
                    <input
                      type="text"
                      name="slug"
                      defaultValue={topic.slug}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </div>
                  <div className="flex items-end lg:col-span-1">
                    <button
                      type="submit"
                      disabled={categories.length === 0}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </form>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>Current category: {currentCategory?.name ?? 'Unassigned'}</span>
                    <span>Slug: {topic.slug || '—'}</span>
                    <span>
                      Updated:{' '}
                      {topic.updatedAt
                        ? new Date(topic.updatedAt).toLocaleDateString()
                        : topic.createdAt
                          ? new Date(topic.createdAt).toLocaleDateString()
                          : '—'}
                    </span>
                  </div>
                  <form action={deleteTopicAction}>
                    <input type="hidden" name="id" value={topic.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
          {topics.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">No topics found.</div>
          ) : null}
        </div>
      </section>

      {categories.length === 0 && !hasCategoryError ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No topic categories found. Create category rows in <code>topic_categories</code> first.
        </p>
      ) : null}

      {topics.some((topic) => !topic.categoryId || !categoryMap.has(topic.categoryId)) ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Some topics are unassigned or linked to missing categories. Edit and save them to fix mapping.
        </p>
      ) : null}
    </div>
  );
}
