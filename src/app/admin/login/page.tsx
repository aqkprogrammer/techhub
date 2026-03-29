'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { LockKeyhole, Shield, UserCog2 } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nextPath = searchParams.get('next');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Invalid email or password.');
        return;
      }
      if (nextPath && nextPath.startsWith('/')) {
        router.replace(nextPath);
      } else {
        router.replace('/admin');
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.2),transparent_55%)]" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl lg:grid-cols-2">
        <div className="hidden border-r border-slate-200 bg-slate-50 p-10 lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Admin Console
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900">
            Operations dashboard
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Manage interview content, topics, users, and access controls from a secure admin workspace.
          </p>
          <div className="mt-8 space-y-3 text-sm text-slate-600">
            <p className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-500" />
              Role-protected access
            </p>
            <p className="flex items-center gap-2">
              <UserCog2 className="h-4 w-4 text-slate-500" />
              User role management
            </p>
            <p className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-slate-500" />
              Secure credential updates
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <h2 className="text-2xl font-semibold text-slate-900">Admin login</h2>
          <p className="mt-2 text-sm text-slate-600">
            Sign in with your admin account to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
                placeholder="admin@company.com"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
                placeholder="••••••••"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm">
            <Link href="/" className="text-slate-600 transition hover:text-slate-900">
              Back to website
            </Link>
            <span className="text-slate-400">Secure admin access</span>
          </div>
        </div>
      </div>
    </div>
  );
}
