import { PrismaClient } from '@prisma/client';
import { dailyRevenueReport } from './registry/billing';

const prisma = new PrismaClient();

// Add all reports to this registry map
const REGISTRY: Record<string, typeof dailyRevenueReport> = {
  [dailyRevenueReport.id]: dailyRevenueReport,
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

  // 1. Check permissions
  if (!userPermissions.includes(reportDef.requiredPermission)) {
    throw new Error(`Forbidden: missing ${reportDef.requiredPermission}`);
  }

  // 2. Validate filters
  const parsedFilters = reportDef.filters.safeParse(rawFilters);
  if (!parsedFilters.success) {
    throw new Error(`Invalid filters: ${parsedFilters.error.message}`);
  }

  const filters = parsedFilters.data;

  // Assume row count check (mocking the expected logic)
  const expectedRowCount = 100; // You'd do a fast count(*) query here based on filters

  // 3. Async handling if too large
  if (expectedRowCount > reportDef.rowLimitSync) {
    const job = await prisma.reportJob.create({
      data: {
        report_id: reportId,
        filters_json: filters,
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
      filters_json: filters,
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
