import { Injectable, Logger } from '@nestjs/common';
import {
  WORKFLOW_ACTION_TYPES,
  type NotifyActionConfig,
  type WorkflowActionType,
} from '@erp/contracts';

import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../../notifications/notifications.service';
import { asPayloadRecord, interpolate } from '../interpolate';
import type { ActionContext, ActionHandler } from './action-handler';

/**
 * `notify` — send an in-app notification via NotificationService.
 *
 * Recipients are resolved from the config's `recipient`:
 *   - triggerActor -> the user who caused the event (context.actorUserId)
 *   - user         -> the given userId directly
 *   - role         -> every user in the company holding the named role
 *                     (User -> UserRole -> Role, filtered by Role.name + company)
 *
 * `title` / `body` support `{{fieldName}}` interpolation from the event payload.
 */
@Injectable()
export class NotifyActionHandler implements ActionHandler {
  readonly type: WorkflowActionType = WORKFLOW_ACTION_TYPES.NOTIFY;
  private readonly logger = new Logger(NotifyActionHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async execute(config: unknown, context: ActionContext): Promise<void> {
    const cfg = config as NotifyActionConfig;
    const payload = asPayloadRecord(context.event.payload);

    const recipientIds = await this.resolveRecipients(cfg, context);
    if (recipientIds.length === 0) {
      this.logger.debug(
        `notify: no recipients resolved for event ${context.event.name}`,
      );
      return;
    }

    const title = interpolate(cfg.title, payload);
    const body =
      cfg.body !== undefined ? interpolate(cfg.body, payload) : undefined;

    for (const userId of recipientIds) {
      await this.notifications.send({
        companyId: context.companyId,
        userId,
        type: 'workflow',
        title,
        body,
        link: cfg.link,
        sourceEvent: context.event.name,
      });
    }
  }

  private async resolveRecipients(
    cfg: NotifyActionConfig,
    context: ActionContext,
  ): Promise<string[]> {
    const recipient = cfg.recipient;
    switch (recipient.kind) {
      case 'triggerActor':
        return context.actorUserId ? [context.actorUserId] : [];
      case 'user':
        return [recipient.userId];
      case 'role': {
        const users = await this.prisma.user.findMany({
          where: {
            companyId: context.companyId,
            userRoles: {
              some: {
                role: { name: recipient.roleName, companyId: context.companyId },
              },
            },
          },
          select: { id: true },
        });
        return users.map((user) => user.id);
      }
      default:
        return [];
    }
  }
}
