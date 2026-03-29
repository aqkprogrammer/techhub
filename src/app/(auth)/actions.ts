'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { createSupabaseAuthServerClient } from '@/lib/supabase/server';

const getURL = async () => {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  const headersList = (await headers()) as unknown;
  const getHeader = (name: string): string | null => {
    if (typeof headersList === 'object' && headersList !== null) {
      const typed = headersList as {
        get?: (header: string) => string | null;
        [key: string]: unknown;
      };
      if (typeof typed.get === 'function') {
        return typed.get(name);
      }

      const value = typed[name] ?? typed[name.toLowerCase()];
      if (typeof value === 'string') {
        return value;
      }
    }
    return null;
  };

  const host = getHeader('x-forwarded-host') ?? getHeader('host');
  const protocol = getHeader('x-forwarded-proto') ?? 'http';

  if (!host) {
    return 'http://localhost:3000';
  }

  return `${protocol}://${host}`;
};

export async function signInWithPassword(formData: FormData) {
  const email = formData.get('email')?.toString();
  const password = formData.get('password')?.toString();
  const next = formData.get('next')?.toString();

  if (!email || !password) {
    redirect('/login?error=missing');
  }

  const supabase = createSupabaseAuthServerClient();
  if (!supabase) redirect('/login?error=config');

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect('/login?error=invalid');
  }

  if (next && next.startsWith('/') && !next.startsWith('//')) {
    redirect(next);
  }
  redirect('/');
}

export async function signUpWithPassword(formData: FormData) {
  const email = formData.get('email')?.toString();
  const password = formData.get('password')?.toString();

  if (!email || !password) {
    redirect('/signup?error=missing');
  }

  const supabase = createSupabaseAuthServerClient();
  if (!supabase) redirect('/signup?error=config');

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await getURL()}/auth/callback`,
    },
  });

  if (error) {
    redirect('/signup?error=invalid');
  }

  redirect('/login?success=check-email');
}

export async function signInWithGoogle() {
  const supabase = createSupabaseAuthServerClient();
  if (!supabase) redirect('/login?error=config');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${await getURL()}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect('/login?error=oauth');
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = createSupabaseAuthServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect('/login');
}
