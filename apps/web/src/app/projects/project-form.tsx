'use client';

import { useState, type FormEvent } from 'react';
import { Button, Input, Label } from '@erp/ui';
import type { ProjectInput, ProjectStatus } from '@/lib/projects/api';

export interface ProjectFormValues {
  name: string;
  code: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  description: string;
}

const EMPTY: ProjectFormValues = {
  name: '',
  code: '',
  status: 'planned',
  startDate: '',
  endDate: '',
  description: '',
};

const STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'onHold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Create/edit form for a Project. Used by both the "New project" page and the
 * project detail page. The parent supplies `onSubmit`, which performs the
 * actual API call and navigation; this component owns only local field state
 * and client-side validation.
 */
export function ProjectForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<ProjectFormValues>;
  submitLabel: string;
  onSubmit: (input: ProjectInput) => Promise<void>;
}) {
  const [values, setValues] = useState<ProjectFormValues>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    let input: ProjectInput;
    try {
      const name = values.name.trim();
      const code = values.code.trim();
      if (!name) throw new Error('Name is required');
      if (!code) throw new Error('Code is required');
      input = {
        name,
        code,
        status: values.status,
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
        description: values.description.trim() || undefined,
      };
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
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          className={SELECT_CLASS}
          value={values.status}
          onChange={(e) => set('status', e.target.value as ProjectStatus)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start date</Label>
          <Input
            id="startDate"
            type="date"
            value={values.startDate}
            onChange={(e) => set('startDate', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End date</Label>
          <Input
            id="endDate"
            type="date"
            value={values.endDate}
            onChange={(e) => set('endDate', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
        />
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
