'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';

/**
 * Sales-module shell: a lightweight sub-nav shared by every /sales page.
 *
 * There is no global app shell / top-level nav in the app yet (the dashboard is
 * a standalone page), so this is intentionally a per-module nav rather than a
 * premature full-app chrome. See the agent report — the orchestrator may later
 * add a global module switcher.
 */
const NAV = [
  { href: '/sales/orders', label: 'Orders' },
  { href: '/sales/customers', label: 'Customers' },
];

export default function SalesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
              ERP
            </Link>
            <nav className="flex items-center gap-1">
              {NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          {user ? (
            <button
              type="button"
              onClick={() => void logout()}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Log out
            </button>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
