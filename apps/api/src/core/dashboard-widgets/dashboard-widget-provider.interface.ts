import type { DashboardWidget } from '@erp/contracts';

/**
 * Implemented by one provider per module that contributes dashboard tiles
 * (see InventoryDashboardWidgetsProvider / SalesDashboardWidgetsProvider for
 * the reference shape). Providers self-register with
 * {@link DashboardWidgetRegistry} from `onModuleInit()` — DashboardModule
 * never imports or references feature modules directly, so a new module
 * (Finance, HR, ...) adds a widget by adding a provider like this one, not by
 * editing dashboard code.
 */
export interface DashboardWidgetProvider {
  getWidgets(companyId: string): Promise<DashboardWidget[]>;
}
