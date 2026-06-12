'use server';

import { prisma } from '@/backend/db';
import { runReport, REGISTRY } from '@/lib/mis/runner';
import { dailyRevenueReport } from '@/lib/mis/registry/billing';
import { generateExcelBuffer } from '@/lib/mis/exporter';
import { GenerateReportResponse, JobStatusResponse } from '@/lib/mis/action-types';

async function getSession() {
  const user = await prisma.user.findFirst({
    select: { id: true, organizationId: true }
  });
  if (!user) throw new Error("No users found in database for mock session");
  return {
    orgId: user.organizationId,
    userId: user.id,
    permissions: ['mis_reports.billing.view'],
  };
}

export async function listCatalogue() {
  const session = await getSession();
  
  // Hardcoded for now, you would iterate over REGISTRY
  const allReports = [dailyRevenueReport];
  
  const accessibleReports = allReports.filter(r => 
    session.permissions.includes(r.requiredPermission)
  );

  const grouped = accessibleReports.reduce((acc, report) => {
    if (!acc[report.category]) acc[report.category] = [];
    
    // We omit queryFn and other server secrets when sending to client
    const { queryFn, drillDownTo, chartSpec, ...clientDef } = report;
    acc[report.category].push(clientDef);
    return acc;
  }, {} as Record<string, any[]>);

  return grouped;
}

export async function generateReport(
  reportId: string, 
  filters: unknown
): Promise<GenerateReportResponse> {
  const session = await getSession();
  
  try {
    const result = await runReport(
      reportId,
      filters,
      session.orgId,
      session.userId,
      session.permissions
    );
    return result;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to generate report');
  }
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const session = await getSession();
  
  const job = await prisma.reportJob.findUnique({
    where: { id: jobId },
  });

  if (!job || job.organizationId !== session.orgId) {
    throw new Error('Job not found');
  }

  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    file_key: job.file_key,
    error: job.error,
    createdAt: job.createdAt,
    finished_at: job.finished_at,
  };
}

export async function listJobs(): Promise<JobStatusResponse[]> {
  const session = await getSession();
  
  const jobs = await prisma.reportJob.findMany({
    where: { organizationId: session.orgId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return jobs.map(job => ({
    id: job.id,
    status: job.status,
    progress: job.progress,
    file_key: job.file_key,
    error: job.error,
    createdAt: job.createdAt,
    finished_at: job.finished_at,
  }));
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

export interface ExportExcelResponse {
  /** Base64-encoded .xlsx file contents */
  base64: string;
  /** Suggested filename for the download */
  filename: string;
}

export async function exportReportToExcel(
  reportId: string,
  filters: unknown
): Promise<ExportExcelResponse> {
  const session = await getSession();

  // 1. Look up column definitions from the registry
  const reportDef = REGISTRY[reportId];
  if (!reportDef) {
    throw new Error(`Report ${reportId} not found in registry`);
  }

  // 2. Run the report (reuses the same runner as generateReport)
  const result = await runReport(
    reportId,
    filters,
    session.orgId,
    session.userId,
    session.permissions
  );

  // 3. Async exports are not supported yet
  if (result.async) {
    throw new Error(
      'This report is too large for instant export. Async Excel exports will be supported soon.'
    );
  }

  // 4. Generate the Excel buffer
  const buffer = await generateExcelBuffer(
    reportDef.columns,
    result.rows ?? [],
    result.totals ?? {}
  );

  // 5. Build a safe filename: "Daily_Revenue_by_Doctor_Department_2026-06-12.xlsx"
  const dateSuffix = new Date().toISOString().split('T')[0];
  const safeName = reportDef.name.replace(/[^a-zA-Z0-9]+/g, '_');
  const filename = `${safeName}_${dateSuffix}.xlsx`;

  // 6. Return Base64 — safe for Server Action serialization
  return {
    base64: buffer.toString('base64'),
    filename,
  };
}
