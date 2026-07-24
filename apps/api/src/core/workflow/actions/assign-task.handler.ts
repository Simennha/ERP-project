import { Injectable } from '@nestjs/common';
import {
  WORKFLOW_ACTION_TYPES,
  type AssignTaskActionConfig,
  type WorkflowActionType,
} from '@erp/contracts';

import { NotificationService } from '../../notifications/notifications.service';
import { asPayloadRecord, interpolate } from '../interpolate';
import type { ActionContext, ActionHandler } from './action-handler';

/**
 * `assignTask` — per the contract, v1 has no separate Task entity: this sends a
 * notification of type `'task'` to the configured assignee. Kept as its own
 * action type so a real Task model can replace this later without changing any
 * stored workflow definition.
 */
@Injectable()
export class AssignTaskActionHandler implements ActionHandler {
  readonly type: WorkflowActionType = WORKFLOW_ACTION_TYPES.ASSIGN_TASK;

  constructor(private readonly notifications: NotificationService) {}

  async execute(config: unknown, context: ActionContext): Promise<void> {
    const cfg = config as AssignTaskActionConfig;
    const payload = asPayloadRecord(context.event.payload);

    await this.notifications.send({
      companyId: context.companyId,
      userId: cfg.assigneeUserId,
      type: 'task',
      title: interpolate(cfg.title, payload),
      body: cfg.dueAt ? `Due: ${cfg.dueAt}` : undefined,
      link: cfg.link !== undefined ? interpolate(cfg.link, payload) : undefined,
      sourceEvent: context.event.name,
    });
  }
}
