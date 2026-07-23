/**
 * Event name registry — the shared vocabulary for the real-time event bus
 * (apps/api/src/core/event-bus), the workflow engine's triggers, the audit
 * log, and Socket.io room broadcasts.
 *
 * Naming convention: `<module>.<entity>.<past-tense-action>`.
 *
 * Adding a new event: add the name below, add its payload type to
 * `EventPayloadMap`, done — EventBusService.emit() is typed off this map so a
 * mismatched payload is a compile error, not a runtime surprise.
 */

export const EVENTS = {
  // Auth / session
  AUTH_USER_LOGGED_IN: 'auth.user.logged_in',
  AUTH_USER_LOGGED_OUT: 'auth.user.logged_out',

  // Admin
  ROLE_PERMISSIONS_UPDATED: 'admin.role.permissions_updated',

  // Inventory (module built in Phase 3 — shape defined now so Phase 2's
  // workflow engine has a real trigger to demo against).
  INVENTORY_STOCK_UPDATED: 'inventory.stock.updated',
  INVENTORY_STOCK_LOW: 'inventory.stock.low',

  // Sales (module built in Phase 3).
  SALES_ORDER_CREATED: 'sales.order.created',
  SALES_ORDER_CONFIRMED: 'sales.order.confirmed',
  SALES_ORDER_FULFILLED: 'sales.order.fulfilled',
  SALES_ORDER_CANCELLED: 'sales.order.cancelled',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/**
 * Standard envelope every domain event is wrapped in when published on the
 * event bus.
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

// --- Payload shapes ---------------------------------------------------------
// Kept here (not in the future inventory/sales module packages) so the event
// bus and workflow engine can be built and typed in Phase 2, before Phase 3
// implements the modules that actually emit these.

export interface InventoryStockUpdatedPayload {
  productId: string;
  productSku: string;
  warehouseId: string;
  quantityOnHand: number;
  quantityReserved: number;
  /** Signed change in quantityOnHand that produced this event. */
  delta: number;
  reason: 'reserve' | 'release' | 'commit' | 'adjust';
  referenceType?: string;
  referenceId?: string;
}

export interface InventoryStockLowPayload {
  productId: string;
  productSku: string;
  warehouseId: string;
  quantityOnHand: number;
  reorderPoint: number;
}

export interface SalesOrderEventPayload {
  orderId: string;
  orderNumber: string;
  customerId: string;
  status: 'draft' | 'confirmed' | 'fulfilled' | 'cancelled';
  totalAmount: string;
}

export interface RolePermissionsUpdatedPayload {
  roleId: string;
  permissionKeys: string[];
}

export interface AuthSessionPayload {
  userId: string;
  email: string;
}

/** Maps each {@link EventName} to its payload type — keeps emit()/@OnEvent() typed. */
export interface EventPayloadMap {
  [EVENTS.AUTH_USER_LOGGED_IN]: AuthSessionPayload;
  [EVENTS.AUTH_USER_LOGGED_OUT]: AuthSessionPayload;
  [EVENTS.ROLE_PERMISSIONS_UPDATED]: RolePermissionsUpdatedPayload;
  [EVENTS.INVENTORY_STOCK_UPDATED]: InventoryStockUpdatedPayload;
  [EVENTS.INVENTORY_STOCK_LOW]: InventoryStockLowPayload;
  [EVENTS.SALES_ORDER_CREATED]: SalesOrderEventPayload;
  [EVENTS.SALES_ORDER_CONFIRMED]: SalesOrderEventPayload;
  [EVENTS.SALES_ORDER_FULFILLED]: SalesOrderEventPayload;
  [EVENTS.SALES_ORDER_CANCELLED]: SalesOrderEventPayload;
}
