'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { Button, DataTable, Label, StatusBadge, buttonVariants, type DataTableColumn, type StatusTone } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import {
  listEmployees,
  type EmployeeDto,
  type EmploymentStatus,
  type Paginated,
} from '@/lib/hr/api';

const PAGE_SIZE = 25;

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  onLeave: 'On leave',
  terminated: 'Terminated',
};

const STATUS_TONE: Record<string, StatusTone> = {
  active: 'success',
  onLeave: 'warning',
  terminated: 'neutral',
};

function EmployeesContent() {
  const { getAccessToken, hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.HR_EMPLOYEE_CREATE);

  const [result, setResult] = useState<Paginated<EmployeeDto> | null>(null);
  const [statusFilter, setStatusFilter] = useState<EmploymentStatus | ''>('');
  const [appliedStatusFilter, setAppliedStatusFilter] = useState<EmploymentStatus | ''>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listEmployees(getAccessToken(), {
        employmentStatus: appliedStatusFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, appliedStatusFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedStatusFilter(statusFilter);
  }

  const columns: Array<DataTableColumn<EmployeeDto>> = [
    {
      key: 'name',
      header: 'Name',
      cell: (row) => (
        <Link href={`/hr/employees/${row.id}`} className="font-medium hover:underline">
          {row.firstName} {row.lastName}
        </Link>
      ),
    },
    { key: 'email', header: 'Email', cell: (row) => row.email },
    {
      key: 'jobTitle',
      header: 'Job title',
      cell: (row) => row.jobTitle ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'department',
      header: 'Department',
      cell: (row) => row.department ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'employmentStatus',
      header: 'Status',
      cell: (row) => (
        <StatusBadge
          label={STATUS_LABEL[row.employmentStatus] ?? row.employmentStatus}
          tone={STATUS_TONE[row.employmentStatus] ?? 'neutral'}
        />
      ),
    },
    {
      key: 'hireDate',
      header: 'Hire date',
      cell: (row) => new Date(row.hireDate).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">People employed by your company.</p>
        </div>
        {canCreate ? (
          <Link href="/hr/employees/new" className={buttonVariants()}>
            New Employee
          </Link>
        ) : null}
      </div>

      <form onSubmit={applyFilter} className="flex items-end gap-2">
        <div className="space-y-2">
          <Label htmlFor="employmentStatus">Filter by status</Label>
          <select
            id="employmentStatus"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EmploymentStatus | '')}
            className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="onLeave">On leave</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
        {appliedStatusFilter ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setStatusFilter('');
              setAppliedStatusFilter('');
              setPage(1);
            }}
          >
            Clear
          </Button>
        ) : null}
      </form>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        data={result?.data ?? []}
        getRowId={(row) => row.id}
        emptyMessage={loading ? 'Loading…' : 'No employees found'}
      />

      {result && result.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {result.page} of {result.totalPages} · {result.total} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= result.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function EmployeesPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.HR_EMPLOYEE_READ}>
      <EmployeesContent />
    </RequirePermissionPage>
  );
}
