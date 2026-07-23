'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@erp/ui';

/**
 * Lightweight tab bar shared across the Finance section pages. Same shape as
 * InventoryNav — no global app-shell/sidebar yet (see inventory-nav.tsx).
 */
const LINKS = [{ href: '/finance/invoices', label: 'Invoices' }] as const;

export function FinanceNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 border-b border-border pb-3">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {link.label}
          </Link>
        );
      })}
      <Link
        href="/dashboard"
        className="ml-auto rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        Dashboard
      </Link>
    </nav>
  );
}
