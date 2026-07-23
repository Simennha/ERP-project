'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { buttonVariants } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { createWarehouse } from '@/lib/inventory/api';
import { WarehouseForm } from '../warehouse-form';

export default function NewWarehousePage() {
  const router = useRouter();
  const { getAccessToken, hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.INVENTORY_WAREHOUSE_MANAGE);

  useEffect(() => {
    if (!canManage) {
      router.replace('/inventory/warehouses');
    }
  }, [canManage, router]);

  if (!canManage) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New warehouse</h1>
        <p className="text-muted-foreground">Add a stock location.</p>
      </div>

      <WarehouseForm
        submitLabel="Create warehouse"
        onSubmit={async (input) => {
          const created = await createWarehouse(getAccessToken(), input);
          router.push(`/inventory/warehouses/${created.id}`);
        }}
      />

      <Link href="/inventory/warehouses" className={buttonVariants({ variant: 'ghost' })}>
        Cancel
      </Link>
    </div>
  );
}
