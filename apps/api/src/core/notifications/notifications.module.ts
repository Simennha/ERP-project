import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationService } from './notifications.service';
import {
  NoopRealtimeBroadcaster,
  REALTIME_BROADCASTER,
} from './realtime-broadcaster';

/**
 * Notifications module.
 *
 * Standalone by design: ships with the {@link NoopRealtimeBroadcaster} bound to
 * {@link REALTIME_BROADCASTER}, so persistence + REST work with no dependency on
 * the (parallel-built) event-bus / Socket.io gateway.
 *
 * Exports `NotificationService` so later phases (e.g. the workflow engine's
 * `notify` action) can inject it directly, and re-exports `REALTIME_BROADCASTER`
 * so the binding can be overridden from the composition root once the real
 * gateway exists.
 *
 * ---------------------------------------------------------------------------
 * LATER (orchestrator, once `apps/api/src/core/event-bus` lands) — swap the
 * broadcaster provider for the real one, e.g.:
 *
 *   providers: [
 *     NotificationService,
 *     { provide: REALTIME_BROADCASTER, useClass: SocketIoRealtimeBroadcaster },
 *   ],
 *   imports: [PrismaModule, EventBusModule],
 *
 * No change to NotificationService is required — it depends only on the
 * RealtimeBroadcaster abstraction.
 * ---------------------------------------------------------------------------
 */
@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    { provide: REALTIME_BROADCASTER, useClass: NoopRealtimeBroadcaster },
  ],
  exports: [NotificationService, REALTIME_BROADCASTER],
})
export class NotificationsModule {}
