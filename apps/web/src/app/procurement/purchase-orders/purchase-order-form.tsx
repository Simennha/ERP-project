'use client';

import { useState, type FormEvent } from 'react';
import { Button, Input, Label } from '@erp/ui';
import type { PurchaseOrderInput } from '@/lib/procurement/api';

export interface PurchaseOrderFormValues {
  poNumber: string;
  vendorName: string;
  status: string;
  totalAmount: string;
  orderDate: string;
  expectedDate: string;
  notes: string;
}

const STATUS_OPTIONS = ['draft', 'submitted', 'received', 'cancelled'] as const;

const EMPTY: PurchaseOrderFormValues = {
  poNumber: '',
  vendorName: '',
  status: 'draft',
  totalAmount: '0.00',
  orderDate: '',
  expectedDate: '',
  notes: '',
};

function parsePrice(label: string, raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a number of zero or greater`);
  }
  return value;
}

/**
 * Create/edit form for a PurchaseOrder. Used by both the "New purchase order"
 * page and the purchase order detail page. The parent supplies `onSubmit`,
 * which performs the actual API call and navigation; this component owns only
 * local field state and client-side validation.
 */
export function PurchaseOrderForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<PurchaseOrderFormValues>;
  submitLabel: string;
  onSubmit: (input: PurchaseOrderInput) => Promise<void>;
}) {
  const [values, setValues] = useState<PurchaseOrderFormValues>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof PurchaseOrderFormValues>(key: K, value: PurchaseOrderFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    let input: PurchaseOrderInput;
    try {
      input = {
        poNumber: values.poNumber.trim(),
        vendorName: values.vendorName.trim(),
        status: values.status,
        totalAmount: parsePrice('Total amount', values.totalAmount),
        orderDate: values.orderDate || undefined,
        expectedDate: values.expectedDate || undefined,
        notes: values.notes.trim() || undefined,
      };
      if (!input.poNumber) throw new Error('PO number is required');
      if (!input.vendorName) throw new Error('Vendor name is required');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid input');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="poNumber">PO number</Label>
          <Input
            id="poNumber"
            value={values.poNumber}
            onChange={(e) => set('poNumber', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vendorName">Vendor name</Label>
          <Input
            id="vendorName"
            value={values.vendorName}
            onChange={(e) => set('vendorName', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            value={values.status}
            onChange={(e) => set('status', e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="totalAmount">Total amount</Label>
          <Input
            id="totalAmount"
            type="number"
            min="0"
            step="0.01"
            value={values.totalAmount}
            onChange={(e) => set('totalAmount', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="orderDate">Order date</Label>
          <Input
            id="orderDate"
            type="date"
            value={values.orderDate}
            onChange={(e) => set('orderDate', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expectedDate">Expected date</Label>
          <Input
            id="expectedDate"
            type="date"
            value={values.expectedDate}
            onChange={(e) => set('expectedDate', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" value={values.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
