import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { jsonError, requireAdmin } from '../../_utils';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function getTopicName(row: Record<string, unknown>): string {
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (name) return name;
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  return title;
}

function getWorkspaceId(row: Record<string, unknown>): string {
  return typeof row.workspace_id === 'string' ? row.workspace_id : '';
}

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const { response } = await requireAdmin(supabase, { request });
  if (response) return response;

  const searchParams = new URL(request.url).searchParams;
  const workspaceId = searchParams.get('workspaceId') ?? '';

  const { data, error } = await supabase.from('topics').select('*');
  if (error) return jsonError(error.message || 'Failed to load topics.', 500);

  const rows = (data ?? []) as Record<string, unknown>[];
  const hasWorkspaceColumn = rows.some((row) => Object.prototype.hasOwnProperty.call(row, 'workspace_id'));
  const filteredRows =
    workspaceId && hasWorkspaceColumn
      ? rows.filter((row) => getWorkspaceId(row) === workspaceId)
      : rows;

  const items = filteredRows
    .map((row) => {
      const id = typeof row.id === 'string' ? row.id : '';
      const name = getTopicName(row);
      if (!id || !name) return null;

      return {
        id,
        name,
        workspaceId: getWorkspaceId(row),
        slug: typeof row.slug === 'string' && row.slug.trim() ? row.slug : slugify(name),
      };
    })
    .filter(
      (
        item,
      ): item is { id: string; name: string; workspaceId: string; slug: string } => Boolean(item),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ items, total: items.length });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId.trim() : '';
  if (!name) return jsonError('Topic name is required.');

  const supabase = createSupabaseServerClient();
  const { response } = await requireAdmin(supabase, { request });
  if (response) return response;

  let insertPayload: Record<string, unknown> = {
    name,
    workspace_id: workspaceId || null,
  };

  let { data, error } = await supabase
    .from('topics')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error && error.code === '42703') {
    insertPayload = {
      title: name,
      slug: slugify(name),
      workspace_id: workspaceId || null,
    };
    const retry = await supabase.from('topics').insert(insertPayload).select('*').single();
    data = retry.data;
    error = retry.error;
  }

  if (error && error.code === '42703') {
    insertPayload = {
      title: name,
      slug: slugify(name),
    };
    const finalRetry = await supabase.from('topics').insert(insertPayload).select('*').single();
    data = finalRetry.data;
    error = finalRetry.error;
  }

  if (error || !data) return jsonError(error?.message || 'Failed to create topic.', 500);
  return NextResponse.json(data, { status: 201 });
}
