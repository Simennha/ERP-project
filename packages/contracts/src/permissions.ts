/**
 * Permission key registry.
 *
 * This is the single source of truth for every permission string in the ERP.
 * Keys follow the convention `<module>:<resource>.<action>`.
 *
 * - The database `Permission` table is seeded from `PERMISSION_DEFINITIONS`
 *   (see packages/database/prisma/seed.ts) — it is a GLOBAL registry, not
 *   company-scoped.
 * - NestJS route guards reference these via the `@RequirePermission(...)`
 *   decorator; the React client checks them via `@erp/auth` helpers.
 *
 * Later phases (Inventory, Sales, Finance, ...) EXTEND this registry rather
 * than inventing a new pattern. Add a `PERMISSIONS` entry AND a matching
 * `PERMISSION_DEFINITIONS` row so the seed picks it up.
 */

export const PERMISSIONS = {
  // --- Administration -------------------------------------------------------
  USERS_MANAGE: 'admin:users.manage',
  ROLES_MANAGE: 'admin:roles.manage',
  COMPANY_SETTINGS_MANAGE: 'admin:company.settings',
  AUDIT_LOG_READ: 'admin:audit.read',
  WORKFLOW_MANAGE: 'admin:workflow.manage',

  // --- Inventory (placeholder resource: product + stock) --------------------
  INVENTORY_PRODUCT_READ: 'inventory:product.read',
  INVENTORY_PRODUCT_CREATE: 'inventory:product.create',
  INVENTORY_PRODUCT_UPDATE: 'inventory:product.update',
  INVENTORY_PRODUCT_DELETE: 'inventory:product.delete',
  INVENTORY_STOCK_ADJUST: 'inventory:stock.adjust',
  INVENTORY_WAREHOUSE_MANAGE: 'inventory:warehouse.manage',

  // --- Sales (placeholder resource: order) ----------------------------------
  SALES_ORDER_READ: 'sales:order.read',
  SALES_ORDER_CREATE: 'sales:order.create',
  SALES_ORDER_UPDATE: 'sales:order.update',
  SALES_ORDER_DELETE: 'sales:order.delete',

  // --- Finance (placeholder resource: invoice) ------------------------------
  FINANCE_INVOICE_READ: 'finance:invoice.read',
  FINANCE_INVOICE_CREATE: 'finance:invoice.create',
  FINANCE_INVOICE_UPDATE: 'finance:invoice.update',
  FINANCE_INVOICE_DELETE: 'finance:invoice.delete',

  // --- HR (placeholder resource: employee) ----------------------------------
  HR_EMPLOYEE_READ: 'hr:employee.read',
  HR_EMPLOYEE_CREATE: 'hr:employee.create',
  HR_EMPLOYEE_UPDATE: 'hr:employee.update',
  HR_EMPLOYEE_DELETE: 'hr:employee.delete',

  // --- Procurement (placeholder resource: purchase order) -------------------
  PROCUREMENT_PURCHASE_ORDER_READ: 'procurement:purchaseOrder.read',
  PROCUREMENT_PURCHASE_ORDER_CREATE: 'procurement:purchaseOrder.create',
  PROCUREMENT_PURCHASE_ORDER_UPDATE: 'procurement:purchaseOrder.update',
  PROCUREMENT_PURCHASE_ORDER_DELETE: 'procurement:purchaseOrder.delete',

  // --- Projects (placeholder resource: project) -----------------------------
  PROJECTS_PROJECT_READ: 'projects:project.read',
  PROJECTS_PROJECT_CREATE: 'projects:project.create',
  PROJECTS_PROJECT_UPDATE: 'projects:project.update',
  PROJECTS_PROJECT_DELETE: 'projects:project.delete',

  // --- Reporting (placeholder resource: report / dashboard) -----------------
  REPORTING_REPORT_READ: 'reporting:report.read',
  REPORTING_REPORT_CREATE: 'reporting:report.create',
  REPORTING_REPORT_UPDATE: 'reporting:report.update',
  REPORTING_REPORT_DELETE: 'reporting:report.delete',
} as const;

/** A single valid permission string, e.g. `'admin:users.manage'`. */
export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Shape accepted by guards/hooks that require one or more permissions.
 * A single key or an array of keys (see @erp/auth for the check semantics).
 */
export type RequiredPermission = PermissionKey | PermissionKey[];

/** Module identifiers, used to group permissions and namespace events. */
export const PERMISSION_MODULES = {
  ADMIN: 'admin',
  INVENTORY: 'inventory',
  SALES: 'sales',
  FINANCE: 'finance',
  HR: 'hr',
  PROCUREMENT: 'procurement',
  PROJECTS: 'projects',
  REPORTING: 'reporting',
} as const;

