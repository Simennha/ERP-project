'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@erp/ui';

/**
 * Sales-module layout: a lightweight sub-nav for the section's own pages
 * (Orders/Customers) — real multi-page navigation within the module, distinct
 * from top-level module switching (AppShell's global top nav + logout cover
 * that now, so this no longer hand-rolls its own header/logo/logout).
 */
const NAV = [
  { href: '/sales/orders', label: 'Orders' },
  { href: '/sales/customers', label: 'Customers' },
];

export default function SalesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <nav className="flex items-center gap-1 border-b border-border pb-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </main>
  );
}
