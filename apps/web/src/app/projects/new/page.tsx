'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { buttonVariants } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import { createProject } from '@/lib/projects/api';
import { ProjectForm } from '../project-form';

function NewProjectContent() {
  const router = useRouter();
  const { getAccessToken } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New project</h1>
        <p className="text-muted-foreground">Add a project to your company.</p>
      </div>

      <ProjectForm
        submitLabel="Create project"
        onSubmit={async (input) => {
          const created = await createProject(getAccessToken(), input);
          router.push(`/projects/${created.id}`);
        }}
      />

      <Link href="/projects" className={buttonVariants({ variant: 'ghost' })}>
        Cancel
      </Link>
    </div>
  );
}

export default function NewProjectPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.PROJECTS_PROJECT_CREATE}>
      <NewProjectContent />
    </RequirePermissionPage>
  );
}
