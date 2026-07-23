import { type INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Socket.io adapter that fans WebSocket room broadcasts out across API
 * instances via a Redis pub/sub pair (`@socket.io/redis-adapter`).
 *
 * Wired in `main.ts`:
 *   const adapter = new RedisIoAdapter(app, config);
 *   await adapter.connectToRedis();     // safe if Redis is down
 *   app.useWebSocketAdapter(adapter);
 *
 * Graceful degradation: if Redis can't be reached at boot we log a warning and
 * fall back to Socket.io's default in-memory adapter (correct for a single
 * instance). Boot never fails on a missing Redis in dev.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private readonly corsOrigin: string;

  constructor(
    app: INestApplicationContext,
    private readonly config: ConfigService,
  ) {
    super(app);
    this.corsOrigin = config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
  }

  /**
   * Attempt to connect the pub/sub pair. Bounded: retryStrategy gives up after
   * a few tries so a missing Redis rejects promptly instead of hanging boot.
   */
  async connectToRedis(): Promise<void> {
    const url = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    const options = {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      // Return null to stop retrying so connect() rejects fast when Redis is down.
      retryStrategy: (times: number): number | null =>
        times > 3 ? null : Math.min(times * 200, 1000),
    };

    const pubClient = new Redis(url, options);
    const subClient = pubClient.duplicate();

    // Attach error listeners BEFORE connecting so a failed attempt can't throw
    // an unhandled 'error' on the process.
    pubClient.on('error', (e: Error) => this.logger.debug(`Redis adapter pub error: ${e.message}`));
    subClient.on('error', (e: Error) => this.logger.debug(`Redis adapter sub error: ${e.message}`));

    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('Socket.io Redis adapter connected (cross-instance fan-out enabled)');
    } catch (err) {
      this.logger.warn(
        `Socket.io Redis adapter unavailable (${(err as Error).message}); ` +
          'running single-instance with the in-memory adapter.',
      );
      pubClient.disconnect();
      subClient.disconnect();
      this.adapterConstructor = null;
    }
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    // Inject CORS for the WebSocket server (separate from the HTTP CORS set in
    // main.ts) so the Next.js dev origin can open an authenticated socket.
    const server = super.createIOServer(port, {
      ...(options ?? {}),
      cors: {
        origin: this.corsOrigin,
        credentials: true,
      },
    }) as Server;

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
