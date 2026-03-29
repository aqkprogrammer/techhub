import type { ReactNode } from 'react';
import { headers } from 'next/headers';

import AdminShell from './_components/admin-shell';
import { requireAdminPage } from './_lib/auth';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const headerList = await headers();
  const isLoginPage = headerList.get('x-admin-login') === '1';

  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900">
        {children}
      </div>
    );
  }

  const admin = await requireAdminPage();
  const adminName =
    admin.profile.full_name?.trim() ||
    admin.profile.email ||
    admin.user.email ||
    'Administrator';

  return <AdminShell adminName={adminName}>{children}</AdminShell>;
}
