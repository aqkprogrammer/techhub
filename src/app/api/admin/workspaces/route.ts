import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/app/api/account/_auth';

import { jsonError, requireAdmin } from '../../_utils';

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const { response } = await requireAdmin(supabase, { request });
  if (response) return response;

  const { data, error } = await supabase
    .from('workspaces')
    .select('id, name')
    .order('name');

  if (error && error.code !== '42P01') {
    return jsonError('Failed to load workspaces.', 500);
  }

  if (error?.code === '42P01') {
    // Backward compatibility: derive workspace ids from existing taxonomy tables when workspaces table is absent.
    const [topicsResponse, companiesResponse, tagsResponse] = await Promise.all([
      supabase.from('topics').select('workspace_id'),
      supabase.from('companies').select('workspace_id'),
      supabase.from('tags').select('workspace_id'),
    ]);

    const ids = new Set<string>();
    for (const responseItem of [topicsResponse, companiesResponse, tagsResponse]) {
      const rows = (responseItem.data ?? []) as Array<{ workspace_id?: string | null }>;
      rows.forEach((row) => {
        if (typeof row.workspace_id === 'string' && row.workspace_id) {
          ids.add(row.workspace_id);
        }
      });
    }

    const derivedItems = Array.from(ids)
      .map((id) => ({
        id,
        name: `Workspace ${id.slice(0, 8)}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      items: derivedItems,
      warning:
        derivedItems.length > 0
          ? null
          : 'workspaces table is missing. Create it if you need explicit workspace management.',
    });
  }

  const items = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
  }));
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name || name.length < 1) return jsonError('Name is required.');

  const supabase = createSupabaseServerClient();
  const { response } = await requireAdmin(supabase, { request });
  if (response) return response;
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await supabase
    .from('workspaces')
    .insert({ name, owner_id: auth.user.id })
    .select('id, name')
    .single();

  if (error?.code === '42P01') {
    return jsonError(
      'workspaces table is missing. Create it first or continue by selecting topics/companies without workspace management.',
      400,
    );
  }

  if (error) return jsonError('Failed to create workspace.', 500);
  return NextResponse.json(data, { status: 201 });
}
