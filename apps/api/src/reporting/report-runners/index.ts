import { REPORT_TYPES, type ReportType } from '@erp/contracts';
import type { ReportRunner } from './report-runner.types';
import { runSalesByCustomer } from './sales-by-customer.runner';
import { runInventoryValuation } from './inventory-valuation.runner';
import { runLowStock } from './low-stock.runner';
import { runOpenInvoices } from './open-invoices.runner';
import { runPurchaseOrdersByVendor } from './purchase-orders-by-vendor.runner';
import { runEmployeeRoster } from './employee-roster.runner';
import { runProjectStatusSummary } from './project-status-summary.runner';

export * from './report-runner.types';

/** type -> runner. Adding a report type means adding one entry here (plus
 * the definition in @erp/contracts REPORT_TYPE_DEFINITIONS). */
export const REPORT_RUNNERS: Record<ReportType, ReportRunner> = {
  [REPORT_TYPES.SALES_BY_CUSTOMER]: runSalesByCustomer,
  [REPORT_TYPES.INVENTORY_VALUATION]: runInventoryValuation,
  [REPORT_TYPES.LOW_STOCK]: runLowStock,
  [REPORT_TYPES.OPEN_INVOICES]: runOpenInvoices,
  [REPORT_TYPES.PURCHASE_ORDERS_BY_VENDOR]: runPurchaseOrdersByVendor,
  [REPORT_TYPES.EMPLOYEE_ROSTER]: runEmployeeRoster,
  [REPORT_TYPES.PROJECT_STATUS_SUMMARY]: runProjectStatusSummary,
};
