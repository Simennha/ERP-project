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
  { href: '/workflows', label: 'Workflows', requiredPermission: PERMISSIONS.WORKFLOW_MANAGE },
];

/**
 * Global, persistent top nav — the "real app shell" from the README's
 * "Suggested next phases" (until now every module rendered its own local
 * "back to dashboard" link and the dashboard hand-linked to each module ad
 * hoc). Mounted once from `Providers`, renders nothing when logged out
 * (same gate as the notification bell it docks). Module links are
 * permission-aware: a user without e.g. finance:invoice.read doesn't see a
 * "Finance" link that would just 403.
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
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
        <Link href="/dashboard" className="shrink-0 text-sm font-semibold tracking-tight">
          ERP System
        </Link>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href.split('?')[0]}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <NotificationBell />
          <span className="hidden text-sm text-muted-foreground sm:inline" title={`${permissions.length} permissions`}>
            {user.name}
          </span>
          <Button variant="outline" size="sm" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
