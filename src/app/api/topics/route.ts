import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const revalidate = 300;

type TopicCategoryRow = {
  id: string;
  name?: string | null;
  title?: string | null;
  slug?: string | null;
  icon?: string | null;
};

type TopicRow = {
  id: string;
  name?: string | null;
  title?: string | null;
  workspace_id?: string | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function getTopicName(row: TopicRow): string {
  const value = typeof row.name === 'string' && row.name.trim()
    ? row.name
    : typeof row.title === 'string' && row.title.trim()
      ? row.title
      : '';
  return value.trim();
}

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const searchParams = new URL(request.url).searchParams;
  const workspaceId = searchParams.get('workspaceId');

  if (workspaceId) {
    const { data, error } = await supabase.from('topics').select('*');

    if (error) {
      console.error('Supabase error in /api/topics workspace query:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as TopicRow[];
    const hasWorkspaceColumn = rows.some((row) => Object.prototype.hasOwnProperty.call(row, 'workspace_id'));

    const filteredRows =
      workspaceId === 'all'
        ? rows
        : hasWorkspaceColumn
          ? rows.filter((row) => !row.workspace_id || row.workspace_id === workspaceId)
          : rows;

    const items = filteredRows
      .map((topic) => {
        const name = getTopicName(topic);
        if (!name) return null;
        return {
          id: topic.id,
          name,
          workspaceId: topic.workspace_id ?? '',
          slug: slugify(name),
        };
      })
      .filter(
        (
          topic,
        ): topic is { id: string; name: string; workspaceId: string; slug: string } =>
          Boolean(topic),
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ items, total: items.length });
  }

  const { data, error } = await supabase
    .from('topic_categories')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Supabase error in /api/topics category query:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const topics = ((data ?? []) as TopicCategoryRow[])
    .map((row) => {
      const name = (row.name ?? row.title ?? '').trim();
      const slug = (row.slug ?? '').trim() || slugify(name);
      if (!name || !slug) return null;

      return {
        id: row.id,
        name,
        slug,
        icon: row.icon ?? null,
      };
    })
    .filter((topic): topic is { id: string; name: string; slug: string; icon: string | null } => Boolean(topic));

  return NextResponse.json({
    topics,
    total: topics.length,
  });
}
