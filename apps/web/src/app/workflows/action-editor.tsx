'use client';

import type { ReactNode } from 'react';
import { WORKFLOW_ACTION_TYPES, type WorkflowActionType } from '@erp/contracts';
import { Button, Input, Label } from '@erp/ui';
import type { WorkflowActionInput } from '@/lib/workflow/api';

const ACTION_TYPE_LABELS: Record<WorkflowActionType, string> = {
  [WORKFLOW_ACTION_TYPES.NOTIFY]: 'Notify',
  [WORKFLOW_ACTION_TYPES.UPDATE_FIELD]: 'Update field',
  [WORKFLOW_ACTION_TYPES.CREATE_RECORD]: 'Create record',
  [WORKFLOW_ACTION_TYPES.CALL_WEBHOOK]: 'Call webhook',
  [WORKFLOW_ACTION_TYPES.ASSIGN_TASK]: 'Assign task',
};

type RecipientKind = 'triggerActor' | 'role' | 'user';

/** Default config shape for a freshly-added action of a given type. */
function defaultConfig(type: WorkflowActionType): unknown {
  switch (type) {
    case WORKFLOW_ACTION_TYPES.NOTIFY:
      return { recipient: { kind: 'triggerActor' }, title: '' };
    case WORKFLOW_ACTION_TYPES.UPDATE_FIELD:
      return { model: '', field: '', value: '' };
    case WORKFLOW_ACTION_TYPES.CREATE_RECORD:
      return { model: '', data: {} };
    case WORKFLOW_ACTION_TYPES.CALL_WEBHOOK:
      return { url: '' };
    case WORKFLOW_ACTION_TYPES.ASSIGN_TASK:
      return { assigneeUserId: '', title: '' };
    default:
      return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Parse a textarea's JSON content; empty input -> undefined, invalid -> throws. */
function parseOptionalJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return JSON.parse(trimmed);
}

/**
 * Renders the right typed sub-form for one workflow action's `config`, based
 * on its `type`. Each of the 5 action types (see @erp/contracts workflow.ts)
 * gets real fields rather than a raw-JSON blob, except the few genuinely
 * free-form record shapes (createRecord's `data`, callWebhook's `headers`),
 * which stay JSON textareas — still form-based, just not worth hand-rolling a
 * dynamic key/value editor for in this phase.
 */
export function ActionEditor({
  action,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  action: WorkflowActionInput;
  onChange: (next: WorkflowActionInput) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const config = asRecord(action.config);

  function setConfig(patch: Record<string, unknown>) {
    onChange({ ...action, config: { ...config, ...patch } });
  }

  function setType(type: WorkflowActionType) {
    onChange({ ...action, type, config: defaultConfig(type) });
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <select
          value={action.type}
          onChange={(e) => setType(e.target.value as WorkflowActionType)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {Object.values(WORKFLOW_ACTION_TYPES).map((type) => (
            <option key={type} value={type}>
              {ACTION_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onMoveUp} disabled={!canMoveUp}>
            ↑
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onMoveDown} disabled={!canMoveDown}>
            ↓
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>

      {action.type === WORKFLOW_ACTION_TYPES.NOTIFY && (
        <NotifyFields config={config} setConfig={setConfig} />
      )}
      {action.type === WORKFLOW_ACTION_TYPES.UPDATE_FIELD && (
        <UpdateFieldFields config={config} setConfig={setConfig} />
      )}
      {action.type === WORKFLOW_ACTION_TYPES.CREATE_RECORD && (
        <CreateRecordFields config={config} setConfig={setConfig} />
      )}
      {action.type === WORKFLOW_ACTION_TYPES.CALL_WEBHOOK && (
        <CallWebhookFields config={config} setConfig={setConfig} />
      )}
      {action.type === WORKFLOW_ACTION_TYPES.ASSIGN_TASK && (
        <AssignTaskFields config={config} setConfig={setConfig} />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NotifyFields({
  config,
  setConfig,
}: {
  config: Record<string, unknown>;
  setConfig: (patch: Record<string, unknown>) => void;
}) {
  const recipient = asRecord(config.recipient);
  const kind = (asString(recipient.kind) || 'triggerActor') as RecipientKind;

  function setRecipient(next: Record<string, unknown>) {
    setConfig({ recipient: next });
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Recipient">
        <select
          value={kind}
          onChange={(e) => {
            const nextKind = e.target.value as RecipientKind;
            setRecipient(
              nextKind === 'triggerActor'
                ? { kind: nextKind }
                : nextKind === 'role'
                  ? { kind: nextKind, roleName: '' }
                  : { kind: nextKind, userId: '' },
            );
          }}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="triggerActor">Whoever triggered the event</option>
          <option value="role">Everyone with a role</option>
          <option value="user">A specific user</option>
        </select>
      </Field>
      {kind === 'role' && (
        <Field label="Role name">
          <Input
            value={asString(recipient.roleName)}
            onChange={(e) => setRecipient({ kind, roleName: e.target.value })}
          />
        </Field>
      )}
      {kind === 'user' && (
        <Field label="User ID">
          <Input
            value={asString(recipient.userId)}
            onChange={(e) => setRecipient({ kind, userId: e.target.value })}
          />
        </Field>
      )}
      <div className="col-span-2">
        <Field label="Title (supports {{fieldName}} from the event payload)">
          <Input value={asString(config.title)} onChange={(e) => setConfig({ title: e.target.value })} />
        </Field>
      </div>
      <div className="col-span-2">
        <Field label="Body (optional)">
          <Input value={asString(config.body)} onChange={(e) => setConfig({ body: e.target.value || undefined })} />
        </Field>
      </div>
      <div className="col-span-2">
        <Field label="Link (optional)">
          <Input value={asString(config.link)} onChange={(e) => setConfig({ link: e.target.value || undefined })} />
        </Field>
      </div>
    </div>
  );
}

function UpdateFieldFields({
  config,
  setConfig,
}: {
  config: Record<string, unknown>;
  setConfig: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Field label="Model (Prisma model name)">
        <Input value={asString(config.model)} onChange={(e) => setConfig({ model: e.target.value })} />
      </Field>
      <Field label="Field">
        <Input value={asString(config.field)} onChange={(e) => setConfig({ field: e.target.value })} />
      </Field>
      <Field label="Value">
        <Input
          value={typeof config.value === 'string' ? config.value : JSON.stringify(config.value ?? '')}
          onChange={(e) => setConfig({ value: e.target.value })}
        />
      </Field>
    </div>
  );
}

function CreateRecordFields({
  config,
  setConfig,
}: {
  config: Record<string, unknown>;
  setConfig: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Model (Prisma model name)">
        <Input value={asString(config.model)} onChange={(e) => setConfig({ model: e.target.value })} />
      </Field>
      <Field label="Data (JSON object, may use {{fieldName}} interpolation)">
        <textarea
          value={JSON.stringify(config.data ?? {}, null, 2)}
          onChange={(e) => {
            try {
              setConfig({ data: parseOptionalJson(e.target.value) ?? {} });
            } catch {
              // Leave the last-known-good config alone while the JSON is mid-edit/invalid.
            }
          }}
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
        />
      </Field>
    </div>
  );
}

function CallWebhookFields({
  config,
  setConfig,
}: {
  config: Record<string, unknown>;
  setConfig: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="URL">
        <Input value={asString(config.url)} onChange={(e) => setConfig({ url: e.target.value })} />
      </Field>
      <Field label="Headers (optional JSON object)">
        <textarea
          value={config.headers ? JSON.stringify(config.headers, null, 2) : ''}
          onChange={(e) => {
            try {
              setConfig({ headers: parseOptionalJson(e.target.value) });
            } catch {
              // Leave the last-known-good config alone while the JSON is mid-edit/invalid.
            }
          }}
          rows={4}
          placeholder="{}"
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
        />
      </Field>
    </div>
  );
}

function AssignTaskFields({
  config,
  setConfig,
}: {
  config: Record<string, unknown>;
  setConfig: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Field label="Assignee user ID">
        <Input
          value={asString(config.assigneeUserId)}
          onChange={(e) => setConfig({ assigneeUserId: e.target.value })}
        />
      </Field>
      <Field label="Title">
        <Input value={asString(config.title)} onChange={(e) => setConfig({ title: e.target.value })} />
      </Field>
      <Field label="Due date (optional)">
        <Input
          type="date"
          value={asString(config.dueAt).slice(0, 10)}
          onChange={(e) => setConfig({ dueAt: e.target.value || undefined })}
        />
      </Field>
    </div>
  );
}
