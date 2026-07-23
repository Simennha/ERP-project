import { Injectable } from '@nestjs/common';
import {
  WORKFLOW_ACTION_TYPES,
  type CreateRecordActionConfig,
  type WorkflowActionType,
} from '@erp/contracts';

import { PrismaService } from '../../../prisma/prisma.service';
import { asPayloadRecord, interpolateRecord } from '../interpolate';
import { delegateName } from '../prisma-dynamic';
import type { ActionContext, ActionHandler } from './action-handler';

/**
 * `createRecord` — create a new row of the configured Prisma model, with
 * top-level string values in `data` interpolated from the event payload
 * (`{{fieldName}}`). Dynamic delegate access mirrors audit.extension.ts.
 *
 * Unknown model names throw, which the engine records as an action failure.
 */
@Injectable()
export class CreateRecordActionHandler implements ActionHandler {
  readonly type: WorkflowActionType = WORKFLOW_ACTION_TYPES.CREATE_RECORD;

  constructor(private readonly prisma: PrismaService) {}

  async execute(config: unknown, context: ActionContext): Promise<void> {
    const cfg = config as CreateRecordActionConfig;
    const payload = asPayloadRecord(context.event.payload);
    const data = interpolateRecord(cfg.data ?? {}, payload);

    const delegate = (this.prisma as unknown as Record<string, any>)[
      delegateName(cfg.model)
    ];
    if (!delegate || typeof delegate.create !== 'function') {
      throw new Error(`createRecord: unknown Prisma model "${cfg.model}"`);
    }

    await delegate.create({ data });
  }
}
