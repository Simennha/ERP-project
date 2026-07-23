/**
 * Fixed report-type registry — the reporting equivalent of `workflow.ts`'s
 * `WORKFLOW_ACTION_TYPES`. Each type maps to exactly one hand-written
 * cross-module query on the backend (`apps/api/src/reporting/report-runners/`)
 * and is rendered identically on the frontend via the generic `columns`/`rows`
 * shape every report run returns — adding a report type means adding one
 * entry here, one runner function, and nothing else on the frontend.
 */
export const REPORT_TYPES = {
  SALES_BY_CUSTOMER: 'salesByCustomer',
  INVENTORY_VALUATION: 'inventoryValuation',
  LOW_STOCK: 'lowStock',
  OPEN_INVOICES: 'openInvoices',
  PURCHASE_ORDERS_BY_VENDOR: 'purchaseOrdersByVendor',
  EMPLOYEE_ROSTER: 'employeeRoster',
  PROJECT_STATUS_SUMMARY: 'projectStatusSummary',
} as const;

export type ReportType = (typeof REPORT_TYPES)[keyof typeof REPORT_TYPES];

/** Which optional filter fields a report type's runner reads from `filtersJson`. */
export type ReportFilterField = 'dateFrom' | 'dateTo';

export interface ReportTypeDefinition {
  type: ReportType;
  label: string;
  module: string;
  description: string;
  filters: ReportFilterField[];
}

export const REPORT_TYPE_DEFINITIONS: ReportTypeDefinition[] = [
  {
    type: REPORT_TYPES.SALES_BY_CUSTOMER,
    label: 'Sales by customer',
    module: 'sales',
    description: 'Order count and revenue per customer.',
    filters: ['dateFrom', 'dateTo'],
  },
  {
    type: REPORT_TYPES.INVENTORY_VALUATION,
    label: 'Inventory valuation',
    module: 'inventory',
    description: 'On-hand stock value per warehouse (on-hand x cost).',
    filters: [],
  },
  {
    type: REPORT_TYPES.LOW_STOCK,
    label: 'Low stock items',
    module: 'inventory',
    description: 'Products at or below their reorder point.',
    filters: [],
  },
  {
    type: REPORT_TYPES.OPEN_INVOICES,
    label: 'Open invoices',
    module: 'finance',
    description: 'Unpaid invoices (draft/sent) with age in days.',
    filters: [],
  },
  {
    type: REPORT_TYPES.PURCHASE_ORDERS_BY_VENDOR,
    label: 'Purchase orders by vendor',
    module: 'procurement',
    description: 'Order count and spend per vendor.',
    filters: ['dateFrom', 'dateTo'],
  },
  {
    type: REPORT_TYPES.EMPLOYEE_ROSTER,
    label: 'Employee roster',
    module: 'hr',
    description: 'All employees with job title, department, and status.',
    filters: [],
  },
  {
    type: REPORT_TYPES.PROJECT_STATUS_SUMMARY,
    label: 'Project status summary',
    module: 'projects',
    description: 'Project count grouped by status.',
    filters: [],
  },
];

export function getReportTypeDefinition(type: string): ReportTypeDefinition | undefined {
  return REPORT_TYPE_DEFINITIONS.find((def) => def.type === type);
}

/** Optional filter values a saved Report's `filtersJson` may carry. */
export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
}

/** Generic tabular result every report run returns, regardless of type. */
export interface ReportResult {
  columns: string[];
  rows: Array<Record<string, string | number>>;
}
