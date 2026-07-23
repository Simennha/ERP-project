import { Injectable } from '@nestjs/common';
import type { WorkflowActionType } from '@erp/contracts';

import type { ActionHandler } from './actions/action-handler';
import { AssignTaskActionHandler } from './actions/assign-task.handler';
import { CallWebhookActionHandler } from './actions/call-webhook.handler';
import { CreateRecordActionHandler } from './actions/create-record.handler';
import { NotifyActionHandler } from './actions/notify.handler';
import { UpdateFieldActionHandler } from './actions/update-field.handler';

/**
 * Pluggable map from {@link WorkflowActionType} to the handler that services it.
 *
 * Adding a new action type is three steps: add the config shape to
 * `@erp/contracts` workflow.ts, implement an {@link ActionHandler}, then
 * register it as a provider in WorkflowModule and add it to this constructor.
 * Lookup is O(1); handlers key themselves off their own `type` property so
 * there is no second place that has to agree on the mapping.
 */
@Injectable()
export class ActionHandlerRegistry {
  private readonly handlers = new Map<WorkflowActionType, ActionHandler>();

  constructor(
    notify: NotifyActionHandler,
    updateField: UpdateFieldActionHandler,
    createRecord: CreateRecordActionHandler,
    callWebhook: CallWebhookActionHandler,
    assignTask: AssignTaskActionHandler,
  ) {
    const all: ActionHandler[] = [
      notify,
      updateField,
      createRecord,
      callWebhook,
      assignTask,
    ];
    for (const handler of all) {
      this.handlers.set(handler.type, handler);
    }
  }

  get(type: WorkflowActionType): ActionHandler | undefined {
    return this.handlers.get(type);
  }
}
