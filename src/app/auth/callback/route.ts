import { NextResponse } from 'next/server';

import { createSupabaseAuthServerClient } from '@/lib/supabase/server';
import { setAuthCookies } from '@/app/api/auth/_shared';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = createSupabaseAuthServerClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    if (data.session) {
      const response = NextResponse.redirect(`${origin}${next}`);
      setAuthCookies(response, data.session);
      return response;
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
