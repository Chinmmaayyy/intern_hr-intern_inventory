'use server';

import { PrismaClient } from '@prisma/client';
import { runReport } from '@/lib/mis/runner';
import { dailyRevenueReport } from '@/lib/mis/registry/billing';
import { GenerateReportResponse, JobStatusResponse } from '@/lib/mis/action-types';
import { ReportCategory } from '@/lib/mis/types';

const prisma = new PrismaClient();

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
