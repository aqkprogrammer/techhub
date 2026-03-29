import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { jsonError, requireAdmin } from '../../_utils';

function getTagName(row: Record<string, unknown>): string {
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

  const { data, error } = await supabase.from('tags').select('*');
  if (error) return jsonError(error.message || 'Failed to load tags.', 500);

  const rows = (data ?? []) as Record<string, unknown>[];
  const hasWorkspaceColumn = rows.some((row) => Object.prototype.hasOwnProperty.call(row, 'workspace_id'));
  const filteredRows =
    workspaceId && hasWorkspaceColumn
      ? rows.filter((row) => getWorkspaceId(row) === workspaceId)
      : rows;

  const items = filteredRows
    .map((row) => {
      const id = typeof row.id === 'string' ? row.id : '';
      const name = getTagName(row);
      if (!id || !name) return null;
      return {
        id,
        name,
        workspaceId: getWorkspaceId(row),
      };
    })
    .filter(
      (item): item is { id: string; name: string; workspaceId: string } => Boolean(item),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ items, total: items.length });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId.trim() : '';
  if (!name) return jsonError('Tag name is required.');

  const supabase = createSupabaseServerClient();
  const { response } = await requireAdmin(supabase, { request });
  if (response) return response;

  let { data, error } = await supabase
    .from('tags')
    .insert({ name, workspace_id: workspaceId || null })
    .select('*')
    .single();

  if (error && error.code === '42703') {
    const retry = await supabase.from('tags').insert({ name }).select('*').single();
    data = retry.data;
    error = retry.error;
  }

  if (error && error.code === '23505') {
    const existing = await supabase.from('tags').select('*').ilike('name', name).limit(1).maybeSingle();
    if (!existing.error && existing.data) {
      return NextResponse.json(existing.data, { status: 200 });
    }
  }

  if (error || !data) return jsonError(error?.message || 'Failed to create tag.', 500);
  return NextResponse.json(data, { status: 201 });
}
