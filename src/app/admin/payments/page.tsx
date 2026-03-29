import Link from 'next/link';
import { BarChart3, ReceiptText, Search } from 'lucide-react';

import { createSupabaseServerClient } from '@/lib/supabase/server';

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

const DEFAULT_LIMIT = 20;

function readParam(params: SearchParams | undefined, key: string) {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function toNumber(value: string, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function toAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'paid' || normalized === 'active') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (normalized === 'created' || normalized === 'pending') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (normalized === 'failed' || normalized === 'canceled') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function buildHref({
  page,
  status,
  email,
  limit,
  payment,
}: {
  page: number;
  status: string;
  email: string;
  limit: number;
  payment?: string;
}) {
  const query = new URLSearchParams();
  if (status && status !== 'all') query.set('status', status);
  if (email) query.set('email', email);
  if (limit !== DEFAULT_LIMIT) query.set('limit', String(limit));
  if (page > 1) query.set('page', String(page));
  if (payment) query.set('payment', payment);
  const qs = query.toString();
  return qs ? `/admin/payments?${qs}` : '/admin/payments';
}

async function loadStatusCount(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  status?: string,
) {
  let query = supabase.from('payments').select('id', { count: 'exact', head: true });
  if (status) {
    query = query.eq('status', status);
  }
  const { count } = await query;
  return count ?? 0;
}

export default async function AdminPaymentsPage({ searchParams }: PageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;

  const status = readParam(resolvedParams, 'status').trim().toLowerCase() || 'all';
  const emailSearch = readParam(resolvedParams, 'email').trim();
  const selectedPaymentId = readParam(resolvedParams, 'payment').trim();
  const page = toNumber(readParam(resolvedParams, 'page'), 1, 9999);
  const limit = toNumber(readParam(resolvedParams, 'limit'), DEFAULT_LIMIT, 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = createSupabaseServerClient();

  let matchedProfiles: Array<{ id: string; email: string | null; full_name: string | null }> = [];
  if (emailSearch) {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .ilike('email', `%${emailSearch}%`)
      .limit(200);
    matchedProfiles = (data ?? []) as typeof matchedProfiles;
  }

  const matchedUserIds = matchedProfiles.map((item) => item.id);
  const shouldReturnEmpty = emailSearch.length > 0 && matchedUserIds.length === 0;

  let rows: Record<string, unknown>[] = [];
  let total = 0;

  if (!shouldReturnEmpty) {
    let query = supabase
      .from('payments')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (matchedUserIds.length > 0) {
      query = query.in('user_id', matchedUserIds);
    }

    let result = await query;
    if (result.error) {
      let retry = supabase
        .from('payments')
        .select('*', { count: 'exact' })
        .range(from, to);

      if (status !== 'all') retry = retry.eq('status', status);
      if (matchedUserIds.length > 0) retry = retry.in('user_id', matchedUserIds);
      result = await retry;
    }

    rows = ((result.data ?? []) as Record<string, unknown>[]) ?? [];
    total = result.count ?? rows.length;
  }

  const pageCount = Math.max(1, Math.ceil(total / limit));
  const uniqueUserIds = Array.from(
    new Set(
      rows
        .map((row) => (typeof row.user_id === 'string' ? row.user_id : null))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  let profileRows = matchedProfiles;
  if (uniqueUserIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', uniqueUserIds);
    profileRows = (data ?? []) as typeof profileRows;
  }

  const profileMap = new Map(
    profileRows.map((profile) => [profile.id, profile]),
  );

  const [totalPayments, paidPayments, createdPayments, failedPayments] = await Promise.all([
    loadStatusCount(supabase),
    loadStatusCount(supabase, 'paid'),
    loadStatusCount(supabase, 'created'),
    loadStatusCount(supabase, 'failed'),
  ]);

  const { data: paidRevenueRows } = await supabase
    .from('payments')
    .select('amount')
    .eq('status', 'paid')
    .limit(5000);

  const revenueByCurrency = ((paidRevenueRows ?? []) as Array<{ amount?: unknown; currency?: unknown }>).reduce(
    (acc, row) => {
      const currency = typeof row.currency === 'string' ? row.currency.toUpperCase() : 'INR';
      const amount = toAmount(row.amount);
      acc[currency] = (acc[currency] ?? 0) + amount;
      return acc;
    },
    {} as Record<string, number>,
  );
  const grossRevenueInr = revenueByCurrency.INR ?? 0;
  const grossRevenueUsd = revenueByCurrency.USD ?? 0;

  const selectedRow =
    rows.find((row) => typeof row.id === 'string' && row.id === selectedPaymentId) ??
    null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Payments</h1>
          <p className="mt-1 text-sm text-slate-600">
            Monitor transactions, verify status, and track subscription revenue.
          </p>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Payments</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{totalPayments.toLocaleString()}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Paid</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{paidPayments.toLocaleString()}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Created</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">{createdPayments.toLocaleString()}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Gross Revenue</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            ₹{grossRevenueInr.toLocaleString()} / ${grossRevenueUsd.toLocaleString()}
          </p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form className="grid gap-3 md:grid-cols-12">
          <label className="md:col-span-5">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search by email</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <input
                name="email"
                defaultValue={emailSearch}
                placeholder="candidate@company.com"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm"
              />
            </div>
          </label>

          <label className="md:col-span-3">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
            <select
              name="status"
              defaultValue={status}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="created">Created</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
            </select>
          </label>

          <input type="hidden" name="limit" value={String(limit)} />
          <div className="md:col-span-4 flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              <Search className="h-4 w-4" />
              Apply filters
            </button>
            <Link
              href="/admin/payments"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>

      {selectedRow ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Payment Details
            </h2>
            <Link href={buildHref({ page, status, email: emailSearch, limit })} className="text-xs text-slate-600 hover:underline">
              Close
            </Link>
          </div>
          <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
            {JSON.stringify(selectedRow, null, 2)}
          </pre>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No payments found for the current filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const id = typeof row.id === 'string' ? row.id : '';
                  const userId = typeof row.user_id === 'string' ? row.user_id : '';
                  const profile = userId ? profileMap.get(userId) : null;
                  const email = profile?.email ?? 'Unknown user';
                  const name = profile?.full_name?.trim() || 'User';
                  const plan =
                    (typeof row.plan === 'string' && row.plan) ||
                    (typeof row.plan_type === 'string' && row.plan_type) ||
                    'N/A';
                  const amount = toAmount(row.amount);
                  const currency = typeof row.currency === 'string' ? row.currency.toUpperCase() : '';
                  const statusValue = typeof row.status === 'string' ? row.status : 'unknown';
                  const createdAtRaw =
                    (typeof row.created_at === 'string' && row.created_at) ||
                    (typeof row.updated_at === 'string' && row.updated_at) ||
                    '';
                  const createdAt = createdAtRaw ? new Date(createdAtRaw) : null;

                  return (
                    <tr key={id || `${plan}-${createdAtRaw}-${amount}`} className="align-top">
                      <td className="px-4 py-4">
                        <p className="text-sm font-medium text-slate-900">{name}</p>
                        <p className="text-xs text-slate-500">{email}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{plan}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {currency === 'USD' ? '$' : '₹'}
                        {amount.toLocaleString()}
                        <span className="ml-1 text-xs text-slate-500">{currency || 'INR'}</span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(statusValue)}`}>
                          {statusValue}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {createdAt ? createdAt.toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={buildHref({
                              page,
                              status,
                              email: emailSearch,
                              limit,
                              payment: id,
                            })}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            <ReceiptText className="h-3.5 w-3.5" />
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="text-sm text-slate-600">
          Showing page {page} of {pageCount} • {total.toLocaleString()} result(s)
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={buildHref({
              page: Math.max(1, page - 1),
              status,
              email: emailSearch,
              limit,
              payment: selectedPaymentId || undefined,
            })}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              page <= 1
                ? 'pointer-events-none border-slate-200 text-slate-300'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Previous
          </Link>
          <Link
            href={buildHref({
              page: Math.min(pageCount, page + 1),
              status,
              email: emailSearch,
              limit,
              payment: selectedPaymentId || undefined,
            })}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              page >= pageCount
                ? 'pointer-events-none border-slate-200 text-slate-300'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Next
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
          <BarChart3 className="h-4 w-4" />
          Revenue Snapshot
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Paid payments: <span className="font-semibold text-slate-900">{paidPayments.toLocaleString()}</span> · Failed payments:{' '}
          <span className="font-semibold text-slate-900">{failedPayments.toLocaleString()}</span>
        </p>
      </section>
    </div>
  );
}
