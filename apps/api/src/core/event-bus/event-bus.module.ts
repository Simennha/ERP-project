import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EventBusService } from './event-bus.service';
import { RealtimeGateway } from './realtime.gateway';
import { RedisPublisherService } from './redis-publisher.service';

/**
 * Wires the real-time event bus: the injectable {@link EventBusService}, the
 * Socket.io {@link RealtimeGateway}, and the {@link RedisPublisherService}
 * fan-out client.
 *
 * ── Dependency this module relies on but does NOT register ──────────────────
 * `EventEmitter2` must be provided app-wide by
 *   `EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' })`
 * registered ONCE in AppModule (per NestJS guidance, `forRoot` belongs at the
 * root, not in a feature module). Wildcard mode is required for the gateway's
 * `@OnEvent('**')` catch-all. See the orchestrator report for the exact lines.
 *
 * `JwtModule.register({})` is imported here (mirroring AuthModule) so the
 * gateway can inject `JwtService` to verify handshake tokens. `ConfigModule` is
 * already global, but is imported explicitly for clarity.
 */
@Module({
  imports: [ConfigModule, JwtModule.register({})],
  providers: [EventBusService, RealtimeGateway, RedisPublisherService],
  exports: [EventBusService, RealtimeGateway],
})
export class EventBusModule {}
