'use client';

import { useState, type FormEvent } from 'react';
import { Button, Input, Label } from '@erp/ui';
import type { ProductInput } from '@/lib/inventory/api';

export interface ProductFormValues {
  sku: string;
  name: string;
  description: string;
  uom: string;
  costPrice: string;
  salePrice: string;
  category: string;
  isActive: boolean;
}

const EMPTY: ProductFormValues = {
  sku: '',
  name: '',
  description: '',
  uom: 'each',
  costPrice: '0.00',
  salePrice: '0.00',
  category: '',
  isActive: true,
};

function parsePrice(label: string, raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a number of zero or greater`);
  }
  return value;
}

/**
 * Create/edit form for a Product. Used by both the "New product" page and the
 * product detail page. The parent supplies `onSubmit`, which performs the
 * actual API call and navigation; this component owns only local field state
 * and client-side validation.
 */
export function ProductForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<ProductFormValues>;
  submitLabel: string;
  onSubmit: (input: ProductInput) => Promise<void>;
}) {
  const [values, setValues] = useState<ProductFormValues>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    let input: ProductInput;
    try {
      input = {
        sku: values.sku.trim(),
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        uom: values.uom.trim() || undefined,
        costPrice: parsePrice('Cost price', values.costPrice),
        salePrice: parsePrice('Sale price', values.salePrice),
        category: values.category.trim() || undefined,
        isActive: values.isActive,
      };
      if (!input.sku) throw new Error('SKU is required');
      if (!input.name) throw new Error('Name is required');
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
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            value={values.sku}
            onChange={(e) => set('sku', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="uom">Unit of measure</Label>
          <Input id="uom" value={values.uom} onChange={(e) => set('uom', e.target.value)} />
        </div>
      </div>

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
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="costPrice">Cost price</Label>
          <Input
            id="costPrice"
            type="number"
            min="0"
            step="0.01"
            value={values.costPrice}
            onChange={(e) => set('costPrice', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salePrice">Sale price</Label>
          <Input
            id="salePrice"
            type="number"
            min="0"
            step="0.01"
            value={values.salePrice}
            onChange={(e) => set('salePrice', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={values.category}
            onChange={(e) => set('category', e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2 pb-2">
          <input
            id="isActive"
            type="checkbox"
            className="h-4 w-4"
            checked={values.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
          />
          <Label htmlFor="isActive">Active</Label>
        </div>
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
