import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Prisma } from '@erp/database';
import type {
  DomainEvent,
  WorkflowActionResult,
  WorkflowActionType,
  WorkflowRunStatus,
} from '@erp/contracts';

import { PrismaService } from '../../prisma/prisma.service';
import { ActionHandlerRegistry } from './action-handler.registry';
import { evaluateConditions } from './conditions';
import { asPayloadRecord } from './interpolate';

/** Minimal structural shape of a loaded action (a Prisma row is assignable). */
interface LoadedAction {
  id: string;
  type: string;
  configJson: unknown;
}

/** Minimal structural shape of a loaded definition + its ordered actions. */
interface LoadedDefinition {
  id: string;
  conditionsJson: unknown;
  actions: LoadedAction[];
}

/**
 * The automation engine: a wildcard `@OnEvent('**')` listener (same mechanism
 * as RealtimeGateway) that reacts to every {@link DomainEvent} published on the
 * bus by {@link EventBusService}.
 *
 * For each active WorkflowDefinition whose `triggerEvent` matches the event, it
 * evaluates the json-logic `conditionsJson` against the payload, runs the
 * matching actions in order via {@link ActionHandlerRegistry}, and records the
 * outcome in a WorkflowRun row.
 *
 * INVARIANT: this handler is fire-and-forget automation and MUST NEVER throw
 * back into the event bus. The whole body is wrapped in try/catch, every action
 * is independently try/caught, and even the WorkflowRun persistence swallows its
 * own errors.
 */
@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ActionHandlerRegistry,
  ) {}

  @OnEvent('**')
  async handleDomainEvent(event: DomainEvent): Promise<void> {
    try {
      // Ignore anything that isn't a well-formed domain envelope. Not every
      // EventEmitter2 emission on this process is guaranteed to be one.
      if (
        !event ||
        typeof event.name !== 'string' ||
        typeof event.companyId !== 'string'
      ) {
        return;
      }

      const definitions = await this.prisma.workflowDefinition.findMany({
        where: {
          companyId: event.companyId,
          triggerEvent: event.name,
          isActive: true,
        },
        include: { actions: { orderBy: { order: 'asc' } } },
      });

      for (const definition of definitions) {
        await this.runDefinition(definition, event);
      }
    } catch (err) {
      this.logger.error(
        `Workflow engine failed handling event ${event?.name ?? '(unknown)'}: ${
          (err as Error).message
        }`,
        (err as Error).stack,
      );
    }
  }

  private async runDefinition(
    definition: LoadedDefinition,
    event: DomainEvent,
  ): Promise<void> {
    try {
      const payload = asPayloadRecord(event.payload);

      if (!evaluateConditions(definition.conditionsJson, payload)) {
        await this.recordRun(definition.id, event.name, 'skipped', [], null);
        return;
      }

      const results: WorkflowActionResult[] = [];
      for (const action of definition.actions) {
        results.push(await this.runAction(action, event));
      }

      await this.recordRun(definition.id, event.name, 'matched', results, null);
    } catch (err) {
      // Unexpected failure of the run itself (e.g. a DB error) — distinct from
      // an individual action throwing, which is captured per-action above.
      this.logger.error(
        `Workflow ${definition.id} run errored: ${(err as Error).message}`,
        (err as Error).stack,
      );
      await this.recordRun(
        definition.id,
        event.name,
        'error',
        [],
        (err as Error).message,
      );
    }
  }

  private async runAction(
    action: LoadedAction,
    event: DomainEvent,
  ): Promise<WorkflowActionResult> {
    const type = action.type as WorkflowActionType;
    const handler = this.registry.get(type);

    if (!handler) {
      return {
        actionId: action.id,
        type,
        status: 'error',
        error: `No handler registered for action type "${action.type}"`,
      };
    }

    try {
      await handler.execute(action.configJson, {
        companyId: event.companyId,
        actorUserId: event.actorUserId ?? null,
        event,
      });
      return { actionId: action.id, type, status: 'ok' };
    } catch (err) {
      return {
        actionId: action.id,
        type,
        status: 'error',
        error: (err as Error).message,
      };
    }
  }

  private async recordRun(
    workflowDefinitionId: string,
    triggeredByEvent: string,
    status: WorkflowRunStatus,
    results: WorkflowActionResult[],
    error: string | null,
  ): Promise<void> {
    try {
      await this.prisma.workflowRun.create({
        data: {
          workflowDefinitionId,
          triggeredByEvent,
          status,
          // WorkflowActionResult[] is JSON-serialisable; the cast bridges to
          // Prisma's InputJsonValue (same pattern as EventBusService).
          resultJson: results as unknown as Prisma.InputJsonValue,
          error: error ?? undefined,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to persist WorkflowRun for workflow ${workflowDefinitionId}: ${
          (err as Error).message
        }`,
      );
    }
  }
}
