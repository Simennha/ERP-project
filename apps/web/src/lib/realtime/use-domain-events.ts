'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '../auth/api-client';
import { useAuth } from '../auth/auth-context';

/**
 * Client-side shape of the envelope broadcast by RealtimeGateway (see
 * apps/api/src/core/event-bus/realtime.gateway.ts). Kept minimal/local rather
 * than importing @erp/contracts' DomainEvent to avoid coupling this thin
 * client to the full payload-type map — callers narrow on `name` themselves.
 */
export interface RealtimeDomainEvent {
  name: string;
  companyId: string;
  occurredAt: string;
  actorUserId?: string | null;
  payload: unknown;
}

/** The single socket event name every domain event is delivered under (see RealtimeGateway). */
const DOMAIN_EVENT = 'domain-event';

/**
 * Subscribe to every real-time domain event for the current user's company.
 *
 * Opens one Socket.io connection per mount, authenticated the same way the
 * gateway expects: `io(url, { auth: { token: accessToken } })` (see
 * RealtimeGateway's handshake convention docblock). Reconnects automatically
 * if the access token changes (e.g. after a refresh-triggered reload) and
 * always disconnects on unmount.
 *
 * `onEvent` is called for EVERY event the company's room receives — filter by
 * `event.name` (one of `@erp/contracts` EVENTS) in the callback. Pass a
 * `filter` to only invoke the callback for a specific event name (convenience
 * for the common single-event case).
 */
export function useDomainEvents(
  onEvent: (event: RealtimeDomainEvent) => void,
  filter?: string,
): void {
  const { getAccessToken, user } = useAuth();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const token = user ? getAccessToken() : null;

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket: Socket = io(API_BASE_URL, {
      auth: { token },
      // Real-time is a nice-to-have, not load-bearing — don't retry forever
      // or spam the console if the API/Redis adapter is unavailable.
      reconnectionAttempts: 5,
    });

    const handler = (event: RealtimeDomainEvent) => {
      if (filter && event.name !== filter) {
        return;
      }
      onEventRef.current(event);
    };

    socket.on(DOMAIN_EVENT, handler);

    return () => {
      socket.off(DOMAIN_EVENT, handler);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filter]);
}
