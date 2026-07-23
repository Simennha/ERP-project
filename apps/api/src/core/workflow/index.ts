/**
 * Public surface of the workflow/automation engine. Other modules (if any later
 * phase needs it) import from here:
 *   import { WorkflowService } from '../core/workflow';
 */
export { WorkflowModule } from './workflow.module';
export { WorkflowService } from './workflow.service';
export { WorkflowEngineService } from './workflow.engine.service';
export { ActionHandlerRegistry } from './action-handler.registry';
export type { ActionContext, ActionHandler } from './actions/action-handler';
