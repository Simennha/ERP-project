'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, DataTable, buttonVariants, type DataTableColumn } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { deleteWorkflow, listWorkflows, type WorkflowDefinitionDto } from '@/lib/workflow/api';

export default function WorkflowsPage() {
  const { getAccessToken } = useAuth();
  const [workflows, setWorkflows] = useState<WorkflowDefinitionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWorkflows(await listWorkflows(getAccessToken()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(workflow: WorkflowDefinitionDto) {
    if (!window.confirm(`Delete workflow "${workflow.name}"? This also deletes its run history.`)) {
      return;
    }
    try {
      await deleteWorkflow(getAccessToken(), workflow.id);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const columns: Array<DataTableColumn<WorkflowDefinitionDto>> = [
    {
      key: 'name',
      header: 'Name',
      cell: (row) => (
        <Link href={`/workflows/${row.id}`} className="font-medium hover:underline">
          {row.name}
        </Link>
      ),
    },
    { key: 'module', header: 'Module', cell: (row) => row.module },
    {
      key: 'triggerEvent',
      header: 'Trigger',
      cell: (row) => <code className="text-xs">{row.triggerEvent}</code>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right tabular-nums',
      cell: (row) => row.actions.length,
    },
    {
      key: 'isActive',
      header: 'Status',
      cell: (row) =>
        row.isActive ? (
          <span className="text-emerald-600 dark:text-emerald-400">Active</span>
        ) : (
          <span className="text-muted-foreground">Inactive</span>
        ),
    },
    {
      key: 'delete',
      header: '',
      className: 'text-right',
      cell: (row) => (
        <Button variant="destructive" size="sm" onClick={() => void handleDelete(row)}>
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">
            Automation rules: an event fires, conditions are checked, actions run.
          </p>
        </div>
        <Link href="/workflows/new" className={buttonVariants()}>
          New Workflow
        </Link>
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        data={workflows}
        getRowId={(row) => row.id}
        emptyMessage={loading ? 'Loading…' : 'No workflows configured yet'}
      />
    </div>
  );
}
