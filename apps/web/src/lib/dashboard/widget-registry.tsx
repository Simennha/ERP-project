import type { ComponentType } from 'react';
import Link from 'next/link';
import { KpiCard } from '@erp/ui';
import type { DashboardWidget } from './api';

function formatMoney(value: string): string {
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
    : value;
}

function formatWidgetValue(widget: DashboardWidget): string {
  return widget.format === 'money' ? formatMoney(widget.value) : widget.value;
}

function KpiWidget({ widget }: { widget: DashboardWidget }) {
  const card = <KpiCard title={widget.title} value={formatWidgetValue(widget)} hint={widget.hint} />;
  return widget.href ? <Link href={widget.href}>{card}</Link> : card;
}

/**
 * Maps a widget's `kind` (see @erp/contracts DashboardWidget) to the React
 * component that renders it. Only `'kpi'` exists today; a future kind (a
 * chart, a mini-list, ...) registers its own renderer here and nothing else
 * on the dashboard page needs to change — new *widgets* of an existing kind
 * (the common case: another KPI) need no frontend change at all, only a new
 * backend provider (see apps/api/src/core/dashboard-widgets).
 */
export const WIDGET_RENDERERS: Record<string, ComponentType<{ widget: DashboardWidget }>> = {
  kpi: KpiWidget,
};
