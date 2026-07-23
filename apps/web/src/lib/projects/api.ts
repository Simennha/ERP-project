import { authedFetch } from '@/lib/auth/api-client';

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
