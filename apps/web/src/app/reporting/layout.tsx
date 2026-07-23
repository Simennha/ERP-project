import type { ReactNode } from 'react';

/**
 * Section layout for /reporting/*. No auth-gating here — each page uses
 * `RequirePermissionPage` (see lib/auth/require-permission-page.tsx) for
 * both the "must be signed in" redirect and the "lacks permission" message,
 * matching the Sales module's pattern. No local nav — Reporting has exactly
 * one resource, and AppShell's global top nav already links straight to it.
 */
export default function ReportingLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      {children}
    </main>
  );
}
