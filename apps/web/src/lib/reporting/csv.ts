import type { ReportResult } from './api';

function escapeCsvValue(value: unknown): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(result: ReportResult): string {
  const lines = [result.columns.map(escapeCsvValue).join(',')];
  for (const row of result.rows) {
    lines.push(result.columns.map((col) => escapeCsvValue(row[col])).join(','));
  }
  return lines.join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
