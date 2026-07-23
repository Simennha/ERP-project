'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle, buttonVariants } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { useDomainEvents } from '@/lib/realtime/use-domain-events';
import { getDashboardSummary, type DashboardWidget } from '@/lib/dashboard/api';
import { WIDGET_RENDERERS } from '@/lib/dashboard/widget-registry';

export default function DashboardPage() {
  const router = useRouter();
  const { user, permissions, isLoading, logout, getAccessToken, hasPermission } = useAuth();
  const [widgets, setWidgets] = useState<DashboardWidget[] | null>(null);

  const loadSummary = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const summary = await getDashboardSummary(token);
      setWidgets(summary.widgets);
    } catch {
      // Best-effort: the account/permissions cards below still render fine
      // without KPIs, so a failed summary fetch isn't a page-level error.
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  // Live refresh: any inventory or sales-order change updates the KPIs
  // without a manual reload — same real-time channel as the Inventory/Sales
  // pages.
  useDomainEvents(useCallback(() => void loadSummary(), [loadSummary]));

  // Redirect to /login once bootstrap has finished and there is no session.
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
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Logged in as {user.name}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory/products" className={buttonVariants({ variant: 'secondary' })}>
            Inventory
          </Link>
          <Link href="/sales/orders" className={buttonVariants({ variant: 'secondary' })}>
            Sales
          </Link>
          <Button variant="outline" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      </div>

      {widgets ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {widgets
            .filter((widget) => !widget.requiredPermission || hasPermission(widget.requiredPermission))
            .map((widget) => {
              const Renderer = WIDGET_RENDERERS[widget.kind];
              return Renderer ? <Renderer key={widget.id} widget={widget} /> : null;
            })}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Name: </span>
            {user.name}
          </p>
          <p>
            <span className="text-muted-foreground">Email: </span>
            {user.email}
          </p>
          <p>
            <span className="text-muted-foreground">Company ID: </span>
            <code>{user.companyId}</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Effective permissions ({permissions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No permissions assigned.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {permissions.map((key) => (
                <li key={key}>
                  <code className="text-xs">{key}</code>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
