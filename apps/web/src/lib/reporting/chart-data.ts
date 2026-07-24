import type { ReportResult } from './api';

export interface ReportChartData {
  labelColumn: string;
  numericColumns: string[];
  labels: string[];
  series: Array<{ column: string; values: number[] }>;
}

const MAX_CHART_ROWS = 15;

function isNumericValue(value: string | number | undefined): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string' || value.trim() === '') return false;
  return Number.isFinite(Number(value));
}

/**
 * Every report's `columns`/`rows` shape is generic (see @erp/contracts
 * ReportResult) — this detects whether a report is chartable without any
 * per-report-type knowledge: the first column is treated as the category
 * label, and any OTHER column where every row's value is numeric (including
 * numeric strings, e.g. "1234.50" money columns) becomes a bar series.
 * Returns `null` when there's no numeric column at all (e.g. Employee
 * Roster) — those reports get a table only, no chart.
 */
export function detectChartData(result: ReportResult): ReportChartData | null {
  const labelColumn = result.columns[0];
  if (!labelColumn || result.columns.length < 2 || result.rows.length === 0) return null;

  const restColumns = result.columns.slice(1);
  const numericColumns = restColumns.filter((col) => result.rows.every((row) => isNumericValue(row[col])));
  if (numericColumns.length === 0) return null;

  const rows = result.rows.slice(0, MAX_CHART_ROWS);
  const labels = rows.map((row) => String(row[labelColumn] ?? ''));
  const series = numericColumns.map((column) => ({
    column,
    values: rows.map((row) => Number(row[column] ?? 0)),
  }));

  return { labelColumn, numericColumns, labels, series };
}
