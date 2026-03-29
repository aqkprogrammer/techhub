import Link from 'next/link';

import MyProgressPanel from './components/my-progress-panel';

export default function AccountPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[rgb(var(--text))]">Account Overview</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Your interview preparation activity and quick account shortcuts.
        </p>
      </div>

      <MyProgressPanel />

      <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5">
        <p className="text-sm font-semibold text-[rgb(var(--text))]">Quick actions</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/account/settings"
            className="rounded-lg border border-[rgb(var(--border))] px-3 py-2 text-sm text-[rgb(var(--text))] hover:border-[rgb(var(--accent))]"
          >
            Edit profile
          </Link>
          <Link
            href="/account/subscription"
            className="rounded-lg border border-[rgb(var(--border))] px-3 py-2 text-sm text-[rgb(var(--text))] hover:border-[rgb(var(--accent))]"
          >
            Subscription
          </Link>
          <Link
            href="/interview-questions"
            className="rounded-lg border border-[rgb(var(--border))] px-3 py-2 text-sm text-[rgb(var(--text))] hover:border-[rgb(var(--accent))]"
          >
            Continue practice
          </Link>
        </div>
      </div>
    </div>
  );
}
