import { Injectable } from '@nestjs/common';
import {
  WORKFLOW_ACTION_TYPES,
  type CallWebhookActionConfig,
  type WorkflowActionType,
} from '@erp/contracts';

import { assertPublicHttpUrl } from './ssrf-guard';
import type { ActionContext, ActionHandler } from './action-handler';

/** Abort the webhook POST if the endpoint hasn't responded in this window. */
const WEBHOOK_TIMEOUT_MS = 10_000;

/**
 * `callWebhook` — POST the full DomainEvent envelope as JSON to an external URL.
 *
 * Uses Node's global `fetch` (the repo targets Node >= 20.11, which ships fetch
 * and `AbortSignal.timeout`). A non-2xx response, a network error, or a timeout
 * all throw; the engine catches that and records the action as failed rather
 * than letting it crash the run.
 *
 * SECURITY: `cfg.url` comes from admin-supplied config — see ssrf-guard.ts for
 * why the target is resolved and checked against private/reserved IP ranges
 * before the request is made.
 */
@Injectable()
export class CallWebhookActionHandler implements ActionHandler {
  readonly type: WorkflowActionType = WORKFLOW_ACTION_TYPES.CALL_WEBHOOK;

  async execute(config: unknown, context: ActionContext): Promise<void> {
    const cfg = config as CallWebhookActionConfig;
    await assertPublicHttpUrl(cfg.url);

    const response = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cfg.headers ?? {}),
      },
      body: JSON.stringify(context.event),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `callWebhook: POST ${cfg.url} returned ${response.status} ${response.statusText}`,
      );
    }
  }
}
