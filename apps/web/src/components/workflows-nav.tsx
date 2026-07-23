'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@erp/ui';

export function WorkflowsNav() {
  const pathname = usePathname();
  const active = pathname === '/workflows' || pathname.startsWith('/workflows/');

  return (
    <nav className="flex items-center gap-1 border-b border-border pb-3">
      <Link
        href="/workflows"
        className={cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          active
            ? 'bg-secondary text-secondary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )}
      >
        Workflows
      </Link>
      <Link
        href="/dashboard"
        className="ml-auto rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        Dashboard
      </Link>
    </nav>
  );
}
