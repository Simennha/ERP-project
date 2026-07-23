'use client';

import { useState, type FormEvent } from 'react';
import { Button, Input, Label } from '@erp/ui';
import type { WarehouseInput } from '@/lib/inventory/api';

export interface WarehouseFormValues {
  name: string;
  code: string;
  address: string;
  isActive: boolean;
}

const EMPTY: WarehouseFormValues = {
  name: '',
  code: '',
  address: '',
  isActive: true,
};

/**
 * Create/edit form for a Warehouse. Used by the "New warehouse" page and the
 * warehouse detail page. Owns local field state + validation only; the parent's
 * `onSubmit` performs the API call and navigation.
 */
export function WarehouseForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<WarehouseFormValues>;
  submitLabel: string;
  onSubmit: (input: WarehouseInput) => Promise<void>;
}) {
  const [values, setValues] = useState<WarehouseFormValues>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof WarehouseFormValues>(key: K, value: WarehouseFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const input: WarehouseInput = {
      name: values.name.trim(),
      code: values.code.trim(),
      address: values.address.trim() || undefined,
      isActive: values.isActive,
    };
    if (!input.name) {
      setError('Name is required');
      return;
    }
    if (!input.code) {
      setError('Code is required');
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
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            value={values.code}
            onChange={(e) => set('code', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          value={values.address}
          onChange={(e) => set('address', e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="isActive"
          type="checkbox"
          className="h-4 w-4"
          checked={values.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
        />
        <Label htmlFor="isActive">Active</Label>
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
