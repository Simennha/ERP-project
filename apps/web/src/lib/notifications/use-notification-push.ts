'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '../auth/api-client';
import { useAuth } from '../auth/auth-context';
import type { NotificationDto } from './api';

/**
 * Raw socket.io event name `NotificationService.send()` broadcasts under (see
 * apps/api/src/core/notifications/notifications.service.ts and
 * RealtimeGateway.emitToUser). This is a DIFFERENT channel from
 * `useDomainEvents()`'s `'domain-event'` — deliberately, not by oversight:
 *
 * `EventBusService.emit()` (which powers `useDomainEvents`) always broadcasts
 * to the whole `company:{companyId}` room. A notification is targeted at one
 * user; routing it through the company-wide domain-event bus would leak every
 * user's notification payloads (title/body/link) to every other connected
 * user in the company. `RealtimeGateway.emitToUser()` instead delivers only
 * to that user's own `user:{userId}` room, which is the correct scope. So
 * this stays a second, purpose-built hook rather than folding into
 * `useDomainEvents`.
 */
const NOTIFICATION_CREATED_EVENT = 'notification.created';

/**
 * Subscribe to live-pushed notifications for the current user.
 *
 * Opens its own Socket.io connection (same handshake/auth convention as
 * `useDomainEvents` — RealtimeGateway accepts any number of connections per
 * user), authenticated with the current access token, and calls `onCreated`
 * for every notification pushed to this user in real time. Disconnects on
 * unmount or when the token changes.
 */
export function useNotificationPush(onCreated: (notification: NotificationDto) => void): void {
  const { getAccessToken, user } = useAuth();
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;

  const token = user ? getAccessToken() : null;

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket: Socket = io(API_BASE_URL, {
      auth: { token },
      reconnectionAttempts: 5,
    });

    const handler = (notification: NotificationDto) => {
      onCreatedRef.current(notification);
    };

    socket.on(NOTIFICATION_CREATED_EVENT, handler);

    return () => {
      socket.off(NOTIFICATION_CREATED_EVENT, handler);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
}
