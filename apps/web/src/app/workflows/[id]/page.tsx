'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle, DataTable, buttonVariants, type DataTableColumn } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import {
  deleteWorkflow,
  getWorkflow,
  listWorkflowRuns,
  updateWorkflow,
  type WorkflowDefinitionDto,
  type WorkflowRunDto,
} from '@/lib/workflow/api';
import { WorkflowForm, type WorkflowFormValues } from '../workflow-form';

function toFormValues(workflow: WorkflowDefinitionDto): WorkflowFormValues {
  return {
    name: workflow.name,
    module: workflow.module,
    triggerEvent: workflow.triggerEvent,
    isActive: workflow.isActive,
    conditionsText: workflow.conditionsJson ? JSON.stringify(workflow.conditionsJson, null, 2) : '',
    actions: workflow.actions.map((action) => ({
      order: action.order,
      type: action.type,
      config: action.configJson,
    })),
  };
}

const RUN_STATUS_COLOR: Record<string, string> = {
  matched: 'text-emerald-600 dark:text-emerald-400',
  skipped: 'text-muted-foreground',
  error: 'text-destructive',
};

export default function WorkflowDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { getAccessToken } = useAuth();

  const [workflow, setWorkflow] = useState<WorkflowDefinitionDto | null>(null);
  const [runs, setRuns] = useState<WorkflowRunDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wf, runsPage] = await Promise.all([
        getWorkflow(getAccessToken(), id),
        listWorkflowRuns(getAccessToken(), id, { page: 1, pageSize: 20 }),
      ]);
      setWorkflow(wf);
      setRuns(runsPage.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    if (!window.confirm('Delete this workflow? This also deletes its run history.')) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteWorkflow(getAccessToken(), id);
      router.push('/workflows');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  const runColumns: Array<DataTableColumn<WorkflowRunDto>> = [
    {
      key: 'createdAt',
      header: 'When',
      cell: (row) => new Date(row.createdAt).toLocaleString(),
    },
    { key: 'triggeredByEvent', header: 'Event', cell: (row) => <code className="text-xs">{row.triggeredByEvent}</code> },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <span className={RUN_STATUS_COLOR[row.status]}>{row.status}</span>,
    },
    {
      key: 'error',
      header: 'Error',
      cell: (row) => row.error ?? <span className="text-muted-foreground">—</span>,
    },
  ];

  if (loading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (error && !workflow) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
        <Link href="/workflows" className={buttonVariants({ variant: 'outline' })}>
          Back to workflows
        </Link>
      </div>
    );
  }

  if (!workflow) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{workflow.name}</h1>
          <p className="text-muted-foreground">
            Module <code>{workflow.module}</code>
          </p>
        </div>
        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete'}
        </Button>
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{notice}</p> : null}

      <WorkflowForm
        key={workflow.updatedAt}
        initial={toFormValues(workflow)}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          const updated = await updateWorkflow(getAccessToken(), id, input);
          setWorkflow(updated);
          setNotice('Changes saved.');
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={runColumns}
            data={runs}
            getRowId={(row) => row.id}
            emptyMessage="No runs recorded yet — this workflow hasn't fired."
          />
        </CardContent>
      </Card>
    </div>
  );
}
