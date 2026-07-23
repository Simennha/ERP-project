'use client';

import Link from 'next/link';

/**
 * Section header for the Projects module. Unlike Inventory (multiple
 * resources: products/warehouses/stock), Projects has exactly one resource
 * and `/projects` itself is already the list page, so there's no self-link
 * to render — just the shared "back to dashboard" link, matching
 * InventoryNav's `ml-auto` treatment.
 */
export function ProjectsNav() {
  return (
    <nav className="flex items-center gap-1 border-b border-border pb-3">
      <Link
        href="/dashboard"
        className="ml-auto rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        Dashboard
      </Link>
    </nav>
  );
}
