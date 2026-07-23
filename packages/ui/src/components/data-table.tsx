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
}

/**
 * Presentational, generic data table (shadcn/ui table styling).
 * Sorting/paging/selection are intentionally out of scope for this phase;
 * later phases can layer state on top or swap in @tanstack/react-table.
 */
export function DataTable<T>({
  columns,
  data,
  getRowId,
  rowClassName,
  emptyMessage = 'No data',
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-md border border-border', className)}>
      <table className="w-full caption-bottom text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'h-10 px-3 text-left align-middle font-medium text-muted-foreground',
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
                  <td key={col.key} className={cn('p-3 align-middle', col.className)}>
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
