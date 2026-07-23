'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { Button, Card, CardContent, CardHeader, CardTitle, StatusBadge, buttonVariants, type StatusTone } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import { deleteEmployee, getEmployee, updateEmployee, type EmployeeDto } from '@/lib/hr/api';
import { EmployeeForm, type EmployeeFormValues } from '../employee-form';

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  onLeave: 'On leave',
  terminated: 'Terminated',
};

const STATUS_TONE: Record<string, StatusTone> = {
  active: 'success',
  onLeave: 'warning',
  terminated: 'neutral',
};

function toFormValues(employee: EmployeeDto): EmployeeFormValues {
  return {
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    jobTitle: employee.jobTitle ?? '',
    department: employee.department ?? '',
    employmentStatus: (employee.employmentStatus as EmployeeFormValues['employmentStatus']) ?? 'active',
    hireDate: employee.hireDate.slice(0, 10),
  };
}

function EmployeeDetailContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { getAccessToken, hasPermission } = useAuth();
  const canUpdate = hasPermission(PERMISSIONS.HR_EMPLOYEE_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.HR_EMPLOYEE_DELETE);

  const [employee, setEmployee] = useState<EmployeeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEmployee(await getEmployee(getAccessToken(), id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employee');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    if (!window.confirm('Delete this employee?')) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteEmployee(getAccessToken(), id);
      router.push('/hr/employees');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (error && !employee) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
        <Link href="/hr/employees" className={buttonVariants({ variant: 'outline' })}>
          Back to employees
        </Link>
      </div>
    );
  }

  if (!employee) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {employee.firstName} {employee.lastName}
          </h1>
          <p className="text-muted-foreground">{employee.email}</p>
        </div>
        <div className="flex gap-2">
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
      {notice ? <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{notice}</p> : null}

      {canUpdate ? (
        <EmployeeForm
          key={employee.updatedAt}
          initial={toFormValues(employee)}
          submitLabel="Save changes"
          onSubmit={async (input) => {
            const updated = await updateEmployee(getAccessToken(), id, input);
            setEmployee(updated);
            setNotice('Changes saved.');
          }}
        />
      ) : (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Detail label="Job title" value={employee.jobTitle ?? '—'} />
            <Detail label="Department" value={employee.department ?? '—'} />
            <p>
              <span className="text-muted-foreground">Status: </span>
              <StatusBadge
                label={STATUS_LABEL[employee.employmentStatus] ?? employee.employmentStatus}
                tone={STATUS_TONE[employee.employmentStatus] ?? 'neutral'}
              />
            </p>
            <Detail label="Hire date" value={new Date(employee.hireDate).toLocaleDateString()} />
          </CardContent>
        </Card>
      )}
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

export default function EmployeeDetailPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.HR_EMPLOYEE_READ}>
      <EmployeeDetailContent />
    </RequirePermissionPage>
  );
}
