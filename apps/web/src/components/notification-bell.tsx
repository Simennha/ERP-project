'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { listNotifications, markNotificationRead, type NotificationDto } from '@/lib/notifications/api';
import { useNotificationPush } from '@/lib/notifications/use-notification-push';

const LIST_PAGE_SIZE = 20;

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/**
 * Global notification bell + dropdown, mounted once from `Providers` so it's
 * available on every page. There is no app shell/header to dock it into yet
 * (see README "Suggested next phases" — a real nav is later scope), so it
 * renders as a small fixed top-right control instead of pretending to be part
 * of one.
 */
export function NotificationBell() {
  const { user, getAccessToken } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setIsLoading(true);
    try {
      const [all, unread] = await Promise.all([
        listNotifications(token, { page: 1, pageSize: LIST_PAGE_SIZE }),
        listNotifications(token, { unreadOnly: true, page: 1, pageSize: 1 }),
      ]);
      setItems(all.items);
      setUnreadCount(unread.total);
    } catch {
      // Best-effort: the bell just stays at its last-known state on failure.
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (user) {
      void refresh();
    } else {
      setItems([]);
      setUnreadCount(0);
    }
  }, [user, refresh]);

  // Live push: new notifications prepend immediately without waiting for the
  // next open/poll.
  useNotificationPush(
    useCallback((notification: NotificationDto) => {
      setItems((prev) => [notification, ...prev].slice(0, LIST_PAGE_SIZE));
      setUnreadCount((prev) => prev + 1);
    }, []),
  );

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = useCallback(
    async (notification: NotificationDto) => {
      if (!notification.isRead) {
        const token = getAccessToken();
        setItems((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        try {
          await markNotificationRead(token, notification.id);
        } catch {
          // Best-effort: a failed mark-read just means it reappears as unread
          // next refresh, which is harmless.
        }
      }
      setOpen(false);
      if (notification.link) {
        router.push(notification.link);
      }
    },
    [getAccessToken, router],
  );

  if (!user) {
    return null;
  }

  return (
    <div ref={containerRef} className="fixed right-4 top-4 z-50">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-medium text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-lg border border-border bg-card text-card-foreground shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {isLoading && items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              <ul>
                {items.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => void handleSelect(notification)}
                      className={cn(
                        'flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-accent',
                        !notification.isRead && 'bg-secondary/50',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={cn('font-medium', !notification.isRead && 'font-semibold')}>
                          {notification.title}
                        </span>
                        {!notification.isRead && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      {notification.body && (
                        <span className="text-muted-foreground">{notification.body}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
