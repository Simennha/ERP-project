import { API_BASE_URL } from '@/lib/auth/api-client';

/**
 * Typed client for GET /dashboard/summary. Mirrors lib/inventory/api.ts's
 * fetch pattern and its "mirror the server DTO, don't import it" convention.
 */

export interface DashboardKpiWidget {
  id: string;
  kind: 'kpi';
  title: string;
  value: string;
  format?: 'money' | 'count';
  hint?: string;
  href?: string;
  requiredPermission?: string;
  order?: number;
}

export type DashboardWidget = DashboardKpiWidget;

export interface DashboardSummary {
  widgets: DashboardWidget[];
}

export async function getDashboardSummary(token: string | null): Promise<DashboardSummary> {
  if (!token) {
    throw new Error('Not authenticated');
  }
  const res = await fetch(`${API_BASE_URL}/dashboard/summary`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return (await res.json()) as DashboardSummary;
}
