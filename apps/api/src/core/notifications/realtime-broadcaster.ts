import { Injectable, Logger } from '@nestjs/common';

/**
 * Injection token for the real-time broadcaster used to push live
 * notifications to a connected user (e.g. over WebSockets / Socket.io).
 *
 * ---------------------------------------------------------------------------
 * DECOUPLING CONTRACT (read before wiring):
 *
 * This token is intentionally defined *inside* the notifications module so
 * that `NotificationService` never imports anything from
 * `apps/api/src/core/event-bus` (the Socket.io gateway built by a sibling
 * agent, which may not exist yet). The module ships with a
 * {@link NoopRealtimeBroadcaster} default binding so it works standalone.
 *
 * LATER INTEGRATION (done by the orchestrator once the event-bus module
 * exists): rebind this token to the real gateway-backed implementation. That
 * is a one-line DI change, not a code change — see the rebind snippet in the
 * agent report / module file. No edit to `NotificationService` is required,
 * because the service only ever depends on the {@link RealtimeBroadcaster}
 * abstraction below.
 * ---------------------------------------------------------------------------
 */
export const REALTIME_BROADCASTER = Symbol('REALTIME_BROADCASTER');

/**
 * Minimal abstraction over a real-time transport. The only capability the
 * notification system needs is "push an event+payload to one specific user".
 * Keeping this interface tiny is what lets us stay fully decoupled from the
 * concrete Socket.io gateway.
 */
export interface RealtimeBroadcaster {
  /**
   * Emit `event` with `payload` to every live connection belonging to
   * `userId`. Implementations MUST be non-throwing for a missing/offline
   * user (a user with no active socket is a normal case, not an error).
   */
  emitToUser(userId: string, event: string, payload: unknown): void;
}

/**
 * Default, dependency-free binding for {@link REALTIME_BROADCASTER}.
 *
 * Does nothing except log a debug line, so the notifications module is fully
 * functional on its own (persistence still works; only the live push is a
 * no-op). Replaced by the real gateway-backed broadcaster during the
 * integration step described on the token above.
 */
@Injectable()
export class NoopRealtimeBroadcaster implements RealtimeBroadcaster {
  private readonly logger = new Logger(NoopRealtimeBroadcaster.name);

  emitToUser(userId: string, event: string, _payload: unknown): void {
    this.logger.debug(
      `[noop] real-time broadcaster: would emit '${event}' to user ${userId}`,
    );
  }
}
