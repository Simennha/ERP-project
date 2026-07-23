/**
 * Public surface of the real-time event bus. Other modules import from here:
 *   import { EventBusService, RealtimeGateway } from '../core/event-bus';
 */
export { EventBusModule } from './event-bus.module';
export { EventBusService } from './event-bus.service';
export { RealtimeGateway, REALTIME_EVENT } from './realtime.gateway';
export { RedisPublisherService } from './redis-publisher.service';
export { RedisIoAdapter } from './redis-io.adapter';
export { EVENT_BUS_CHANNEL } from './event-bus.constants';
