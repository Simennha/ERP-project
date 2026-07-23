/**
 * Cross-app shape for one dashboard tile, returned by `GET /dashboard/summary`
 * and rendered by the web app's widget-kind renderer registry (see
 * apps/web/src/lib/dashboard/widget-registry.tsx).
 *
 * `kind` selects which frontend component renders the widget — only `'kpi'`
 * exists today (a single-number tile). Adding a new kind (e.g. a chart or a
 * mini-list) means adding one config type here, one case in the discriminated
 * union, and one renderer registration on the frontend — no other dashboard
 * code changes.
 */
export interface DashboardKpiWidget {
  id: string;
  kind: 'kpi';
  title: string;
  value: string;
  /** How to format `value` for display. Defaults to plain text if omitted. */
  format?: 'money' | 'count';
  hint?: string;
  /** Drill-down link, e.g. to the filtered list page this KPI summarizes. */
  href?: string;
  /** Widgets are still returned when the viewer lacks this — see docblock on
   * DashboardService for why filtering happens on the frontend, not here. */
  requiredPermission?: string;
  /** Lower sorts first; widgets without an order keep provider registration order. */
  order?: number;
}

export type DashboardWidget = DashboardKpiWidget;

export interface DashboardSummaryDto {
  widgets: DashboardWidget[];
}
