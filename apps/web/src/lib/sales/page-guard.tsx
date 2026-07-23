'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

/**
 * Shared client-side gate for the Sales pages, factoring out the redirect +
 * permission pattern used on the dashboard. While the session is bootstrapping
 * it renders a "Loading…" placeholder; once bootstrap finishes with no session
 * it redirects to /login; if the user lacks `permission` it renders an
 * access-denied message; otherwise it renders `children`.
 *
 * This is purely a UX convenience — the API is the real authority and
 * re-checks every permission server-side.
 */
export function RequirePermissionPage({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading, hasPermission } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (!user) {
    return null;
  }
  if (!hasPermission(permission)) {
    return (
      <div className="rounded-md border border-border p-6">
        <p className="text-sm font-medium">Access denied</p>
        <p className="mt-1 text-sm text-muted-foreground">
          You do not have the <code className="text-xs">{permission}</code> permission.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
