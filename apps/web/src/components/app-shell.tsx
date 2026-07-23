'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PERMISSIONS } from '@erp/contracts';
import { Button, cn } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { NotificationBell } from './notification-bell';

interface NavItem {
  href: string;
  label: string;
  /** Shown only if the user holds this permission; omit to always show. */
  requiredPermission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/inventory/products', label: 'Inventory', requiredPermission: PERMISSIONS.INVENTORY_PRODUCT_READ },
  { href: '/sales/orders', label: 'Sales', requiredPermission: PERMISSIONS.SALES_ORDER_READ },
  { href: '/finance/invoices', label: 'Finance', requiredPermission: PERMISSIONS.FINANCE_INVOICE_READ },
  { href: '/hr/employees', label: 'HR', requiredPermission: PERMISSIONS.HR_EMPLOYEE_READ },
  { href: '/procurement/purchase-orders', label: 'Procurement', requiredPermission: PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_READ },
  { href: '/projects', label: 'Projects', requiredPermission: PERMISSIONS.PROJECTS_PROJECT_READ },
  { href: '/reporting/reports', label: 'Reporting', requiredPermission: PERMISSIONS.REPORTING_REPORT_READ },
  { href: '/workflows', label: 'Workflows', requiredPermission: PERMISSIONS.WORKFLOW_MANAGE },
  { href: '/admin', label: 'Admin', requiredPermission: PERMISSIONS.USERS_MANAGE },
];

/** First letter of each word in a name, e.g. "Ada Admin" -> "AA", max 2 chars. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.length >= 2 ? [parts[0], parts[parts.length - 1]] : parts;
  return chars.map((p) => p?.[0]?.toUpperCase() ?? '').join('') || '?';
}

/**
 * Global, persistent top "shell bar" — the "real app shell" from the
 * README's "Suggested next phases" (until now every module rendered its own
 * local "back to dashboard" link and the dashboard hand-linked to each
 * module ad hoc). Styled after SAP Fiori's shell bar: a permanently dark
 * navy bar (independent of the app's own light/dark theme — see globals.css'
 * `--shell-*` tokens), sticky at the top of the viewport, with a square logo
 * mark and initials avatar rather than the previous plain white header.
 * Mounted once from `Providers`, renders nothing when logged out (same gate
 * as the notification bell it docks). Module links are permission-aware: a
 * user without e.g. finance:invoice.read doesn't see a "Finance" link that
 * would just 403.
 *
 * Section-level sub-navigation (Inventory's Products/Warehouses/Stock tabs,
 * Sales's Orders/Customers tabs) still lives in each section's own layout —
 * that's real multi-page navigation within a module, a different concern
 * from top-level module switching.
 */
export function AppShell() {
  const { user, permissions, hasPermission, logout } = useAuth();
  const pathname = usePathname();

  if (!user) {
    return null;
  }

  const items = NAV_ITEMS.filter(
    (item) => !item.requiredPermission || hasPermission(item.requiredPermission),
  );

  return (
    <header className="sticky top-0 z-40 border-b border-shell-border bg-shell text-shell-foreground">
      <div className="flex w-full items-center gap-3 px-4 py-2.5">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center bg-primary text-sm font-bold text-primary-foreground">
            E
          </span>
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">ERP System</span>
        </Link>

        <span aria-hidden="true" className="hidden h-5 w-px shrink-0 bg-shell-border md:block" />

        <nav aria-label="Main navigation" className="flex flex-1 items-center gap-0.5 overflow-x-auto">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href.split('?')[0]}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'shrink-0 whitespace-nowrap border-b-2 px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  active
                    ? 'border-primary bg-shell-accent text-shell-foreground'
                    : 'border-transparent text-shell-foreground/70 hover:bg-shell-accent hover:text-shell-foreground',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <NotificationBell />
          <div className="flex items-center gap-2" title={`${permissions.length} permissions`}>
            <span className="flex h-7 w-7 items-center justify-center bg-shell-accent text-xs font-semibold text-shell-foreground">
              {initials(user.name)}
            </span>
            <span className="hidden text-sm text-shell-foreground/80 lg:inline">{user.name}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void logout()}
            className="text-shell-foreground hover:bg-shell-accent hover:text-shell-foreground"
          >
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
