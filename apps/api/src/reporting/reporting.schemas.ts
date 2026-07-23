import { z } from 'zod';
import { paginationQuerySchema, REPORT_TYPES } from '@erp/contracts';

/**
 * Zod schemas for the Reporting REST API request bodies, colocated here
 * (not in `@erp/contracts`) per the established convention — these are
 * API-input shapes specific to these endpoints.
 */

const REPORT_TYPE_VALUES = Object.values(REPORT_TYPES) as [string, ...string[]];

const reportFiltersSchema = z.object({
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
});

export const createReportSchema = z.object({
  name: z.string().trim().min(1).max(200),
  reportType: z.enum(REPORT_TYPE_VALUES),
  filters: reportFiltersSchema.optional(),
});

export const updateReportSchema = createReportSchema.partial();

export const reportListQuerySchema = paginationQuerySchema;

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
