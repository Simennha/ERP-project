'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth/auth-context';
import { NotificationBell } from './notification-bell';

/** Client-side providers wrapper mounted once in the root layout. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <NotificationBell />
    </AuthProvider>
  );
}
