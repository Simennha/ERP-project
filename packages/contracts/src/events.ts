/**
 * Event name registry (PLACEHOLDER for a later phase).
 *
 * The full event catalog and the event bus itself (Socket.io + Redis pub/sub)
 * arrive in a later phase. This file establishes the naming convention
 * (`<module>.<entity>.<past-tense-action>`) and the `DomainEvent` envelope so
 * later phases extend rather than reinvent it.
 */

export const EVENTS = {
  // Auth / session
  AUTH_USER_LOGGED_IN: 'auth.user.logged_in',
  AUTH_USER_LOGGED_OUT: 'auth.user.logged_out',

  // Placeholder cross-module examples (fleshed out later)
  INVENTORY_STOCK_ADJUSTED: 'inventory.stock.adjusted',
  SALES_ORDER_CREATED: 'sales.order.created',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/**
 * Standard envelope every domain event is wrapped in when published on the
 * (future) event bus. `payload` is typed per-event in a later phase.
 */
export interface DomainEvent<TPayload = unknown> {
  /** One of the registered {@link EVENTS} values. */
  name: EventName;
  /** Company the event belongs to (single-company install, but always set). */
  companyId: string;
  /** ISO-8601 timestamp of when the event occurred. */
  occurredAt: string;
  /** User who triggered the event, if any (system events may be null). */
  actorUserId?: string | null;
  /** Event-specific data. */
  payload: TPayload;
}
