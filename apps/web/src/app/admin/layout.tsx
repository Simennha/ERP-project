'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

/**
 * Section layout for /admin/*. Matches the Workflows layout's "must be
 * signed in" pattern (own <main id="main-content"> landmark, matching every
 * other module) — per-page permission gating (RequirePermissionPage) still
 * handles the actual admin:users.manage check and its "Access denied" UI.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <main id="main-content" className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main id="main-content" className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      {children}
    </main>
  );
}
