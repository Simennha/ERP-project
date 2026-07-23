import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { NotificationDto } from '@erp/contracts';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { NotificationService } from './notifications.service';

/**
 * Personal-data endpoints: a user only ever reads / mutates their OWN
 * notifications, identified from the JWT via `@CurrentUser()`. Authentication
 * is enforced globally by `JwtAuthGuard`, so no extra `@RequirePermission()` is
 * needed here — there is no "read other people's notifications" concept.
 */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  /**
   * GET /notifications?unreadOnly=&page=&pageSize=
   * Current user's notifications, newest first, paginated.
   *
   * Query params arrive as raw strings; they are coerced here and the service
   * defensively clamps page/pageSize, so bad input degrades to sane defaults
   * rather than erroring (works with or without a global transforming
   * ValidationPipe).
   */
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<{ items: NotificationDto[]; total: number }> {
    return this.notifications.listForUser(user.userId, {
      unreadOnly: unreadOnly === 'true' || unreadOnly === '1',
      page: page !== undefined ? Number.parseInt(page, 10) : undefined,
      pageSize: pageSize !== undefined ? Number.parseInt(pageSize, 10) : undefined,
    });
  }

  /**
   * POST /notifications/:id/read
   * Mark one of the current user's notifications as read.
   */
  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<NotificationDto> {
    return this.notifications.markRead(id, user.userId);
  }
}
