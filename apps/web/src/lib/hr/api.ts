import { API_BASE_URL } from '@/lib/auth/api-client';

/**
 * Typed client for the HR REST API.
 *
 * Copies the fetch pattern from lib/inventory/api.ts (itself copied from
 * lib/auth/api-client.ts: JSON, `credentials: 'include'`, normalized error
 * message, `Authorization: Bearer` header). Every function takes the access
 * token explicitly — read it from `useAuth().getAccessToken()` at call time.
 *
 * NOTE: the response shapes below intentionally mirror the API's inline DTOs
 * (apps/api/src/hr/employees.service.ts) rather than importing them, so the
 * web app stays decoupled from server internals.
 */

// --- Shared shapes -----------------------------------------------------------

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type EmploymentStatus = 'active' | 'onLeave' | 'terminated';

/** `hireDate`/`createdAt`/`updatedAt` arrive as ISO 8601 strings. */
export interface EmployeeDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
  employmentStatus: string;
  hireDate: string;
  createdAt: string;
  updatedAt: string;
}

// --- Request payloads --------------------------------------------------------

export interface EmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle?: string;
  department?: string;
  employmentStatus?: EmploymentStatus;
  hireDate?: string;
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

// --- Employees -----------------------------------------------------------------

export function listEmployees(
  token: string | null,
  params: { employmentStatus?: EmploymentStatus; page?: number; pageSize?: number } = {},
): Promise<Paginated<EmployeeDto>> {
  return authedFetch(token, `/hr/employees${buildQuery(params)}`);
}

export function getEmployee(token: string | null, id: string): Promise<EmployeeDto> {
  return authedFetch(token, `/hr/employees/${id}`);
}

export function createEmployee(token: string | null, input: EmployeeInput): Promise<EmployeeDto> {
  return authedFetch(token, '/hr/employees', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateEmployee(
  token: string | null,
  id: string,
  input: Partial<EmployeeInput>,
): Promise<EmployeeDto> {
  return authedFetch(token, `/hr/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteEmployee(token: string | null, id: string): Promise<void> {
  return authedFetch(token, `/hr/employees/${id}`, { method: 'DELETE' });
}
