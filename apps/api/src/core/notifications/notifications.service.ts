import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  notificationInputSchema,
  type NotificationInput,
  type NotificationDto,
} from '@erp/contracts';

import { PrismaService } from '../../prisma/prisma.service';
import {
  REALTIME_BROADCASTER,
  type RealtimeBroadcaster,
} from './realtime-broadcaster';

/**
 * Structural shape of a persisted `Notification` row.
 *
 * Declared locally (instead of importing the Prisma-generated model type) so
 * this module stays free of any assumption about *where* the generated client
 * type is re-exported in this monorepo. A Prisma `create`/`findMany` result is
 * structurally assignable to this because it carries exactly these scalar
 * fields — see `packages/database/prisma/schema/notification.prisma`.
 */
interface NotificationRow {
  id: string;
  companyId: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  readAt: Date | null;
  sourceEvent: string | null;
  createdAt: Date;
}

/** Event name emitted on the real-time channel when a notification is created. */
export const NOTIFICATION_CREATED_EVENT = 'notification.created';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function clampPage(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_PAGE;
  return Math.max(1, Math.floor(value));
}

function clampPageSize(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REALTIME_BROADCASTER)
    private readonly broadcaster: RealtimeBroadcaster,
  ) {}

  /**
   * Validate, persist, then best-effort live-push a notification.
   *
   * The DB write is the source of truth; the real-time push is fire-and-forget
   * and MUST NOT be able to fail the request (a broadcaster error only means
   * the user misses the *live* toast — they still see the notification on next
   * fetch). Hence the try/catch around the broadcast.
   *
   * `listForUser`/`markRead` scope purely by `userId` (safe only because a
   * `userId` belongs to exactly one company) — that invariant is enforced
   * HERE, the one write path, rather than re-checked on every read. Every
   * caller (the workflow `notify`/`assignTask` handlers included) supplies
   * both `companyId` and `userId`, but neither is guaranteed to agree without
   * this check — without it, a misconfigured or malicious workflow config
   * could deliver one company's notification content to another company's
   * user.
   */
  async send(input: NotificationInput): Promise<NotificationDto> {
    const data = notificationInputSchema.parse(input);

    const recipient = await this.prisma.user.findFirst({
      where: { id: data.userId, companyId: data.companyId },
      select: { id: true },
    });
    if (!recipient) {
      throw new NotFoundException(`User ${data.userId} not found in company ${data.companyId}`);
    }

    const created = await this.prisma.notification.create({
      data: {
        companyId: data.companyId,
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body ?? null,
        link: data.link ?? null,
        sourceEvent: data.sourceEvent ?? null,
      },
    });

    const dto = this.toDto(created);

    try {
      this.broadcaster.emitToUser(created.userId, NOTIFICATION_CREATED_EVENT, dto);
    } catch (err) {
      this.logger.warn(
        `real-time broadcast failed for notification ${dto.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return dto;
  }

  /**
   * Mark a single notification as read, enforcing ownership.
   *
   * Ownership handling — WHY 404 (NotFoundException) and not 403 (Forbidden):
   * a notification that does not exist and one that exists but belongs to a
   * *different* user are treated identically (both -> 404). Returning 403 for
   * the second case would leak the existence of other users' notification ids
   * (an IDOR / enumeration signal). To a caller, "not yours" is
   * indistinguishable from "not found", which is the privacy-preserving
   * choice.
   *
   * The write itself is a race-free, idempotent `updateMany` scoped to the
   * owner's *unread* rows, so re-marking an already-read notification is a
   * no-op that still returns the (unchanged) row rather than erroring.
   */
  async markRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationDto> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    const row = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!row) {
      throw new NotFoundException('Notification not found');
    }

    return this.toDto(row);
  }

  /**
   * List the given user's notifications, newest first, paginated.
   * `total` is the count matching the same filter (for building page controls).
   */
  async listForUser(
    userId: string,
    opts: { unreadOnly?: boolean; page?: number; pageSize?: number },
  ): Promise<{ items: NotificationDto[]; total: number }> {
    const page = clampPage(opts.page);
    const pageSize = clampPageSize(opts.pageSize);

    const where = {
      userId,
      ...(opts.unreadOnly ? { isRead: false } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toDto(row)),
      total,
    };
  }

  /**
   * Map a persisted row to the client-facing DTO.
   *
   * `NotificationDto` (see packages/contracts/src/notifications.ts) is
   * intentionally narrower than the full Prisma row: it omits `companyId` /
   * `userId` (redundant — these endpoints only ever return the caller's own
   * notifications) and `readAt` (not currently part of the contract), and
   * types `createdAt` as an ISO string rather than `Date`.
   */
  private toDto(row: NotificationRow): NotificationDto {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      link: row.link,
      isRead: row.isRead,
      sourceEvent: row.sourceEvent,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
