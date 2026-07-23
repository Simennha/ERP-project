import { API_BASE_URL } from '@/lib/auth/api-client';

/**
 * Typed client for the Workflow REST API. Mirrors lib/inventory/api.ts's
 * fetch pattern.
 *
 * Note: `GET /workflows` returns a plain array (not the usual `Paginated<T>`
 * envelope) — WorkflowService.list() has no pagination, matching
 * workflow.service.ts on the backend exactly. Only `listWorkflowRuns` is
 * paginated.
 */

export interface WorkflowActionDto {
  id: string;
  order: number;
  type: string;
  configJson: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDefinitionDto {
  id: string;
  name: string;
  module: string;
  triggerEvent: string;
  conditionsJson: unknown;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  actions: WorkflowActionDto[];
}

export interface WorkflowRunDto {
  id: string;
  workflowDefinitionId: string;
  triggeredByEvent: string;
  status: string;
  resultJson: unknown;
  error: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface WorkflowActionInput {
  order?: number;
  type: string;
  config: unknown;
}

export interface WorkflowInput {
  name: string;
  module: string;
  triggerEvent: string;
  conditions?: unknown;
  isActive?: boolean;
  actions: WorkflowActionInput[];
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

export function listWorkflows(token: string | null): Promise<WorkflowDefinitionDto[]> {
  return authedFetch(token, '/workflows');
}

export function getWorkflow(token: string | null, id: string): Promise<WorkflowDefinitionDto> {
  return authedFetch(token, `/workflows/${id}`);
}

export function createWorkflow(
  token: string | null,
  input: WorkflowInput,
): Promise<WorkflowDefinitionDto> {
  return authedFetch(token, '/workflows', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateWorkflow(
  token: string | null,
  id: string,
  input: Partial<WorkflowInput>,
): Promise<WorkflowDefinitionDto> {
  return authedFetch(token, `/workflows/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteWorkflow(token: string | null, id: string): Promise<void> {
  return authedFetch(token, `/workflows/${id}`, { method: 'DELETE' });
}

export function listWorkflowRuns(
  token: string | null,
  id: string,
  params: { page?: number; pageSize?: number } = {},
): Promise<Paginated<WorkflowRunDto>> {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  const qs = search.toString();
  return authedFetch(token, `/workflows/${id}/runs${qs ? `?${qs}` : ''}`);
}
