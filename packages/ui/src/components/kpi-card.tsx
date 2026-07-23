import * as React from 'react';
import { cn } from '../lib/cn';
import { Card, CardContent, CardHeader, CardTitle } from './card';

export type KpiDeltaDirection = 'up' | 'down' | 'neutral';

export interface KpiCardProps {
  title: string;
  value: React.ReactNode;
  /** Optional change indicator, e.g. { value: '+12.5%', direction: 'up' }. */
  delta?: { value: string; direction?: KpiDeltaDirection };
  /** Optional supporting text under the value. */
  hint?: string;
  /** Optional leading icon/element. */
  icon?: React.ReactNode;
  className?: string;
}

const deltaColor: Record<KpiDeltaDirection, string> = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-red-600 dark:text-red-400',
  neutral: 'text-muted-foreground',
};

/** Compact metric tile for executive dashboards (drill-down comes in a later phase). */
export function KpiCard({ title, value, delta, hint, icon, className }: KpiCardProps) {
  const direction = delta?.direction ?? 'neutral';
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="mt-1 flex items-center gap-2 text-xs">
          {delta ? <span className={cn('font-medium', deltaColor[direction])}>{delta.value}</span> : null}
          {hint ? <span className="text-muted-foreground">{hint}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
