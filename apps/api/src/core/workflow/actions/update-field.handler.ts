import { Injectable } from '@nestjs/common';
import {
  WORKFLOW_ACTION_TYPES,
  type UpdateFieldActionConfig,
  type WorkflowActionType,
} from '@erp/contracts';

import { PrismaService } from '../../../prisma/prisma.service';
import { asPayloadRecord } from '../interpolate';
import { delegateName, resolveEntityId } from '../prisma-dynamic';
import type { ActionContext, ActionHandler } from './action-handler';

/**
 * `updateField` — set a single field on the entity the triggering event refers
 * to, via a dynamic Prisma delegate lookup (same technique as
 * core/audit/audit.extension.ts).
 *
 * v1 limitation (deliberate): the target row id must be discoverable from the
 * event payload's conventional id key (see {@link resolveEntityId}). This keeps
 * the handler correct without a compiler to verify arbitrary schema field
 * access. If the id can't be resolved or the model is unknown it throws, and the
 * engine records the action as failed.
 */
@Injectable()
export class UpdateFieldActionHandler implements ActionHandler {
  readonly type: WorkflowActionType = WORKFLOW_ACTION_TYPES.UPDATE_FIELD;

  constructor(private readonly prisma: PrismaService) {}

  async execute(config: unknown, context: ActionContext): Promise<void> {
    const cfg = config as UpdateFieldActionConfig;
    const payload = asPayloadRecord(context.event.payload);

    const entityId = resolveEntityId(cfg.model, payload);
    if (!entityId) {
      throw new Error(
        `updateField: could not resolve an id for model "${cfg.model}" from the payload of event ${context.event.name}`,
      );
    }

    const delegate = (this.prisma as unknown as Record<string, any>)[
      delegateName(cfg.model)
    ];
    if (!delegate || typeof delegate.update !== 'function') {
      throw new Error(`updateField: unknown Prisma model "${cfg.model}"`);
    }

    await delegate.update({
      where: { id: entityId },
      data: { [cfg.field]: cfg.value },
    });
  }
}
