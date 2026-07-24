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
 * Notification bell + dropdown, docked into `AppShell`'s top bar (which
 * mounts it once, globally, on every authenticated page). Positioned via a
 * plain `relative` wrapper — the shell controls placement; this component
 * only anchors its own dropdown.
 */
export function NotificationBell() {
  const { user, getAccessToken } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
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
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-none text-shell-foreground transition-colors hover:bg-shell-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <div
          role="region"
          aria-labelledby="notification-bell-heading"
          className="absolute right-0 mt-2 w-80 rounded-lg border border-border bg-card text-card-foreground shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span id="notification-bell-heading" className="text-sm font-semibold">
              Notifications
            </span>
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
                        'flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                        !notification.isRead && 'bg-secondary/50',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={cn('font-medium', !notification.isRead && 'font-semibold')}>
                          {notification.title}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {notification.link && (
                            <span aria-hidden="true" className="text-muted-foreground" title="Opens a link">
                              →
                            </span>
                          )}
                          {!notification.isRead && <span className="h-2 w-2 rounded-full bg-primary" />}
                        </span>
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
