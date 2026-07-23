import { z } from 'zod';
import { EVENTS, WORKFLOW_ACTION_TYPES } from '@erp/contracts';

/**
 * Zod schemas for the workflow CRUD API request bodies.
 *
 * DELIBERATELY colocated here rather than in `@erp/contracts`: these are
 * API-input shapes specific to these endpoints (they mirror, but are not, the
 * cross-app `WorkflowActionConfig` DTOs). The contract package stays the
 * source of truth for the runtime shapes the engine consumes; this file is the
 * validation boundary for what an admin may POST/PATCH.
 */

// --- Per-action-type config schemas (mirror @erp/contracts config shapes) ----

const notifyConfigSchema = z.object({
  recipient: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('triggerActor') }),
    z.object({ kind: z.literal('role'), roleName: z.string().min(1) }),
    z.object({ kind: z.literal('user'), userId: z.string().min(1) }),
  ]),
  title: z.string().min(1),
  body: z.string().optional(),
  link: z.string().optional(),
});

const updateFieldConfigSchema = z.object({
  model: z.string().min(1),
  field: z.string().min(1),
  value: z.unknown(),
});

const createRecordConfigSchema = z.object({
  model: z.string().min(1),
  data: z.record(z.unknown()),
});

const callWebhookConfigSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
});

const assignTaskConfigSchema = z.object({
  assigneeUserId: z.string().min(1),
  title: z.string().min(1),
  dueAt: z.string().optional(),
});

const orderField = z.number().int().min(0).optional();

/** One action step, validated per `type` against its matching config shape. */
const actionSchema = z.discriminatedUnion('type', [
  z.object({
    order: orderField,
    type: z.literal(WORKFLOW_ACTION_TYPES.NOTIFY),
    config: notifyConfigSchema,
  }),
  z.object({
    order: orderField,
    type: z.literal(WORKFLOW_ACTION_TYPES.UPDATE_FIELD),
    config: updateFieldConfigSchema,
  }),
  z.object({
    order: orderField,
    type: z.literal(WORKFLOW_ACTION_TYPES.CREATE_RECORD),
    config: createRecordConfigSchema,
  }),
  z.object({
    order: orderField,
    type: z.literal(WORKFLOW_ACTION_TYPES.CALL_WEBHOOK),
    config: callWebhookConfigSchema,
  }),
  z.object({
    order: orderField,
    type: z.literal(WORKFLOW_ACTION_TYPES.ASSIGN_TASK),
    config: assignTaskConfigSchema,
  }),
]);

// `triggerEvent` must be one of the registered event names. Validating here
// turns a typo'd trigger (a workflow that would silently never fire) into an
// immediate 400 instead of a latent bug.
const EVENT_NAMES = Object.values(EVENTS) as [string, ...string[]];

export const createWorkflowSchema = z.object({
  name: z.string().min(1),
  module: z.string().min(1),
  triggerEvent: z.enum(EVENT_NAMES),
  /** json-logic-js rule tree; omitted/null = always run once the trigger matches. */
  conditions: z.unknown().optional(),
  isActive: z.boolean().optional(),
  actions: z.array(actionSchema).default([]),
});

/**
 * PATCH body: every field optional. When `actions` is present the whole action
 * list is replaced (v1 has no per-action patch); when absent the existing
 * actions are left untouched. `actions` is re-declared as a plain optional so
 * `.partial()` does not carry over the create schema's `.default([])` (which
 * would wipe the actions on any PATCH that omitted them).
 */
export const updateWorkflowSchema = createWorkflowSchema.partial().extend({
  actions: z.array(actionSchema).optional(),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;
export type WorkflowActionInput = z.infer<typeof actionSchema>;
