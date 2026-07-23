import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { EventBusModule } from '../event-bus/event-bus.module';
import { NotificationsController } from './notifications.controller';
import { NotificationService } from './notifications.service';
import { REALTIME_BROADCASTER } from './realtime-broadcaster';
import { SocketIoRealtimeBroadcaster } from './socket-io-realtime.broadcaster';

/**
 * Notifications module.
 *
 * `REALTIME_BROADCASTER` is bound to {@link SocketIoRealtimeBroadcaster}, which
 * delegates to the real-time gateway's per-user room (see
 * `core/event-bus/realtime.gateway.ts`). NotificationService itself only
 * depends on the `RealtimeBroadcaster` abstraction — swapping this binding
 * back to `NoopRealtimeBroadcaster` (still exported from `./realtime-broadcaster`)
 * would make the module standalone again with no other code changes.
 */
@Module({
  imports: [PrismaModule, EventBusModule],
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    { provide: REALTIME_BROADCASTER, useClass: SocketIoRealtimeBroadcaster },
  ],
  exports: [NotificationService, REALTIME_BROADCASTER],
})
export class NotificationsModule {}
