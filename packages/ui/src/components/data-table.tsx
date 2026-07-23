import * as React from 'react';
import { cn } from '../lib/cn';

export interface DataTableColumn<T> {
  /** Stable identifier for the column (used as React key). */
  key: string;
  /** Header cell content. */
  header: React.ReactNode;
  /** Renders the body cell for a given row. */
  cell: (row: T) => React.ReactNode;
  /** Optional extra classes applied to both header and body cells. */
  className?: string;
}

export interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  data: T[];
  /** Derive a stable row key; falls back to the row index. */
  getRowId?: (row: T, index: number) => string;
  /** Optional extra classes per body row, e.g. to highlight rows by state. */
  rowClassName?: (row: T, index: number) => string | undefined;
  emptyMessage?: React.ReactNode;
  className?: string;
  /** Accessible name for the table, e.g. "Products" — read by screen readers before the column headers. */
  ariaLabel?: string;
}

/**
 * Presentational, generic data table (shadcn/ui table styling, tuned toward
 * a denser SAP Fiori-style list: a tinted header bar with small, uppercase,
 * letter-spaced column labels and tighter row padding than the shadcn
 * default). Sorting/paging/selection are intentionally out of scope for this
 * phase; later phases can layer state on top or swap in @tanstack/react-table.
 */
export function DataTable<T>({
  columns,
  data,
  getRowId,
  rowClassName,
  emptyMessage = 'No data',
  className,
  ariaLabel,
}: DataTableProps<T>) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-md border border-border', className)}>
      <table className="w-full caption-bottom text-sm" aria-label={ariaLabel}>
        <thead>
          <tr className="border-b border-border bg-muted/60">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'h-9 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-4 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={getRowId ? getRowId(row, index) : String(index)}
                className={cn(
                  'border-b border-border transition-colors hover:bg-muted/50',
                  rowClassName?.(row, index),
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-3 py-2 align-middle', col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
