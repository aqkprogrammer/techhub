import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ total: 0, source: 'fallback' });
  }

  const { count, error } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.error('Supabase error in /api/questions/count:', error);
    return NextResponse.json({ error: 'Failed to load question count.' }, { status: 500 });
  }

  return NextResponse.json({ total: typeof count === 'number' ? count : 0 });
}
