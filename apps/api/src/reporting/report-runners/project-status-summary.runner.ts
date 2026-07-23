import type { ReportResult } from '@erp/contracts';
import type { ReportRunner } from './report-runner.types';

export const runProjectStatusSummary: ReportRunner = async (prisma, companyId): Promise<ReportResult> => {
  const grouped = await prisma.project.groupBy({
    by: ['status'],
    where: { companyId },
    _count: { _all: true },
  });

  const rows = grouped
    .map((g) => ({ Status: g.status, Count: g._count._all }))
    .sort((a, b) => b.Count - a.Count);

  return { columns: ['Status', 'Count'], rows };
};
