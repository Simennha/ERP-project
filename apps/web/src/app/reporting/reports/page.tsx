'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PERMISSIONS, getReportTypeDefinition } from '@erp/contracts';
import { Button, DataTable, buttonVariants, type DataTableColumn } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import { deleteReport, listReports, type ReportDto } from '@/lib/reporting/api';

function ReportsContent() {
  const { getAccessToken, hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.REPORTING_REPORT_CREATE);
  const canDelete = hasPermission(PERMISSIONS.REPORTING_REPORT_DELETE);

  const [reports, setReports] = useState<ReportDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listReports(getAccessToken(), { pageSize: 100 });
      setReports(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(report: ReportDto) {
    if (!window.confirm(`Delete report "${report.name}"?`)) return;
    try {
      await deleteReport(getAccessToken(), report.id);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const columns: Array<DataTableColumn<ReportDto>> = [
    {
      key: 'name',
      header: 'Name',
      cell: (row) => (
        <Link href={`/reporting/reports/${row.id}`} className="font-medium hover:underline">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => getReportTypeDefinition(row.reportType)?.label ?? row.reportType,
    },
    {
      key: 'module',
      header: 'Module',
      cell: (row) => getReportTypeDefinition(row.reportType)?.module ?? '—',
    },
    { key: 'createdAt', header: 'Created', cell: (row) => new Date(row.createdAt).toLocaleDateString() },
    ...(canDelete
      ? [
          {
            key: 'delete',
            header: '',
            className: 'text-right',
            cell: (row: ReportDto) => (
              <Button variant="destructive" size="sm" onClick={() => void handleDelete(row)}>
                Delete
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Saved cross-module reports — running one always queries live data.
          </p>
        </div>
        {canCreate ? (
          <Link href="/reporting/reports/new" className={buttonVariants()}>
            New Report
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
        data={reports}
        getRowId={(row) => row.id}
        emptyMessage={loading ? 'Loading…' : 'No reports saved yet'}
      />
    </div>
  );
}

export default function ReportsPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.REPORTING_REPORT_READ}>
      <ReportsContent />
    </RequirePermissionPage>
  );
}
