'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** /sales -> /sales/orders (the module's default landing page). */
export default function SalesIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/sales/orders');
  }, [router]);
  return <p className="text-muted-foreground">Redirecting…</p>;
}
