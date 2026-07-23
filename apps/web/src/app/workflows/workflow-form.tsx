'use client';

import { useState, type FormEvent } from 'react';
import { EVENTS, WORKFLOW_ACTION_TYPES } from '@erp/contracts';
import { Button, Input, Label } from '@erp/ui';
import type { WorkflowActionInput, WorkflowInput } from '@/lib/workflow/api';
import { ActionEditor } from './action-editor';

export interface WorkflowFormValues {
  name: string;
  module: string;
  triggerEvent: string;
  isActive: boolean;
  /** Raw textarea contents; parsed to JSON (or omitted if blank) on submit. */
  conditionsText: string;
  actions: WorkflowActionInput[];
}

const EMPTY: WorkflowFormValues = {
  name: '',
  module: '',
  triggerEvent: Object.values(EVENTS)[0] ?? '',
  isActive: true,
  conditionsText: '',
  actions: [],
};

/**
 * Create/edit form for a WorkflowDefinition. A form-based builder (per
 * README: "form-based, not visual-canvas") — conditions are a raw json-logic
 * JSON textarea rather than a graphical rule builder, and actions are a
 * reorderable list of typed sub-forms (see action-editor.tsx).
 */
export function WorkflowForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<WorkflowFormValues>;
  submitLabel: string;
  onSubmit: (input: WorkflowInput) => Promise<void>;
}) {
  const [values, setValues] = useState<WorkflowFormValues>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof WorkflowFormValues>(key: K, value: WorkflowFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function addAction() {
    set('actions', [
      ...values.actions,
      { type: WORKFLOW_ACTION_TYPES.NOTIFY, config: { recipient: { kind: 'triggerActor' }, title: '' } },
    ]);
  }

  function updateAction(index: number, next: WorkflowActionInput) {
    set(
      'actions',
      values.actions.map((a, i) => (i === index ? next : a)),
    );
  }

  function removeAction(index: number) {
    set(
      'actions',
      values.actions.filter((_, i) => i !== index),
    );
  }

  function moveAction(index: number, direction: -1 | 1) {
    const next = [...values.actions];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    set('actions', next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    let conditions: unknown;
    try {
      const trimmed = values.conditionsText.trim();
      conditions = trimmed ? JSON.parse(trimmed) : undefined;
    } catch {
      setError('Conditions must be valid JSON (a json-logic-js rule tree), or left empty.');
      return;
    }

    if (!values.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!values.module.trim()) {
      setError('Module is required');
      return;
    }

    const input: WorkflowInput = {
      name: values.name.trim(),
      module: values.module.trim(),
      triggerEvent: values.triggerEvent,
      conditions,
      isActive: values.isActive,
      actions: values.actions.map((action, index) => ({ ...action, order: index })),
    };

    setSubmitting(true);
    try {
      await onSubmit(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={values.name} onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="module">Module (for grouping, e.g. &quot;inventory&quot;)</Label>
          <Input id="module" value={values.module} onChange={(e) => set('module', e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="triggerEvent">Trigger event</Label>
          <select
            id="triggerEvent"
            value={values.triggerEvent}
            onChange={(e) => set('triggerEvent', e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {Object.values(EVENTS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2 pb-2">
          <input
            id="isActive"
            type="checkbox"
            className="h-4 w-4"
            checked={values.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
          />
          <Label htmlFor="isActive">Active</Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="conditions">
          Conditions (optional json-logic-js rule tree, evaluated against the event payload — leave empty to
          always run once the trigger matches)
        </Label>
        <textarea
          id="conditions"
          value={values.conditionsText}
          onChange={(e) => set('conditionsText', e.target.value)}
          rows={4}
          placeholder='e.g. {"<=": [{"var": "quantityOnHand"}, 10]}'
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Actions (run in order)</Label>
          <Button type="button" variant="secondary" size="sm" onClick={addAction}>
            Add action
          </Button>
        </div>
        {values.actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No actions yet — add at least one.</p>
        ) : (
          <div className="space-y-3">
            {values.actions.map((action, index) => (
              <ActionEditor
                key={index}
                action={action}
                onChange={(next) => updateAction(index, next)}
                onRemove={() => removeAction(index)}
                onMoveUp={() => moveAction(index, -1)}
                onMoveDown={() => moveAction(index, 1)}
                canMoveUp={index > 0}
                canMoveDown={index < values.actions.length - 1}
              />
            ))}
          </div>
        )}
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
