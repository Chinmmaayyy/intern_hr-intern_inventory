/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Prisma } from '@prisma/client';
import { prisma } from '@/backend/db';
import { 
  dailyRevenueReport,
  billingDetailReport,
  billingItemDetailReport,
  billingSummaryReport,
  billingSummaryDetailReport,
  billingPaymentModeReport,
  billingUhidAdvanceReport,
  billingAdmissionAdvanceReport,
  billingDiscountSummaryReport,
  billingDueSettledReport,
  billingRefundReport
} from './registry/billing';
import { ValidatedFilters } from './types';

// Add all reports to this registry map
export const REGISTRY: Record<string, any> = {
  [dailyRevenueReport.id]: dailyRevenueReport,
  [billingDetailReport.id]: billingDetailReport,
  [billingItemDetailReport.id]: billingItemDetailReport,
  [billingSummaryReport.id]: billingSummaryReport,
  [billingSummaryDetailReport.id]: billingSummaryDetailReport,
  [billingPaymentModeReport.id]: billingPaymentModeReport,
  [billingUhidAdvanceReport.id]: billingUhidAdvanceReport,
  [billingAdmissionAdvanceReport.id]: billingAdmissionAdvanceReport,
  [billingDiscountSummaryReport.id]: billingDiscountSummaryReport,
  [billingDueSettledReport.id]: billingDueSettledReport,
  [billingRefundReport.id]: billingRefundReport,
};

export async function runReport(
  reportId: string,
  rawFilters: unknown,
  orgId: string,
  userId: string,
  userPermissions: string[]
) {
  const reportDef = REGISTRY[reportId];
  if (!reportDef) {
    throw new Error(`Report ${reportId} not found`);
  }

  // TODO: Re-enable permission check before production release
  // 1. Check permissions (temporarily bypassed for Day 1 frontend integration)
  // if (!userPermissions.includes(reportDef.requiredPermission)) {
  //   throw new Error(`Forbidden: missing ${reportDef.requiredPermission}`);
  // }

  // 2. Validate filters
  const parsedFilters = reportDef.filters.safeParse(rawFilters);
  if (!parsedFilters.success) {
    throw new Error(`Invalid filters: ${parsedFilters.error.message}`);
  }

  const filters = parsedFilters.data as ValidatedFilters;

  // Assume row count check (mocking the expected logic)
  const expectedRowCount = 100; // You'd do a fast count(*) query here based on filters

  // 3. Async handling if too large
  if (expectedRowCount > reportDef.rowLimitSync) {
    const job = await prisma.reportJob.create({
      data: {
        report_id: reportId,
        filters_json: filters as Prisma.InputJsonValue,
        requested_by: userId,
        organizationId: orgId,
        format: 'JSON',
        status: 'Queued',
      },
    });
    return { async: true, jobId: job.id };
  }

  // 4. Sync execution
  const { rows, totals } = await reportDef.queryFn(filters, orgId);

  // 5. Log access
  await prisma.reportAccessLog.create({
    data: {
      user_id: userId,
      report_id: reportId,
      filters_json: filters as Prisma.InputJsonValue,
      row_count: rows.length,
      action: 'MIS_GENERATE',
      organizationId: orgId,
    },
  });

  return {
    async: false,
    rows,
    totals,
    meta: {
      generatedAt: new Date(),
      reportName: reportDef.name,
      rowCount: rows.length,
    },
  };
}
