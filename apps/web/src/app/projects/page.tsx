'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { Button, DataTable, buttonVariants, type DataTableColumn } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import { listProjects, type Paginated, type ProjectDto } from '@/lib/projects/api';

const PAGE_SIZE = 25;

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  active: 'Active',
  onHold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_CLASSES: Record<string, string> = {
  planned: 'text-muted-foreground',
  active: 'text-emerald-600 dark:text-emerald-400',
  onHold: 'text-amber-600 dark:text-amber-400',
  completed: 'text-blue-600 dark:text-blue-400',
  cancelled: 'text-destructive',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function ProjectsContent() {
  const { getAccessToken, hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.PROJECTS_PROJECT_CREATE);

  const [result, setResult] = useState<Paginated<ProjectDto> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProjects(getAccessToken(), { page, pageSize: PAGE_SIZE });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Array<DataTableColumn<ProjectDto>> = [
    {
      key: 'name',
      header: 'Name',
      cell: (row) => (
        <Link href={`/projects/${row.id}`} className="font-medium hover:underline">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      cell: (row) => <code className="text-xs">{row.code}</code>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <span className={STATUS_CLASSES[row.status] ?? 'text-muted-foreground'}>
          {STATUS_LABELS[row.status] ?? row.status}
        </span>
      ),
    },
    {
      key: 'startDate',
      header: 'Start date',
      cell: (row) => formatDate(row.startDate),
    },
    {
      key: 'endDate',
      header: 'End date',
      cell: (row) => formatDate(row.endDate),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Projects tracked for your company.</p>
        </div>
        {canCreate ? (
          <Link href="/projects/new" className={buttonVariants()}>
            New Project
          </Link>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        data={result?.data ?? []}
        getRowId={(row) => row.id}
        emptyMessage={loading ? 'Loading…' : 'No projects found'}
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

export default function ProjectsPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.PROJECTS_PROJECT_READ}>
      <ProjectsContent />
    </RequirePermissionPage>
  );
}
