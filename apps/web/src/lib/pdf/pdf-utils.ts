import { jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';

/**
 * Shared client-side PDF building blocks (jsPDF + jspdf-autotable), used by
 * every "Export PDF" button in the app (Sales Order, Purchase Order, Report).
 * Everything runs in the browser — no server round-trip, no headless-browser
 * dependency — mirroring the existing CSV export pattern
 * (lib/reporting/csv.ts's `downloadCsv`).
 *
 * Brand color matches the app's SAP-blue accent (globals.css's `--primary`,
 * hsl(212 100% 47%) ~= rgb(0, 112, 242)) so exported documents read as the
 * same product as the UI.
 */
export const PDF_BRAND_RGB: [number, number, number] = [0, 112, 242];
const MUTED_TEXT_RGB: [number, number, number] = [100, 116, 139];
const PAGE_MARGIN = 40;

/** Create an A4 portrait document with a branded header already drawn. */
export function createBrandedDocument(title: string, subtitle?: string): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...PDF_BRAND_RGB);
  doc.rect(0, 0, pageWidth, 6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text(title, PAGE_MARGIN, 48);

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...MUTED_TEXT_RGB);
    doc.text(subtitle, PAGE_MARGIN, 66);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_TEXT_RGB);
  doc.text(`ERP System · generated ${new Date().toLocaleString()}`, PAGE_MARGIN, pageWidth > 0 ? 82 : 82);

  return doc;
}

/** A simple two-column "label: value" block (order/PO metadata, report filters, ...). */
export function addDetailBlock(doc: jsPDF, startY: number, pairs: Array<[string, string]>): number {
  let y = startY;
  doc.setFontSize(10);
  for (const [label, value] of pairs) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text(`${label}:`, PAGE_MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 20, 20);
    doc.text(value, PAGE_MARGIN + 90, y);
    y += 16;
  }
  return y + 8;
}

/** Branded data table (line items, report rows, ...). Returns the Y position just below it. */
export function addBrandedTable(
  doc: jsPDF,
  startY: number,
  head: string[],
  body: RowInput[],
  columnStyles?: Record<number, { halign: 'left' | 'right' | 'center' }>,
): number {
  autoTable(doc, {
    startY,
    head: [head],
    body,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: PDF_BRAND_RGB, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles,
  });
  const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return (lastTable?.finalY ?? startY + 20) + 20;
}

/** Right-aligned bold "Total: X" line, e.g. below a line-items table. */
export function addTotalLine(doc: jsPDF, y: number, label: string, value: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(`${label}: ${value}`, pageWidth - PAGE_MARGIN, y, { align: 'right' });
  return y + 20;
}

/** Embed a chart image (a canvas snapshot, e.g. `canvas.toDataURL('image/png')`). */
export function addChartImage(doc: jsPDF, startY: number, dataUrl: string, aspectRatio: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const width = pageWidth - PAGE_MARGIN * 2;
  const height = width / aspectRatio;
  doc.addImage(dataUrl, 'PNG', PAGE_MARGIN, startY, width, height);
  return startY + height + 20;
}

export function savePdf(doc: jsPDF, filename: string): void {
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/** Filesystem-safe filename fragment from a free-text name (mirrors reports' CSV export). */
export function slugForFilename(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}
