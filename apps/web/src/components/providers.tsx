'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth/auth-context';
import { AppShell } from './app-shell';

/** Client-side providers wrapper mounted once in the root layout. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppShell />
      {children}
    </AuthProvider>
  );
}
