'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS, REPORT_TYPE_DEFINITIONS, getReportTypeDefinition } from '@erp/contracts';
import { Button, Input, Label, buttonVariants } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import { createReport } from '@/lib/reporting/api';

function NewReportContent() {
  const router = useRouter();
  const { getAccessToken } = useAuth();

  const [name, setName] = useState('');
  const [reportType, setReportType] = useState(REPORT_TYPE_DEFINITIONS[0]?.type ?? '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const definition = getReportTypeDefinition(reportType);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createReport(getAccessToken(), {
        name: name.trim(),
        reportType,
        filters: {
          ...(definition?.filters.includes('dateFrom') && dateFrom ? { dateFrom } : {}),
          ...(definition?.filters.includes('dateTo') && dateTo ? { dateTo } : {}),
        },
      });
      router.push(`/reporting/reports/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New report</h1>
        <p className="text-muted-foreground">Pick a report type, name it, and save.</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reportType">Report type</Label>
          <select
            id="reportType"
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {REPORT_TYPE_DEFINITIONS.map((def) => (
              <option key={def.type} value={def.type}>
                {def.label} ({def.module})
              </option>
            ))}
          </select>
          {definition ? <p className="text-sm text-muted-foreground">{definition.description}</p> : null}
        </div>

        {definition?.filters.includes('dateFrom') || definition?.filters.includes('dateTo') ? (
          <div className="grid grid-cols-2 gap-4">
            {definition.filters.includes('dateFrom') && (
              <div className="space-y-2">
                <Label htmlFor="dateFrom">From (optional)</Label>
                <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
            )}
            {definition.filters.includes('dateTo') && (
              <div className="space-y-2">
                <Label htmlFor="dateTo">To (optional)</Label>
                <Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            )}
          </div>
        ) : null}

        {error ? (
          <p className="text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Create report'}
          </Button>
          <Link href="/reporting/reports" className={buttonVariants({ variant: 'ghost' })}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NewReportPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.REPORTING_REPORT_CREATE}>
      <NewReportContent />
    </RequirePermissionPage>
  );
}
