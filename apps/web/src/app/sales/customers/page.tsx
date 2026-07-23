'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  DataTable,
  type DataTableColumn,
} from '@erp/ui';
import { PERMISSIONS } from '@erp/contracts';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/sales/page-guard';
import { listCustomers, type Customer } from '@/lib/sales/api-client';

const columns: Array<DataTableColumn<Customer>> = [
  { key: 'name', header: 'Name', cell: (c) => <span className="font-medium">{c.name}</span> },
  { key: 'email', header: 'Email', cell: (c) => c.email ?? <span className="text-muted-foreground">—</span> },
  { key: 'phone', header: 'Phone', cell: (c) => c.phone ?? <span className="text-muted-foreground">—</span> },
  {
    key: 'isActive',
    header: 'Status',
    cell: (c) => (
      <span className={c.isActive ? 'text-foreground' : 'text-muted-foreground'}>
        {c.isActive ? 'Active' : 'Inactive'}
      </span>
    ),
  },
];

function CustomersList() {
  const { getAccessToken } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCustomers(await listCustomers(getAccessToken()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">People and organizations you sell to.</p>
        </div>
        <Link href="/sales/customers/new">
          <Button>New customer</Button>
        </Link>
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          data={customers}
          getRowId={(c) => c.id}
          emptyMessage="No customers yet. Create your first one."
        />
      )}
    </div>
  );
}

export default function CustomersPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.SALES_CUSTOMER_READ}>
      <CustomersList />
    </RequirePermissionPage>
  );
}
