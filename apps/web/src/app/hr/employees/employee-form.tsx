'use client';

import { useState, type FormEvent } from 'react';
import { Button, Input, Label } from '@erp/ui';
import type { EmployeeInput, EmploymentStatus } from '@/lib/hr/api';

export interface EmployeeFormValues {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  employmentStatus: EmploymentStatus;
  /** `YYYY-MM-DD`, matching an `<input type="date">`'s value format. */
  hireDate: string;
}

const EMPTY: EmployeeFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  jobTitle: '',
  department: '',
  employmentStatus: 'active',
  hireDate: '',
};

/**
 * Create/edit form for an Employee. Used by both the "New employee" page and
 * the employee detail page. The parent supplies `onSubmit`, which performs
 * the actual API call and navigation; this component owns only local field
 * state and client-side validation. Mirrors product-form.tsx's shape.
 */
export function EmployeeForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<EmployeeFormValues>;
  submitLabel: string;
  onSubmit: (input: EmployeeInput) => Promise<void>;
}) {
  const [values, setValues] = useState<EmployeeFormValues>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    let input: EmployeeInput;
    try {
      input = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        jobTitle: values.jobTitle.trim() || undefined,
        department: values.department.trim() || undefined,
        employmentStatus: values.employmentStatus,
        hireDate: values.hireDate.trim() || undefined,
      };
      if (!input.firstName) throw new Error('First name is required');
      if (!input.lastName) throw new Error('Last name is required');
      if (!input.email) throw new Error('Email is required');
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
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={values.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={values.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={values.email}
          onChange={(e) => set('email', e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="jobTitle">Job title</Label>
          <Input
            id="jobTitle"
            value={values.jobTitle}
            onChange={(e) => set('jobTitle', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            value={values.department}
            onChange={(e) => set('department', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="employmentStatus">Employment status</Label>
          <select
            id="employmentStatus"
            value={values.employmentStatus}
            onChange={(e) => set('employmentStatus', e.target.value as EmploymentStatus)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="active">Active</option>
            <option value="onLeave">On leave</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="hireDate">Hire date</Label>
          <Input
            id="hireDate"
            type="date"
            value={values.hireDate}
            onChange={(e) => set('hireDate', e.target.value)}
          />
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
