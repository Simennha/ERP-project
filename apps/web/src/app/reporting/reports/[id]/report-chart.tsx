'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { Chart, registerables } from 'chart.js';
import type { ReportChartData } from '@/lib/reporting/chart-data';

Chart.register(...registerables);

// Brand blue first (matches the app's SAP-blue accent), then amber/emerald —
// the same status-tone family used elsewhere (StatusBadge) — for a second/
// third series on multi-numeric-column reports (e.g. Sales by Customer's
// Orders + Total Revenue).
const SERIES_COLORS = ['#0070F2', '#F59E0B', '#10B981'];

/**
 * Auto-generated bar chart for a report's numeric columns (see
 * lib/reporting/chart-data.ts's `detectChartData` — this component doesn't
 * know anything about specific report types, only the generic shape). The
 * canvas ref is exposed so the parent can snapshot it (`canvas.toDataURL()`)
 * for the "Export PDF" button without re-rendering the chart server-side.
 */
export function ReportChart({
  data,
  canvasRef,
}: {
  data: ReportChartData;
  canvasRef: RefObject<HTMLCanvasElement>;
}) {
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: data.series.map((series, index) => ({
          label: series.column,
          data: series.values,
          backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length],
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: data.series.length > 1 } },
        scales: { y: { beginAtZero: true } },
      },
    });
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [data, canvasRef]);

  return (
    <div className="h-72 w-full">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Bar chart of ${data.numericColumns.join(', ')} by ${data.labelColumn}`}
      />
    </div>
  );
}
