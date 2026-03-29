'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase/client';

type LoginApiResponse = {
  error?: string;
  session?: {
    accessToken: string;
    refreshToken: string;
  };
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const next = useMemo(() => {
    const value = searchParams.get('next');
    return value && value.startsWith('/') ? value : '/';
  }, [searchParams]);

  const queryError = searchParams.get('error');
  const querySuccess = searchParams.get('success');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const form = new FormData(event.currentTarget);
    const email = form.get('email')?.toString().trim() ?? '';
    const password = form.get('password')?.toString() ?? '';

    if (!email || !password) {
      setErrorMessage('Enter both email and password.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as LoginApiResponse;
      if (!response.ok) {
        setErrorMessage(payload.error ?? 'Unable to sign you in. Please try again.');
        return;
      }

      if (payload.session) {
        await supabase.auth.setSession({
          access_token: payload.session.accessToken,
          refresh_token: payload.session.refreshToken,
        });
      }

      window.location.assign(next);
      router.refresh();
    } catch {
      setErrorMessage('Unable to sign you in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const signInWithGoogle = async () => {
    setErrorMessage(null);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error || !data.url) {
      setErrorMessage('Unable to start Google sign in. Please try again.');
      return;
    }
    window.location.assign(data.url);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to your techhub.cafe account.</p>

        {(queryError || errorMessage) && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage ??
              (queryError === 'missing'
                ? 'Enter both email and password.'
                : queryError === 'config'
                  ? 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.'
                  : 'Unable to sign you in. Please try again.')}
          </p>
        )}

        {querySuccess === 'check-email' && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Check your email to confirm your account.
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm text-slate-700">
            Email
            <input
              name="email"
              type="email"
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              placeholder="you@company.com"
              autoComplete="email"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-700">
            Password
            <input
              name="password"
              type="password"
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          onClick={signInWithGoogle}
          className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-sm text-slate-600">
          New here?{' '}
          <Link className="font-semibold text-slate-900" href="/signup">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
