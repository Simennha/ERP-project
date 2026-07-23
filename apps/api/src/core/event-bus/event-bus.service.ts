import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '@erp/database';
import type { DomainEvent, EventName, EventPayloadMap } from '@erp/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisPublisherService } from './redis-publisher.service';
import { EVENT_BUS_CHANNEL } from './event-bus.constants';

/**
 * The single entry point every module uses to publish a domain event.
 *
 * One {@link DomainEvent} envelope is constructed per call and reused for all
 * three delivery paths so the shape is identical everywhere:
 *   1. A durable `EventLog` row (survives process restarts; used for the
 *      workflow engine's "why didn't this fire" debugging and future replay).
 *   2. In-process `EventEmitter2` emit so same-process `@OnEvent` listeners
 *      (the workflow engine, the {@link RealtimeGateway}, ...) fire.
 *   3. A Redis pub/sub publish on {@link EVENT_BUS_CHANNEL} for cross-instance
 *      fan-out (best-effort; a down Redis does not fail the call).
 *
 * `emit()` is generically typed off {@link EventPayloadMap}, so passing a
 * payload that doesn't match the event name is a compile error.
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly redis: RedisPublisherService,
  ) {}

  async emit<K extends EventName>(
    name: K,
    companyId: string,
    payload: EventPayloadMap[K],
    actorUserId?: string | null,
  ): Promise<void> {
    const envelope: DomainEvent<EventPayloadMap[K]> = {
      name,
      companyId,
      occurredAt: new Date().toISOString(),
      actorUserId: actorUserId ?? null,
      payload,
    };

    // 1. Durable history first — this is the authoritative record and is
    //    intentionally awaited so a persistence failure surfaces to the caller.
    await this.prisma.eventLog.create({
      data: {
        companyId,
        eventName: name,
        // A typed payload interface has no index signature, so it is not
        // directly assignable to Prisma's InputJsonValue; the cast is safe
        // because every payload in EventPayloadMap is JSON-serialisable.
        payloadJson: payload as unknown as Prisma.InputJsonValue,
        actorUserId: actorUserId ?? null,
      },
    });

    // 2. Same-process listeners. Wildcard mode is enabled on EventEmitterModule
    //    (see EventBusModule docs / app.module wiring), so the gateway's
    //    `@OnEvent('**')` catch-all and any specific `@OnEvent(EVENTS.X)`
    //    listeners both receive this exact envelope.
    this.eventEmitter.emit(name, envelope);

    // 3. Cross-instance fan-out. Best-effort: no-ops when Redis is unavailable.
    await this.redis.publish(EVENT_BUS_CHANNEL, JSON.stringify(envelope));

    this.logger.debug(`Emitted ${name} for company ${companyId}`);
  }
}
