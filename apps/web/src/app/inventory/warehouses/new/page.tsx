'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { buttonVariants } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import { createWarehouse } from '@/lib/inventory/api';
import { WarehouseForm } from '../warehouse-form';

function NewWarehouseContent() {
  const router = useRouter();
  const { getAccessToken } = useAuth();

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

export default function NewWarehousePage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.INVENTORY_WAREHOUSE_MANAGE}>
      <NewWarehouseContent />
    </RequirePermissionPage>
  );
}
