import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@erp/database';
import type { Paginated } from '@erp/contracts';

import { PrismaService } from '../../prisma/prisma.service';
import type { CreateWorkflowInput, UpdateWorkflowInput } from './workflow.schemas';

/** Client-facing shape of a WorkflowRun history row. */
interface WorkflowRunDto {
  id: string;
  workflowDefinitionId: string;
  triggeredByEvent: string;
  status: string;
  resultJson: unknown;
  error: string | null;
  createdAt: string;
}

/**
 * Convert an arbitrary JSON-ish value to a Prisma nullable-Json update input:
 *   undefined -> leave the column untouched
 *   null      -> set SQL NULL (Prisma.DbNull)
 *   other     -> store the value
 */
function toNullableJsonUpdate(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

/**
 * CRUD service for WorkflowDefinition (+ nested WorkflowActions) and read access
 * to WorkflowRun history. Everything is company-scoped: reads/writes filter by
 * the caller's companyId and a cross-company id resolves to 404 (never leaks
 * existence).
 */
@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  list(companyId: string) {
    return this.prisma.workflowDefinition.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: { actions: { orderBy: { order: 'asc' } } },
    });
  }

  async get(companyId: string, id: string) {
    const definition = await this.prisma.workflowDefinition.findFirst({
      where: { id, companyId },
      include: { actions: { orderBy: { order: 'asc' } } },
    });
    if (!definition) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }
    return definition;
  }

  create(companyId: string, userId: string, input: CreateWorkflowInput) {
    return this.prisma.workflowDefinition.create({
      data: {
        companyId,
        name: input.name,
        module: input.module,
        triggerEvent: input.triggerEvent,
        conditionsJson:
          input.conditions == null
            ? undefined
            : (input.conditions as Prisma.InputJsonValue),
        isActive: input.isActive ?? true,
        createdById: userId,
        updatedById: userId,
        actions: {
          create: input.actions.map((action, index) => ({
            order: action.order ?? index,
            type: action.type,
            configJson: action.config as Prisma.InputJsonValue,
          })),
        },
      },
      include: { actions: { orderBy: { order: 'asc' } } },
    });
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    input: UpdateWorkflowInput,
  ) {
    await this.ensureExists(companyId, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.workflowDefinition.update({
        where: { id },
        data: {
          name: input.name,
          module: input.module,
          triggerEvent: input.triggerEvent,
          conditionsJson: toNullableJsonUpdate(input.conditions),
          isActive: input.isActive,
          updatedById: userId,
        },
      });

      // Full-replace semantics: only touch actions when the caller sent them.
      if (input.actions !== undefined) {
        await tx.workflowAction.deleteMany({
          where: { workflowDefinitionId: id },
        });
        if (input.actions.length > 0) {
          await tx.workflowAction.createMany({
            data: input.actions.map((action, index) => ({
              workflowDefinitionId: id,
              order: action.order ?? index,
              type: action.type,
              configJson: action.config as Prisma.InputJsonValue,
            })),
          });
        }
      }

      return tx.workflowDefinition.findUniqueOrThrow({
        where: { id },
        include: { actions: { orderBy: { order: 'asc' } } },
      });
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.ensureExists(companyId, id);
    // Cascades delete the definition's actions and runs (see workflow.prisma).
    await this.prisma.workflowDefinition.delete({ where: { id } });
  }

  async listRuns(
    companyId: string,
    id: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<WorkflowRunDto>> {
    await this.ensureExists(companyId, id);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.workflowRun.findMany({
        where: { workflowDefinitionId: id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.workflowRun.count({ where: { workflowDefinitionId: id } }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        workflowDefinitionId: row.workflowDefinitionId,
        triggeredByEvent: row.triggeredByEvent,
        status: row.status,
        resultJson: row.resultJson,
        error: row.error,
        createdAt: row.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /** Assert a workflow exists for this company, else 404 (no existence leak). */
  private async ensureExists(companyId: string, id: string): Promise<void> {
    const found = await this.prisma.workflowDefinition.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }
  }
}
