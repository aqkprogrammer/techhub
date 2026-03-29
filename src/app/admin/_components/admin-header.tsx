'use client';

import Link from 'next/link';
import { Menu, PanelLeftClose, PanelLeftOpen, ShieldUser } from 'lucide-react';

import { adminLogoutAction } from '../actions';

type AdminHeaderProps = {
  adminName: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMobile: () => void;
};

export default function AdminHeader({
  adminName,
  collapsed,
  onToggleCollapsed,
  onOpenMobile,
}: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenMobile}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 md:inline-flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
          <div className="flex items-center gap-2 text-slate-700">
            <ShieldUser className="h-4 w-4 text-slate-500" />
            <p className="text-sm font-medium">{adminName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/settings"
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Change Password
          </Link>
          <form action={adminLogoutAction}>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Logout
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