export type PermissionModule =
  (typeof PERMISSION_MODULES)[keyof typeof PERMISSION_MODULES];

/** Metadata used to seed the `Permission` table. */
export interface PermissionDefinition {
  key: PermissionKey;
  module: PermissionModule;
  description: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // Administration
  { key: PERMISSIONS.USERS_MANAGE, module: 'admin', description: 'Create, edit, deactivate users' },
  { key: PERMISSIONS.ROLES_MANAGE, module: 'admin', description: 'Create and edit roles and their permissions' },
  { key: PERMISSIONS.COMPANY_SETTINGS_MANAGE, module: 'admin', description: 'Manage company-wide settings' },
  { key: PERMISSIONS.AUDIT_LOG_READ, module: 'admin', description: 'Read the audit log' },
  { key: PERMISSIONS.WORKFLOW_MANAGE, module: 'admin', description: 'Create and edit workflow automations' },

  // Inventory
  { key: PERMISSIONS.INVENTORY_PRODUCT_READ, module: 'inventory', description: 'View products' },
  { key: PERMISSIONS.INVENTORY_PRODUCT_CREATE, module: 'inventory', description: 'Create products' },
  { key: PERMISSIONS.INVENTORY_PRODUCT_UPDATE, module: 'inventory', description: 'Edit products' },
  { key: PERMISSIONS.INVENTORY_PRODUCT_DELETE, module: 'inventory', description: 'Delete products' },
  { key: PERMISSIONS.INVENTORY_STOCK_ADJUST, module: 'inventory', description: 'Adjust stock levels' },
  { key: PERMISSIONS.INVENTORY_WAREHOUSE_MANAGE, module: 'inventory', description: 'Create and edit warehouses' },

  // Sales
  { key: PERMISSIONS.SALES_ORDER_READ, module: 'sales', description: 'View sales orders' },
  { key: PERMISSIONS.SALES_ORDER_CREATE, module: 'sales', description: 'Create sales orders' },
  { key: PERMISSIONS.SALES_ORDER_UPDATE, module: 'sales', description: 'Edit sales orders' },
  { key: PERMISSIONS.SALES_ORDER_DELETE, module: 'sales', description: 'Delete sales orders' },

  // Finance
  { key: PERMISSIONS.FINANCE_INVOICE_READ, module: 'finance', description: 'View invoices' },
  { key: PERMISSIONS.FINANCE_INVOICE_CREATE, module: 'finance', description: 'Create invoices' },
  { key: PERMISSIONS.FINANCE_INVOICE_UPDATE, module: 'finance', description: 'Edit invoices' },
  { key: PERMISSIONS.FINANCE_INVOICE_DELETE, module: 'finance', description: 'Delete invoices' },

  // HR
  { key: PERMISSIONS.HR_EMPLOYEE_READ, module: 'hr', description: 'View employees' },
  { key: PERMISSIONS.HR_EMPLOYEE_CREATE, module: 'hr', description: 'Create employees' },
  { key: PERMISSIONS.HR_EMPLOYEE_UPDATE, module: 'hr', description: 'Edit employees' },
  { key: PERMISSIONS.HR_EMPLOYEE_DELETE, module: 'hr', description: 'Delete employees' },

  // Procurement
  { key: PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_READ, module: 'procurement', description: 'View purchase orders' },
  { key: PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_CREATE, module: 'procurement', description: 'Create purchase orders' },
  { key: PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_UPDATE, module: 'procurement', description: 'Edit purchase orders' },
  { key: PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_DELETE, module: 'procurement', description: 'Delete purchase orders' },

  // Projects
  { key: PERMISSIONS.PROJECTS_PROJECT_READ, module: 'projects', description: 'View projects' },
  { key: PERMISSIONS.PROJECTS_PROJECT_CREATE, module: 'projects', description: 'Create projects' },
  { key: PERMISSIONS.PROJECTS_PROJECT_UPDATE, module: 'projects', description: 'Edit projects' },
  { key: PERMISSIONS.PROJECTS_PROJECT_DELETE, module: 'projects', description: 'Delete projects' },

  // Reporting
  { key: PERMISSIONS.REPORTING_REPORT_READ, module: 'reporting', description: 'View reports' },
  { key: PERMISSIONS.REPORTING_REPORT_CREATE, module: 'reporting', description: 'Create reports' },
  { key: PERMISSIONS.REPORTING_REPORT_UPDATE, module: 'reporting', description: 'Edit reports' },
  { key: PERMISSIONS.REPORTING_REPORT_DELETE, module: 'reporting', description: 'Delete reports' },
];

/** Convenience: every permission key as a flat array. */
export const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS) as PermissionKey[];
