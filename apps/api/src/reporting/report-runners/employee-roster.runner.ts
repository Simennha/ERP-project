import type { ReportResult } from '@erp/contracts';
import type { ReportRunner } from './report-runner.types';

export const runEmployeeRoster: ReportRunner = async (prisma, companyId): Promise<ReportResult> => {
  const employees = await prisma.employee.findMany({
    where: { companyId },
    orderBy: { lastName: 'asc' },
  });

  const rows = employees.map((e) => ({
    Name: `${e.firstName} ${e.lastName}`,
    Email: e.email,
    'Job Title': e.jobTitle ?? '—',
    Department: e.department ?? '—',
    Status: e.employmentStatus,
  }));

  return { columns: ['Name', 'Email', 'Job Title', 'Department', 'Status'], rows };
};
