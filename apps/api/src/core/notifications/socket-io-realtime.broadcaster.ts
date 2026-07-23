import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from '../event-bus/realtime.gateway';
import type { RealtimeBroadcaster } from './realtime-broadcaster';

/**
 * Real {@link RealtimeBroadcaster} binding, wired in NotificationsModule once
 * the event-bus module exists. Delegates straight to RealtimeGateway's
 * per-user room so a live notification reaches any connected socket for that
 * user without NotificationService knowing Socket.io exists.
 */
@Injectable()
export class SocketIoRealtimeBroadcaster implements RealtimeBroadcaster {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.gateway.emitToUser(userId, event, payload);
  }
}
