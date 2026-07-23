/**
 * Constants for the real-time event bus (apps/api/src/core/event-bus).
 */

/**
 * Redis pub/sub channel every {@link DomainEvent} envelope is published to.
 *
 * This is the *application-level* fan-out channel used by
 * {@link EventBusService} — it is separate from the low-level channels the
 * Socket.io Redis adapter (`@socket.io/redis-adapter`) uses internally to sync
 * WebSocket rooms across instances. Other API instances (or out-of-process
 * workers) can `SUBSCRIBE erp:events` to observe the same stream that
 * in-process `@OnEvent` listeners see.
 */
export const EVENT_BUS_CHANNEL = 'erp:events';
