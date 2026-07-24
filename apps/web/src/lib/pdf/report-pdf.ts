import type { ReportDto, ReportResult } from '@/lib/reporting/api';
import { addBrandedTable, addChartImage, createBrandedDocument, savePdf, slugForFilename } from './pdf-utils';

export interface ReportChartSnapshot {
  dataUrl: string;
  aspectRatio: number;
}

/** Renders a report's data (+ optional chart snapshot) to a PDF and downloads it. */
export function exportReportPdf(report: ReportDto, result: ReportResult, chart?: ReportChartSnapshot): void {
  const subtitleParts = [report.reportType];
  if (report.filters.dateFrom || report.filters.dateTo) {
    subtitleParts.push(`${report.filters.dateFrom ?? '…'} to ${report.filters.dateTo ?? '…'}`);
  }
  const doc = createBrandedDocument(report.name, subtitleParts.join(' · '));

  let y = 100;
  if (chart) {
    y = addChartImage(doc, y, chart.dataUrl, chart.aspectRatio);
  }

  addBrandedTable(
    doc,
    y,
    result.columns,
    result.rows.map((row) => result.columns.map((col) => String(row[col] ?? ''))),
  );

  savePdf(doc, `report-${slugForFilename(report.name)}`);
}
