'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { Button, Card, CardContent, CardHeader, CardTitle, Label, buttonVariants } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import {
  deleteInvoice,
  getInvoice,
  updateInvoice,
  type InvoiceDto,
} from '@/lib/finance/api';

const STATUS_OPTIONS = ['draft', 'sent', 'paid'] as const;

function InvoiceDetailContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { getAccessToken, hasPermission } = useAuth();
  const canUpdate = hasPermission(PERMISSIONS.FINANCE_INVOICE_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.FINANCE_INVOICE_DELETE);

  const [invoice, setInvoice] = useState<InvoiceDto | null>(null);
  const [status, setStatus] = useState<string>('draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInvoice(getAccessToken(), id);
      setInvoice(data);
      setStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateInvoice(getAccessToken(), id, {
        status: status as 'draft' | 'sent' | 'paid',
      });
      setInvoice(updated);
      setStatus(updated.status);
      setNotice('Status updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this invoice?')) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteInvoice(getAccessToken(), id);
      router.push('/finance/invoices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (error && !invoice) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
        <Link href="/finance/invoices" className={buttonVariants({ variant: 'outline' })}>
          Back to invoices
        </Link>
      </div>
    );
  }

  if (!invoice) {
    return null;
  }

  const canDeleteNow = canDelete && invoice.status === 'draft';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{invoice.invoiceNumber}</h1>
          <p className="text-muted-foreground">
            Sales order <code>{invoice.salesOrderNumber}</code>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/finance/invoices" className={buttonVariants({ variant: 'outline' })}>
            Back to invoices
          </Link>
          {canDelete ? (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || !canDeleteNow}
              title={
                canDeleteNow ? undefined : 'Only draft invoices can be deleted'
              }
            >
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
      {notice ? (
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{notice}</p>
      ) : null}

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <Detail label="Invoice number" value={invoice.invoiceNumber} />
          <Detail label="Sales order" value={invoice.salesOrderNumber} />
          <Detail label="Customer" value={invoice.customerName} />
          <Detail label="Total amount" value={invoice.totalAmount} />
          <Detail label="Status" value={invoice.status} />
          <Detail label="Created" value={new Date(invoice.createdAt).toLocaleString()} />
          <Detail label="Updated" value={new Date(invoice.updatedAt).toLocaleString()} />
        </CardContent>
      </Card>

      {canUpdate ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Update status</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option} className="capitalize">
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleSave} disabled={saving || status === invoice.status}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </p>
  );
}

export default function InvoiceDetailPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.FINANCE_INVOICE_READ}>
      <InvoiceDetailContent />
    </RequirePermissionPage>
  );
}
