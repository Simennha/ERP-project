import { Injectable, Logger } from '@nestjs/common';
import type { DashboardWidget } from '@erp/contracts';
import type { DashboardWidgetProvider } from './dashboard-widget-provider.interface';

/**
 * Company-wide registry of dashboard-widget contributors.
 *
 * NestJS has no built-in "many providers merge into one array" mechanism for
 * arbitrary tokens (only specific enhancer tokens like APP_GUARD get that
 * treatment), so this is the standard workaround: a single shared singleton
 * that feature-module providers push themselves into via `register()` in
 * their own `onModuleInit()`. All providers reachable from AppModule are
 * instantiated during bootstrap regardless of module import order, so every
 * registration is guaranteed to have happened before the first request.
 */
@Injectable()
export class DashboardWidgetRegistry {
  private readonly logger = new Logger(DashboardWidgetRegistry.name);
  private readonly providers: DashboardWidgetProvider[] = [];

  register(provider: DashboardWidgetProvider): void {
    this.providers.push(provider);
  }

  /**
   * Collect every registered provider's widgets for a company. One provider
   * throwing does not take down the whole dashboard — it just contributes no
   * widgets for that request (logged for visibility).
   */
  async collectAll(companyId: string): Promise<DashboardWidget[]> {
    const results = await Promise.all(
      this.providers.map(async (provider) => {
        try {
          return await provider.getWidgets(companyId);
        } catch (err) {
          this.logger.warn(
            `dashboard widget provider failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          return [];
        }
      }),
    );
    return results.flat().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
}
