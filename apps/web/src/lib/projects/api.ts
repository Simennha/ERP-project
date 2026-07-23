import { API_BASE_URL } from '@/lib/auth/api-client';

/**
 * Typed client for the Projects REST API.
 *
 * Copies the fetch pattern from lib/auth/api-client.ts (JSON, `credentials:
 * 'include'`, normalized error message) and adds the `Authorization: Bearer`
 * header for these protected, non-auth endpoints. Every function takes the
 * access token explicitly — read it from `useAuth().getAccessToken()` at call
 * time.
 *
 * NOTE: the response shapes below intentionally mirror the API's inline DTOs
 * (apps/api/src/projects/projects.service.ts) rather than importing them, so
 * the web app stays decoupled from server internals — same convention as
 * lib/inventory/api.ts.
 */

// --- Shared shapes -----------------------------------------------------------

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type ProjectStatus = 'planned' | 'active' | 'onHold' | 'completed' | 'cancelled';

/** startDate/endDate arrive as ISO strings (or null) when set. */
export interface ProjectDto {
  id: string;
  name: string;
  code: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Request payloads --------------------------------------------------------

export interface ProjectInput {
  name: string;
  code: string;
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string;
  description?: string;
}

// --- Fetch plumbing ----------------------------------------------------------

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
  if (res.status === 204) {
    return undefined as T;
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

// --- Projects ------------------------------------------------------------------

export function listProjects(
  token: string | null,
  params: { status?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<ProjectDto>> {
  return authedFetch(token, `/projects${buildQuery(params)}`);
}

export function getProject(token: string | null, id: string): Promise<ProjectDto> {
  return authedFetch(token, `/projects/${id}`);
}

export function createProject(token: string | null, input: ProjectInput): Promise<ProjectDto> {
  return authedFetch(token, '/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateProject(
  token: string | null,
  id: string,
  input: Partial<ProjectInput>,
): Promise<ProjectDto> {
  return authedFetch(token, `/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteProject(token: string | null, id: string): Promise<void> {
  return authedFetch(token, `/projects/${id}`, { method: 'DELETE' });
}
