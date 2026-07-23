'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PERMISSIONS } from '@erp/contracts';
import { useAuth } from '@/lib/auth/auth-context';

/**
 * Section layout for /workflows/*. Unlike Inventory/Sales/etc. (which gate
 * individual create/edit actions but let anyone with a module read
 * permission view lists), the whole workflow API is gated behind the single
 * `admin:workflow.manage` permission (see workflow.controller.ts's
 * class-level `@RequirePermission`) — there's no separate read key. So this
 * layout redirects away entirely for anyone without it, rather than
 * per-button gating within each page. No local section nav — Workflows has
 * exactly one resource, and AppShell's global top nav already links straight
 * to it.
 */
export default function WorkflowsLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isLoading, hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.WORKFLOW_MANAGE);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    } else if (!isLoading && user && !canManage) {
      router.replace('/dashboard');
    }
  }, [isLoading, user, canManage, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!user || !canManage) {
    // Redirect effect will fire; render nothing meanwhile.
    return null;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      {children}
    </main>
  );
}
