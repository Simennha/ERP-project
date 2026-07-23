import * as React from 'react';
import { cn } from '../lib/cn';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONE_STYLES: Record<StatusTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  danger: 'bg-destructive/15 text-destructive',
};

export interface StatusBadgeProps {
  label: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}

/**
 * Shared status/lifecycle indicator (draft/active/paid/cancelled/...) — a
 * colored pill pairs a background tint with the status text itself, so the
 * distinction never relies on color alone (WCAG 1.4.1). Deliberately kept
 * `rounded` (not the app's square buttons): tags are non-interactive, and the
 * shape contrast helps a user tell "status" from "action" at a glance, the
 * way SAP Fiori's ObjectStatus and most enterprise ERPs do.
 */
export function StatusBadge({ label, tone = 'neutral', className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium capitalize',
        TONE_STYLES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
