import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActionHandlerRegistry } from './action-handler.registry';
import { AssignTaskActionHandler } from './actions/assign-task.handler';
import { CallWebhookActionHandler } from './actions/call-webhook.handler';
import { CreateRecordActionHandler } from './actions/create-record.handler';
import { NotifyActionHandler } from './actions/notify.handler';
import { UpdateFieldActionHandler } from './actions/update-field.handler';
import { WorkflowController } from './workflow.controller';
import { WorkflowEngineService } from './workflow.engine.service';
import { WorkflowService } from './workflow.service';

/**
 * Workflow / automation engine module — the last piece of Phase 2.
 *
 * - Imports PrismaModule (@Global, imported explicitly for clarity) for DB
 *   access and NotificationsModule for the `notify`/`assignTask` handlers'
 *   NotificationService.
 * - EventEmitter2 (backing `@OnEvent('**')` in WorkflowEngineService) is
 *   provided app-wide by `EventEmitterModule.forRoot({ wildcard: true })` in
 *   AppModule — nothing to register here.
 * - Exports the services for consistency/testability; nothing in later phases
 *   currently depends on this module.
 */
@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [WorkflowController],
  providers: [
    WorkflowService,
    WorkflowEngineService,
    ActionHandlerRegistry,
    NotifyActionHandler,
    UpdateFieldActionHandler,
    CreateRecordActionHandler,
    CallWebhookActionHandler,
    AssignTaskActionHandler,
  ],
  exports: [WorkflowService, WorkflowEngineService],
})
export class WorkflowModule {}
