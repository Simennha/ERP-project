'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { buttonVariants } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { createProject } from '@/lib/projects/api';
import { ProjectForm } from '../project-form';

export default function NewProjectPage() {
  const router = useRouter();
  const { getAccessToken, hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.PROJECTS_PROJECT_CREATE);

  // Bounce out if the user lacks create permission (the API would 403 anyway).
  useEffect(() => {
    if (!canCreate) {
      router.replace('/projects');
    }
  }, [canCreate, router]);

  if (!canCreate) {
    return null;
  }

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
