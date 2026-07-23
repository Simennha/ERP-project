import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Thin, resilient wrapper around a single ioredis connection used only for the
 * *publish* side of the event bus (see {@link EventBusService}).
 *
 * Design goals:
 *  - Never crash app boot when Redis is unavailable (common in single-instance
 *    dev). We connect in the background, keep an `error` listener attached (so
 *    ioredis doesn't throw on the process), and treat publishing as best-effort.
 *  - Local in-process delivery via EventEmitter2 is the source of truth for a
 *    single instance; Redis pub/sub only exists so a 2+ instance deployment can
 *    fan events out cross-process without repainting the architecture.
 */
@Injectable()
export class RedisPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisPublisherService.name);
  private client: Redis | null = null;
  private ready = false;
  private errorLogged = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';

    // Non-lazy connect: ioredis connects in the background and auto-reconnects
    // per retryStrategy. We do NOT await it, so a missing Redis never blocks or
    // fails boot. `enableOfflineQueue: false` makes publishes fail fast (we also
    // guard on `ready`) rather than piling up commands while disconnected.
    const client = new Redis(url, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times: number) => Math.min(times * 500, 5000),
    });

    client.on('ready', () => {
      this.ready = true;
      this.errorLogged = false;
      this.logger.log('Redis publisher connected');
    });

    client.on('end', () => {
      this.ready = false;
    });

    client.on('error', (err: Error) => {
      this.ready = false;
      // Log once per outage to avoid flooding dev logs with reconnect noise.
      if (!this.errorLogged) {
        this.errorLogged = true;
        this.logger.warn(
          `Redis publisher unavailable (${err.message}). Cross-instance fan-out disabled; ` +
            'in-process delivery is unaffected.',
        );
      }
    });

    this.client = client;
  }

  /**
   * Best-effort publish. Silently no-ops when Redis is down so that a failed
   * fan-out never breaks the durable log write or local EventEmitter2 delivery
   * that already happened in {@link EventBusService.emit}.
   */
  async publish(channel: string, message: string): Promise<void> {
    if (!this.client || !this.ready) {
      return;
    }
    try {
      await this.client.publish(channel, message);
    } catch (err) {
      this.logger.warn(`Redis publish to "${channel}" failed: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        // Connection may already be down; nothing to clean up.
      }
      this.client = null;
    }
  }
}
