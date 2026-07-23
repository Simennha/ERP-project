'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@erp/ui';
import { adjustStock, type StockItemDto } from '@/lib/inventory/api';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Small modal form to adjust a single stock row's on-hand quantity. Posts a
 * signed, non-zero integer delta to `POST /inventory/stock/adjust` (which maps
 * an over-decrement to a 409 the caller surfaces here). Rendered as a fixed
 * overlay — the shared UI kit has no Dialog primitive yet.
 */
export function AdjustDialog({
  row,
  token,
  onClose,
  onDone,
}: {
  row: StockItemDto;
  token: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Captured via a lazy initializer so it runs during this component's first
  // render, before its own DOM (and the delta input's autoFocus) mounts —
  // capturing it in an effect instead would run too late, since autoFocus has
  // already moved document.activeElement onto the dialog by then.
  const [triggerElement] = useState<HTMLElement | null>(() => document.activeElement as HTMLElement | null);

  // Focus trap + Escape-to-close + return focus to whatever opened the
  // dialog. This is the only custom modal in the app (the shared UI kit has
  // no Dialog primitive yet), so the logic lives here rather than a shared hook.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      triggerElement?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = Number(delta);
    if (!Number.isInteger(parsed)) {
      setError('Delta must be a whole number');
      return;
    }
    if (parsed === 0) {
      setError('Delta must be non-zero');
      return;
    }

    setSubmitting(true);
    try {
      await adjustStock(token, {
        productId: row.productId,
        warehouseId: row.warehouseId,
        delta: parsed,
        reason: reason.trim() || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adjustment failed');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adjust-dialog-title"
      onClick={onClose}
    >
      <Card ref={dialogRef} className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle id="adjust-dialog-title">Adjust stock</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            {row.productName} ({row.productSku}) @ {row.warehouseName} — on hand{' '}
            <span className="font-medium text-foreground">{row.quantityOnHand}</span>, available{' '}
            <span className="font-medium text-foreground">{row.available}</span>
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delta">Delta (+ in / − out)</Label>
              <Input
                id="delta"
                type="number"
                step="1"
                placeholder="e.g. 10 or -3"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input
                id="reason"
                placeholder="Stocktake correction, write-off, …"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            {error ? (
              <p className="text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Applying…' : 'Apply adjustment'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
