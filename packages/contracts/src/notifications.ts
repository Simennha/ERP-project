import { z } from 'zod';

/**
 * Input shape for NotificationService.send() (apps/api/src/core/notifications).
 * Used both by services calling it directly and by the workflow engine's
 * `notify` action handler.
 */
export const notificationInputSchema = z.object({
  companyId: z.string(),
  userId: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string().optional(),
  link: z.string().optional(),
  /** Name of the domain event that caused this notification, if any. */
  sourceEvent: z.string().optional(),
});
export type NotificationInput = z.infer<typeof notificationInputSchema>;

/** Shape returned to the client (bell icon list, live push payload). */
export const notificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  link: z.string().nullable(),
  isRead: z.boolean(),
  createdAt: z.string(),
  sourceEvent: z.string().nullable(),
});
export type NotificationDto = z.infer<typeof notificationSchema>;
