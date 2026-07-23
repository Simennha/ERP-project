'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { ProcurementNav } from '@/components/procurement-nav';

/**
 * Section layout for /procurement/*. Handles the shared "must be signed in"
 * redirect once (matching the dashboard page's pattern) and renders the
 * section nav above every procurement page. Per-page permission checks
 * (create/edit/delete) are still done in each page via
 * `useAuth().hasPermission(...)`.
 */
export default function ProcurementLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!user) {
    // Redirect effect will fire; render nothing meanwhile.
    return null;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <ProcurementNav />
      {children}
    </main>
  );
}
