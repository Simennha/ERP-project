import { API_BASE_URL } from '@/lib/auth/api-client';

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

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message)) {
        return message.join(', ');
      }
    }
  } catch {
    // Non-JSON error body — fall through to the status text.
  }
  return `Request failed (${res.status})`;
}

async function authedFetch<T>(
  token: string | null,
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!token) {
    throw new Error('Not authenticated');
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res));
  }
  return (await res.json()) as T;
}

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
