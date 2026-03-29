import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { jsonError } from '../_utils';

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const workspaceId = searchParams.get('workspaceId') ?? undefined;

  const supabase = createSupabaseServerClient();
  let query = supabase.from('tags').select('id, name, workspace_id').order('name');
  if (workspaceId && workspaceId !== 'all') query = query.eq('workspace_id', workspaceId);
  const { data, error } = await query;

  if (error?.code === '42P01') {
    return NextResponse.json({ items: [] });
  }
  if (error) return jsonError('Failed to load tags.', 500);
  const items = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    workspaceId: row.workspace_id,
  }));
  return NextResponse.json({ items });
}
