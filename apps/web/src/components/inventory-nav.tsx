'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@erp/ui';

/**
 * Lightweight sub-tab bar for the Inventory section's own pages
 * (Products/Warehouses/Stock) — real multi-page navigation within the
 * module, distinct from top-level module switching (AppShell's global nav
 * already links to /inventory/products, so no "back to Dashboard" link is
 * needed here).
 */
const LINKS = [
  { href: '/inventory/products', label: 'Products' },
  { href: '/inventory/warehouses', label: 'Warehouses' },
  { href: '/inventory/stock', label: 'Stock' },
] as const;

export function InventoryNav() {
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
    </nav>
  );
}
