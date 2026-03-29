import Link from 'next/link';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { updateUserRoleAction } from '../actions';

type UsersPageProps = {
  searchParams?:
    | {
        q?: string;
      }
    | Promise<{
        q?: string;
      }>;
};

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  created_at: string | null;
};

export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = resolvedSearchParams?.q?.trim() ?? '';
  const supabase = createSupabaseServerClient();

  let usersQuery = supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (query) {
    usersQuery = usersQuery.ilike('email', `%${query}%`);
  }

  const { data, error } = await usersQuery;
  const users = (data ?? []) as UserRow[];

  const now = new Date().toISOString();
  const { data: subsData } = await supabase
    .from('subscriptions')
    .select('user_id, is_lifetime, expires_at')
    .or(`is_lifetime.eq.true,expires_at.gt.${now}`);

  const paidUserIds = new Set((subsData ?? []).map((s) => s.user_id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-600">
            Search users and manage admin privileges.
          </p>
        </div>
        <Link
          href="/admin/users"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Reset Search
        </Link>
      </div>

      <form method="GET" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Search by email
          <div className="mt-2 flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="user@example.com"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Search
            </button>
          </div>
        </label>
      </form>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load users: {error.message}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Plan
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Joined
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const isAdmin = user.role === 'admin';
                const isPaid = paidUserIds.has(user.id);
                return (
                  <tr key={user.id}>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-900">{user.full_name || 'Unnamed user'}</p>
                      <p className="text-sm text-slate-600">{user.email ?? 'No email'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          isAdmin
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-slate-300 bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isAdmin ? 'admin' : 'user'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          isPaid
                            ? 'border-violet-300 bg-violet-50 text-violet-700'
                            : 'border-slate-300 bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isPaid ? 'paid' : 'free'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-4">
                      <form action={updateUserRoleAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="role" value={isAdmin ? 'user' : 'admin'} />
                        <button
                          type="submit"
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                            isAdmin
                              ? 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                              : 'bg-slate-900 text-white hover:bg-slate-700'
                          }`}
                        >
                          {isAdmin ? 'Demote to user' : 'Promote to admin'}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    No users found for this query.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
