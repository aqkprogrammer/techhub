'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { supabase } from '@/lib/supabase/client';

type SignupApiResponse = {
  error?: string;
  emailConfirmationRequired?: boolean;
  session?: {
    accessToken: string;
    refreshToken: string;
  } | null;
};

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryError = searchParams.get('error');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const form = new FormData(event.currentTarget);
    const email = form.get('email')?.toString().trim() ?? '';
    const password = form.get('password')?.toString() ?? '';
    const fullName = form.get('fullName')?.toString().trim() ?? '';

    if (!email || !password) {
      setErrorMessage('Enter both email and password.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName: fullName || undefined,
        }),
      });

      const payload = (await response.json()) as SignupApiResponse;
      if (!response.ok) {
        setErrorMessage(payload.error ?? 'Unable to sign you up. Please try again.');
        return;
      }

      if (payload.session) {
        await supabase.auth.setSession({
          access_token: payload.session.accessToken,
          refresh_token: payload.session.refreshToken,
        });
        window.location.assign('/');
        router.refresh();
        return;
      }

      window.location.assign('/login?success=check-email');
    } catch {
      setErrorMessage('Unable to sign you up. Please try again.');
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
        <h1 className="text-2xl font-semibold text-slate-900">Create your account</h1>
        <p className="mt-2 text-sm text-slate-600">Sign up to access techhub.cafe.</p>

        {(queryError || errorMessage) && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage ??
              (queryError === 'missing'
                ? 'Enter both email and password.'
                : queryError === 'config'
                  ? 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.'
                  : 'Unable to sign you up. Please try again.')}
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm text-slate-700">
            Full name
            <input
              name="fullName"
              type="text"
              className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              placeholder="Your name"
              autoComplete="name"
            />
          </label>
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
              minLength={8}
              className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              placeholder="Create a password"
              autoComplete="new-password"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? 'Creating account...' : 'Sign up'}
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
          Already have an account?{' '}
          <Link className="font-semibold text-slate-900" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
