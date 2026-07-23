import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { AccessTokenPayload, DomainEvent } from '@erp/contracts';

/**
 * Client-facing socket event name every broadcast domain event is delivered
 * under. The frontend listens for this one event and switches on
 * `envelope.name` (one of `@erp/contracts` EVENTS) to route it.
 */
export const REALTIME_EVENT = 'domain-event';

/** Shape stashed on `socket.data` after a successful handshake. */
interface SocketData {
  userId: string;
  companyId: string;
  email: string;
}

/**
 * Socket.io gateway for real-time delivery.
 *
 * ── Handshake auth convention (the frontend must match this) ────────────────
 * On connect the client MUST present a valid, unexpired JWT **access token**
 * (the same token used for `Authorization: Bearer` on the REST API). It is read
 * from, in priority order:
 *   1. `socket.handshake.auth.token`  ← preferred
 *        io(url, { auth: { token: accessToken } })
 *   2. the `Authorization: Bearer <token>` handshake header
 *   3. the `?token=<token>` query string (last-resort, e.g. native clients)
 * The token is verified with `JWT_ACCESS_SECRET` exactly as `JwtStrategy` does.
 * Unauthenticated / invalid connections are disconnected immediately.
 *
 * On success the socket joins two rooms:
 *   - `company:{companyId}` — every domain event for the company is broadcast
 *     here.
 *   - `user:{userId}`       — targeted pushes (e.g. notifications) via
 *     {@link emitToUser}.
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.debug(`Rejecting socket ${client.id}: no access token in handshake`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      const data: SocketData = {
        userId: payload.sub,
        companyId: payload.companyId,
        email: payload.email,
      };
      client.data = data;

      await client.join(this.companyRoom(data.companyId));
      await client.join(this.userRoom(data.userId));

      this.logger.debug(
        `Socket ${client.id} authenticated as user ${data.userId} (company ${data.companyId})`,
      );
    } catch (err) {
      this.logger.debug(`Rejecting socket ${client.id}: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket ${client.id} disconnected`);
  }

  /**
   * Catch-all listener for every domain event emitted via
   * {@link EventBusService.emit}. Requires wildcard mode on EventEmitterModule
   * (configured at the app level). New event types need no gateway changes.
   */
  @OnEvent('**')
  handleDomainEvent(event: DomainEvent): void {
    // Ignore anything that isn't a well-formed domain envelope, and no-op if the
    // server isn't ready yet (events only fire post-boot, but be defensive).
    if (!this.server || !event || typeof event.companyId !== 'string') {
      return;
    }
    this.server.to(this.companyRoom(event.companyId)).emit(REALTIME_EVENT, event);
  }

  /**
   * Push an arbitrary message to a single user's room. For modules (e.g.
   * notifications) that need to deliver something that is NOT a domain event.
   */
  emitToUser<T = unknown>(userId: string, event: string, payload: T): void {
    if (!this.server) {
      return;
    }
    this.server.to(this.userRoom(userId)).emit(event, payload);
  }

  /** Push an arbitrary message to every socket of a company. */
  emitToCompany<T = unknown>(companyId: string, event: string, payload: T): void {
    if (!this.server) {
      return;
    }
    this.server.to(this.companyRoom(companyId)).emit(event, payload);
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    if (auth && typeof auth.token === 'string' && auth.token.length > 0) {
      return auth.token;
    }

    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.length > 0) {
      return queryToken;
    }

    return null;
  }

  private companyRoom(companyId: string): string {
    return `company:${companyId}`;
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
