'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { Button, buttonVariants } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import {
  deleteWarehouse,
  getWarehouse,
  updateWarehouse,
  type WarehouseDto,
} from '@/lib/inventory/api';
import { WarehouseForm, type WarehouseFormValues } from '../warehouse-form';

function toFormValues(warehouse: WarehouseDto): WarehouseFormValues {
  return {
    name: warehouse.name,
    code: warehouse.code,
    address: warehouse.address ?? '',
    isActive: warehouse.isActive,
  };
}

function WarehouseDetailContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { getAccessToken, hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.INVENTORY_WAREHOUSE_MANAGE);

  const [warehouse, setWarehouse] = useState<WarehouseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWarehouse(await getWarehouse(getAccessToken(), id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load warehouse');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    if (!window.confirm('Delete this warehouse? This also removes its stock and movement history.')) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteWarehouse(getAccessToken(), id);
      router.push('/inventory/warehouses');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (error && !warehouse) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
        <Link href="/inventory/warehouses" className={buttonVariants({ variant: 'outline' })}>
          Back to warehouses
        </Link>
      </div>
    );
  }

  if (!warehouse) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{warehouse.name}</h1>
          <p className="text-muted-foreground">
            Code <code>{warehouse.code}</code>
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/inventory/stock?warehouseId=${warehouse.id}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            View stock
          </Link>
          {canManage ? (
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{notice}</p> : null}

      <WarehouseForm
        key={warehouse.updatedAt}
        initial={toFormValues(warehouse)}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          const updated = await updateWarehouse(getAccessToken(), id, input);
          setWarehouse(updated);
          setNotice('Changes saved.');
        }}
      />
    </div>
  );
}

export default function WarehouseDetailPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.INVENTORY_WAREHOUSE_MANAGE}>
      <WarehouseDetailContent />
    </RequirePermissionPage>
  );
}
