import { API_BASE_URL } from '@/lib/auth/api-client';

/** Typed client for the Reporting REST API. Mirrors lib/inventory/api.ts's fetch pattern. */

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
}

export interface ReportDto {
  id: string;
  name: string;
  reportType: string;
  filters: ReportFilters;
  createdAt: string;
  updatedAt: string;
}

export interface ReportResult {
  columns: string[];
  rows: Array<Record<string, string | number>>;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ReportInput {
  name: string;
  reportType: string;
  filters?: ReportFilters;
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message: unknown }).message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.join(', ');
    }
  } catch {
    // Non-JSON error body — fall through to the status text.
  }
  return `Request failed (${res.status})`;
}

async function authedFetch<T>(token: string | null, path: string, init?: RequestInit): Promise<T> {
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
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export function listReports(
  token: string | null,
  params: { page?: number; pageSize?: number } = {},
): Promise<Paginated<ReportDto>> {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  const qs = search.toString();
  return authedFetch(token, `/reporting/reports${qs ? `?${qs}` : ''}`);
}

export function getReport(token: string | null, id: string): Promise<ReportDto> {
  return authedFetch(token, `/reporting/reports/${id}`);
}

export function runReport(token: string | null, id: string): Promise<ReportResult> {
  return authedFetch(token, `/reporting/reports/${id}/run`);
}

export function createReport(token: string | null, input: ReportInput): Promise<ReportDto> {
  return authedFetch(token, '/reporting/reports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateReport(
  token: string | null,
  id: string,
  input: Partial<ReportInput>,
): Promise<ReportDto> {
  return authedFetch(token, `/reporting/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteReport(token: string | null, id: string): Promise<void> {
  return authedFetch(token, `/reporting/reports/${id}`, { method: 'DELETE' });
}
