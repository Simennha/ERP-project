import type { DomainEvent, WorkflowActionType } from '@erp/contracts';

/**
 * Ambient context every action handler receives for a single workflow run.
 * Carries the company, the acting user (may be null for system-originated
 * events), and the full triggering event envelope — handlers read
 * `event.payload` for `{{...}}` interpolation and entity-id resolution.
 */
export interface ActionContext {
  companyId: string;
  actorUserId: string | null;
  event: DomainEvent;
}

/**
 * A pluggable workflow action. Each concrete handler declares the
 * {@link WorkflowActionType} it services; {@link ActionHandlerRegistry} maps
 * `type` -> handler.
 *
 * `config` is the raw `WorkflowAction.configJson` (already validated on write by
 * the module's zod schemas); the handler casts it to its own config shape from
 * `@erp/contracts`.
 */
export interface ActionHandler {
  readonly type: WorkflowActionType;
  execute(config: unknown, context: ActionContext): Promise<void>;
}
