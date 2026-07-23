/**
 * Workflow/automation action types and their config shapes.
 *
 * A WorkflowAction row's `configJson` (see @erp/database WorkflowAction) must
 * match the shape for its `type` below. The backend's ActionHandlerRegistry
 * (apps/api/src/core/workflow) maps `type` -> handler; adding a new action
 * type means adding both a config shape here AND a handler there.
 */

export const WORKFLOW_ACTION_TYPES = {
  NOTIFY: 'notify',
  UPDATE_FIELD: 'updateField',
  CREATE_RECORD: 'createRecord',
  CALL_WEBHOOK: 'callWebhook',
  ASSIGN_TASK: 'assignTask',
} as const;

export type WorkflowActionType =
  (typeof WORKFLOW_ACTION_TYPES)[keyof typeof WORKFLOW_ACTION_TYPES];

/** `notify`: send an in-app notification via NotificationService. */
export interface NotifyActionConfig {
  /** 'triggerActor' notifies whoever caused the event; 'role' notifies every
   * user holding the given role name; 'user' notifies a specific userId. */
  recipient:
    | { kind: 'triggerActor' }
    | { kind: 'role'; roleName: string }
    | { kind: 'user'; userId: string };
  title: string;
  /** May reference event payload fields with `{{fieldName}}` interpolation. */
  body?: string;
  link?: string;
}

/** `updateField`: set a field on the entity the triggering event refers to. */
export interface UpdateFieldActionConfig {
  /** Prisma model name, e.g. "Product". Must match the event payload's entity. */
  model: string;
  field: string;
  value: unknown;
}

/** `createRecord`: create a new row of some model, seeded from the event payload. */
export interface CreateRecordActionConfig {
  model: string;
  /** Static field values; `{{fieldName}}` interpolates from the event payload. */
  data: Record<string, unknown>;
}

/** `callWebhook`: POST the event envelope to an external URL. */
export interface CallWebhookActionConfig {
  url: string;
  headers?: Record<string, string>;
}

/** `assignTask`: v1 implementation is a notification of type "task" — no
 * separate Task entity yet, kept here as its own action type so a real Task
 * model can be swapped in later without changing the workflow definition shape. */
export interface AssignTaskActionConfig {
  assigneeUserId: string;
  title: string;
  dueAt?: string;
}

export type WorkflowActionConfig =
  | { type: typeof WORKFLOW_ACTION_TYPES.NOTIFY; config: NotifyActionConfig }
  | { type: typeof WORKFLOW_ACTION_TYPES.UPDATE_FIELD; config: UpdateFieldActionConfig }
  | { type: typeof WORKFLOW_ACTION_TYPES.CREATE_RECORD; config: CreateRecordActionConfig }
  | { type: typeof WORKFLOW_ACTION_TYPES.CALL_WEBHOOK; config: CallWebhookActionConfig }
  | { type: typeof WORKFLOW_ACTION_TYPES.ASSIGN_TASK; config: AssignTaskActionConfig };

/** Per-action-run outcome, stored in WorkflowRun.resultJson. */
export interface WorkflowActionResult {
  actionId: string;
  type: WorkflowActionType;
  status: 'ok' | 'error';
  error?: string;
}

export type WorkflowRunStatus = 'matched' | 'skipped' | 'error';
