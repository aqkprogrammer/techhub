'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpenText,
  CircleDollarSign,
  LayoutDashboard,
  Settings,
  ShieldQuestion,
  Users,
} from 'lucide-react';

type AdminSidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/questions', label: 'Questions', icon: ShieldQuestion },
  { href: '/admin/topics', label: 'Topics', icon: BookOpenText },
  { href: '/admin/payments', label: 'Payments', icon: CircleDollarSign },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminSidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const widthClass = collapsed ? 'w-[84px]' : 'w-[250px]';

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200 bg-white transition-all md:block ${widthClass}`}
        aria-label="Admin sidebar"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-4 py-4">
            <p className={`text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 ${collapsed ? 'text-center' : ''}`}>
              {collapsed ? 'ADM' : 'Admin Panel'}
            </p>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href !== '/admin' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  } ${collapsed ? 'justify-center' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span>{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[250px] border-r border-slate-200 bg-white transition-transform md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Admin mobile sidebar"
      >
        <div className="border-b border-slate-200 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Admin Panel
          </p>
        </div>
        <nav className="space-y-1 px-2 py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== '/admin' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
