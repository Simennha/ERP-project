import { Module } from '@nestjs/common';
import { DashboardWidgetRegistry } from './dashboard-widget-registry.service';

/**
 * Feature modules that contribute dashboard widgets import this module and
 * add their provider (implementing {@link DashboardWidgetProvider}) to their
 * own `providers` array. DashboardModule also imports this module to inject
 * the same registry instance and read back whatever got registered.
 */
@Module({
  providers: [DashboardWidgetRegistry],
  exports: [DashboardWidgetRegistry],
})
export class DashboardWidgetsModule {}
