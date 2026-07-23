'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { buttonVariants } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import { createEmployee } from '@/lib/hr/api';
import { EmployeeForm } from '../employee-form';

function NewEmployeeContent() {
  const router = useRouter();
  const { getAccessToken } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New employee</h1>
        <p className="text-muted-foreground">Add an employee to your company.</p>
      </div>

      <EmployeeForm
        submitLabel="Create employee"
        onSubmit={async (input) => {
          const created = await createEmployee(getAccessToken(), input);
          router.push(`/hr/employees/${created.id}`);
        }}
      />

      <Link href="/hr/employees" className={buttonVariants({ variant: 'ghost' })}>
        Cancel
      </Link>
    </div>
  );
}

export default function NewEmployeePage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.HR_EMPLOYEE_CREATE}>
      <NewEmployeeContent />
    </RequirePermissionPage>
  );
}
