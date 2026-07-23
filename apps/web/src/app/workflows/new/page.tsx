'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { buttonVariants } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { createWorkflow } from '@/lib/workflow/api';
import { WorkflowForm } from '../workflow-form';

export default function NewWorkflowPage() {
  const router = useRouter();
  const { getAccessToken } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New workflow</h1>
        <p className="text-muted-foreground">Define a trigger, optional conditions, and the actions to run.</p>
      </div>

      <WorkflowForm
        submitLabel="Create workflow"
        onSubmit={async (input) => {
          const created = await createWorkflow(getAccessToken(), input);
          router.push(`/workflows/${created.id}`);
        }}
      />

      <Link href="/workflows" className={buttonVariants({ variant: 'ghost' })}>
        Cancel
      </Link>
    </div>
  );
}
