'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { Button, Card, CardContent, CardHeader, CardTitle, StatusBadge, buttonVariants, type StatusTone } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import { deleteProject, getProject, updateProject, type ProjectDto } from '@/lib/projects/api';
import { ProjectForm, type ProjectFormValues } from '../project-form';

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  active: 'Active',
  onHold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_TONE: Record<string, StatusTone> = {
  planned: 'neutral',
  active: 'success',
  onHold: 'warning',
  completed: 'info',
  cancelled: 'danger',
};

/** ISO datetime string -> `YYYY-MM-DD` for an `<input type="date">`, or ''. */
function toDateInputValue(value: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function toFormValues(project: ProjectDto): ProjectFormValues {
  return {
    name: project.name,
    code: project.code,
    status: project.status as ProjectFormValues['status'],
    startDate: toDateInputValue(project.startDate),
    endDate: toDateInputValue(project.endDate),
    description: project.description ?? '',
  };
}

function ProjectDetailContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { getAccessToken, hasPermission } = useAuth();
  const canUpdate = hasPermission(PERMISSIONS.PROJECTS_PROJECT_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.PROJECTS_PROJECT_DELETE);

  const [project, setProject] = useState<ProjectDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProject(await getProject(getAccessToken(), id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    if (!window.confirm('Delete this project?')) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteProject(getAccessToken(), id);
      router.push('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (error && !project) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
        <Link href="/projects" className={buttonVariants({ variant: 'outline' })}>
          Back to projects
        </Link>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground">
            Code <code>{project.code}</code>
          </p>
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
        <ProjectForm
          key={project.updatedAt}
          initial={toFormValues(project)}
          submitLabel="Save changes"
          onSubmit={async (input) => {
            const updated = await updateProject(getAccessToken(), id, input);
            setProject(updated);
            setNotice('Changes saved.');
          }}
        />
      ) : (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Status: </span>
              <StatusBadge
                label={STATUS_LABELS[project.status] ?? project.status}
                tone={STATUS_TONE[project.status] ?? 'neutral'}
              />
            </p>
            <Detail
              label="Start date"
              value={project.startDate ? new Date(project.startDate).toLocaleDateString() : '—'}
            />
            <Detail
              label="End date"
              value={project.endDate ? new Date(project.endDate).toLocaleDateString() : '—'}
            />
            <Detail label="Description" value={project.description ?? '—'} />
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

export default function ProjectDetailPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.PROJECTS_PROJECT_READ}>
      <ProjectDetailContent />
    </RequirePermissionPage>
  );
}
