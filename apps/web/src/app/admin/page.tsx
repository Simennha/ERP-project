'use client';

import { PERMISSIONS } from '@erp/contracts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@erp/ui';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';

interface RoleGuide {
  name: string;
  summary: string;
  permissions: string[];
  blocked: string;
}

/**
 * Illustrative role templates, not live data — there is no Users/Roles admin
 * UI yet, so today only two roles actually exist in the database: the seeded
 * "Owner" (every permission) and the ad-hoc "Staff" role created by
 * packages/database/prisma/create-test-user.ts. These are reference
 * combinations of the real PERMISSIONS keys for when that admin UI exists.
 */
const ROLE_GUIDES: RoleGuide[] = [
  {
    name: 'Owner / Administrator',
    summary: 'Full control: every business module plus admin-only capabilities like workflow automation and (once built) user/role management.',
    permissions: ['All permissions'],
    blocked: 'Nothing',
  },
  {
    name: 'Sales Representative',
    summary: 'Runs the customer and order lifecycle, checks product availability before promising it.',
    permissions: [
      PERMISSIONS.SALES_ORDER_READ,
      PERMISSIONS.SALES_ORDER_CREATE,
      PERMISSIONS.SALES_ORDER_UPDATE,
      PERMISSIONS.SALES_ORDER_DELETE,
      PERMISSIONS.SALES_CUSTOMER_READ,
      PERMISSIONS.SALES_CUSTOMER_CREATE,
      PERMISSIONS.SALES_CUSTOMER_UPDATE,
      PERMISSIONS.SALES_CUSTOMER_DELETE,
      PERMISSIONS.INVENTORY_PRODUCT_READ,
    ],
    blocked: 'Stock adjustments, Finance, HR, Procurement, Workflows',
  },
  {
    name: 'Warehouse / Inventory Staff',
    summary: 'Owns the product catalog, warehouses, and stock levels.',
    permissions: [
      PERMISSIONS.INVENTORY_PRODUCT_READ,
      PERMISSIONS.INVENTORY_PRODUCT_CREATE,
      PERMISSIONS.INVENTORY_PRODUCT_UPDATE,
      PERMISSIONS.INVENTORY_PRODUCT_DELETE,
      PERMISSIONS.INVENTORY_STOCK_ADJUST,
      PERMISSIONS.INVENTORY_WAREHOUSE_MANAGE,
    ],
    blocked: 'Creating sales orders, customer or financial data',
  },
  {
    name: 'Accountant / Finance',
    summary: 'Manages invoice status and reconciles it against the sales orders it traces back to.',
    permissions: [
      PERMISSIONS.FINANCE_INVOICE_READ,
      PERMISSIONS.FINANCE_INVOICE_CREATE,
      PERMISSIONS.FINANCE_INVOICE_UPDATE,
      PERMISSIONS.FINANCE_INVOICE_DELETE,
      PERMISSIONS.SALES_ORDER_READ,
      PERMISSIONS.REPORTING_REPORT_READ,
      PERMISSIONS.REPORTING_REPORT_CREATE,
    ],
    blocked: 'Creating sales orders, inventory, HR',
  },
  {
    name: 'HR Manager',
    summary: 'Full employee lifecycle management. Fully siloed from every other module today.',
    permissions: [
      PERMISSIONS.HR_EMPLOYEE_READ,
      PERMISSIONS.HR_EMPLOYEE_CREATE,
      PERMISSIONS.HR_EMPLOYEE_UPDATE,
      PERMISSIONS.HR_EMPLOYEE_DELETE,
      PERMISSIONS.REPORTING_REPORT_READ,
    ],
    blocked: 'Every other module',
  },
  {
    name: 'Procurement Officer',
    summary: 'Manages vendor purchase orders, checks stock levels to decide what to reorder.',
    permissions: [
      PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_READ,
      PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_CREATE,
      PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_UPDATE,
      PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_DELETE,
      PERMISSIONS.INVENTORY_PRODUCT_READ,
      PERMISSIONS.REPORTING_REPORT_READ,
    ],
    blocked: 'Adjusting stock directly, Sales, Finance',
  },
  {
    name: 'Project Manager',
    summary: 'Full project lifecycle tracking. Also fully siloed from other modules today.',
    permissions: [
      PERMISSIONS.PROJECTS_PROJECT_READ,
      PERMISSIONS.PROJECTS_PROJECT_CREATE,
      PERMISSIONS.PROJECTS_PROJECT_UPDATE,
      PERMISSIONS.PROJECTS_PROJECT_DELETE,
      PERMISSIONS.REPORTING_REPORT_READ,
    ],
    blocked: 'Every other module',
  },
  {
    name: 'Executive / Read-only viewer',
    summary: 'Sees everything, changes nothing. This is what the create-test-user.ts "Staff" role approximates today.',
    permissions: [
      PERMISSIONS.INVENTORY_PRODUCT_READ,
      PERMISSIONS.SALES_ORDER_READ,
      PERMISSIONS.SALES_CUSTOMER_READ,
      PERMISSIONS.FINANCE_INVOICE_READ,
      PERMISSIONS.HR_EMPLOYEE_READ,
      PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_READ,
      PERMISSIONS.PROJECTS_PROJECT_READ,
      PERMISSIONS.REPORTING_REPORT_READ,
    ],
    blocked: 'Every create/update/delete action, Workflows',
  },
  {
    name: 'Automation / Ops Admin',
    summary: 'Configures trigger → condition → action workflow automations. Deliberately independent of every business module — usually layered onto another role rather than used alone.',
    permissions: [PERMISSIONS.WORKFLOW_MANAGE],
    blocked: 'Everything else, unless combined with another role',
  },
];

function AdminContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">Role &amp; permission reference for this ERP.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How roles work here</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Every permission key follows <code className="text-xs">&lt;module&gt;:&lt;resource&gt;.&lt;action&gt;</code>.
            A user can hold multiple roles at once — access is granted if{' '}
            <em>any</em> held role has the permission a page or API route requires.
          </p>
          <p>
            <strong className="text-foreground">Only two roles exist in this database today:</strong>{' '}
            the seeded &quot;Owner&quot; (every permission) and the ad-hoc &quot;Staff&quot; read-only role from{' '}
            <code className="text-xs">create-test-user.ts</code>. There is no Users/Roles admin UI yet to create
            the roles below — they&apos;re templates showing which real permission keys a role would need for a
            given job function, for when that UI exists.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {ROLE_GUIDES.map((role) => (
          <Card key={role.name}>
            <CardHeader>
              <CardTitle className="text-base">{role.name}</CardTitle>
              <CardDescription>{role.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="mb-1 font-medium">Permissions</p>
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions.map((perm) => (
                    <code
                      key={perm}
                      className="bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {perm}
                    </code>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-medium">Blocked from</p>
                <p className="text-muted-foreground">{role.blocked}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.USERS_MANAGE}>
      <AdminContent />
    </RequirePermissionPage>
  );
}
