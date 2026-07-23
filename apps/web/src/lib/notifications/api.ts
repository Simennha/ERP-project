import { authedFetch } from '@/lib/auth/api-client';

/**
 * Typed client for the Notifications REST API (GET /notifications,
 * POST /notifications/:id/read). Mirrors the fetch pattern in
 * lib/inventory/api.ts.
 */

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
  sourceEvent: string | null;
}

interface NotificationsPage {
  items: NotificationDto[];
  total: number;
}

// authedFetch is shared (lib/auth/api-client.ts) — handles the fetch pattern
// below plus a silent 401 -> refresh -> retry recovery.

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function listNotifications(
  token: string | null,
  params: { unreadOnly?: boolean; page?: number; pageSize?: number } = {},
): Promise<NotificationsPage> {
  return authedFetch(token, `/notifications${buildQuery(params)}`);
}

export function markNotificationRead(
  token: string | null,
  id: string,
): Promise<NotificationDto> {
  return authedFetch(token, `/notifications/${id}/read`, { method: 'POST' });
}
