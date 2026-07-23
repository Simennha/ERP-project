import { Injectable } from '@nestjs/common';
import {
  WORKFLOW_ACTION_TYPES,
  type UpdateFieldActionConfig,
  type WorkflowActionType,
} from '@erp/contracts';

import { PrismaService } from '../../../prisma/prisma.service';
import { asPayloadRecord } from '../interpolate';
import { assertAllowedField, assertAllowedModel, delegateName, resolveEntityId } from '../prisma-dynamic';
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
 *
 * SECURITY: `model`/`field` come from admin-supplied config, not fixed code —
 * see prisma-dynamic.ts's docblock for the three layers that keep this from
 * being a privilege-escalation path. The `updateMany` (not `update`) below is
 * the third layer: scoping `where` by `companyId` as well as `id` makes a
 * cross-tenant write a guaranteed no-op (`count === 0`) instead of silently
 * succeeding against another company's row.
 */
@Injectable()
export class UpdateFieldActionHandler implements ActionHandler {
  readonly type: WorkflowActionType = WORKFLOW_ACTION_TYPES.UPDATE_FIELD;

  constructor(private readonly prisma: PrismaService) {}

  async execute(config: unknown, context: ActionContext): Promise<void> {
    const cfg = config as UpdateFieldActionConfig;
    assertAllowedModel(cfg.model);
    assertAllowedField(cfg.field);

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
    if (!delegate || typeof delegate.updateMany !== 'function') {
      throw new Error(`updateField: unknown Prisma model "${cfg.model}"`);
    }

    const result = await delegate.updateMany({
      where: { id: entityId, companyId: context.companyId },
      data: { [cfg.field]: cfg.value },
    });
    if (result.count === 0) {
      throw new Error(
        `updateField: no ${cfg.model} row ${entityId} found in company ${context.companyId} (wrong tenant or already deleted)`,
      );
    }
  }
}
