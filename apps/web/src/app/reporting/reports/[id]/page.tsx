'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS, getReportTypeDefinition } from '@erp/contracts';
import { Button, Card, CardContent, CardHeader, CardTitle, DataTable, buttonVariants, type DataTableColumn } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import { deleteReport, getReport, runReport, type ReportDto, type ReportResult } from '@/lib/reporting/api';
import { downloadCsv, toCsv } from '@/lib/reporting/csv';
import { detectChartData } from '@/lib/reporting/chart-data';
import { ReportChart } from './report-chart';
import { exportReportPdf } from '@/lib/pdf/report-pdf';

function ReportDetailContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { getAccessToken, hasPermission } = useAuth();
  const canDelete = hasPermission(PERMISSIONS.REPORTING_REPORT_DELETE);

  const [report, setReport] = useState<ReportDto | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);

  const chartData = useMemo(() => (result ? detectChartData(result) : null), [result]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const [reportData, resultData] = await Promise.all([getReport(token, id), runReport(token, id)]);
      setReport(reportData);
      setResult(resultData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRerun() {
    setRunning(true);
    setError(null);
    try {
      setResult(await runReport(getAccessToken(), id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }

  async function handleDelete() {
    if (!report || !window.confirm(`Delete report "${report.name}"?`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteReport(getAccessToken(), id);
      router.push('/reporting/reports');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  function handleExport() {
    if (!result || !report) return;
    downloadCsv(`${report.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`, toCsv(result));
  }

  function handleExportPdf() {
    if (!result || !report) return;
    const canvas = chartCanvasRef.current;
    const chart =
      chartData && canvas && canvas.width > 0 && canvas.height > 0
        ? { dataUrl: canvas.toDataURL('image/png'), aspectRatio: canvas.width / canvas.height }
        : undefined;
    exportReportPdf(report, result, chart);
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (error && !report) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
        <Link href="/reporting/reports" className={buttonVariants({ variant: 'outline' })}>
          Back to reports
        </Link>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const definition = getReportTypeDefinition(report.reportType);

  const columns: Array<DataTableColumn<Record<string, string | number>>> =
    result?.columns.map((col) => ({
      key: col,
      header: col,
      cell: (row) => row[col],
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{report.name}</h1>
          <p className="text-muted-foreground">
            {definition?.label ?? report.reportType}
            {report.filters.dateFrom || report.filters.dateTo
              ? ` · ${report.filters.dateFrom ?? '…'} to ${report.filters.dateTo ?? '…'}`
              : null}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void handleRerun()} disabled={running}>
            {running ? 'Running…' : 'Re-run'}
          </Button>
          <Button variant="secondary" onClick={handleExport} disabled={!result || result.rows.length === 0}>
            Export CSV
          </Button>
          <Button variant="secondary" onClick={handleExportPdf} disabled={!result || result.rows.length === 0}>
            Export PDF
          </Button>
          {canDelete ? (
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

      {chartData ? (
        <Card>
          <CardHeader>
            <CardTitle>Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <ReportChart data={chartData} canvasRef={chartCanvasRef} />
          </CardContent>
        </Card>
      ) : null}

      <DataTable
        columns={columns}
        data={result?.rows ?? []}
        getRowId={(_row, index) => String(index)}
        emptyMessage="No rows returned."
      />
    </div>
  );
}

export default function ReportDetailPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.REPORTING_REPORT_READ}>
      <ReportDetailContent />
    </RequirePermissionPage>
  );
}
