/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use server';

/**
 * app/actions/mis-report-actions.ts
 * ----------------------------------
 * All MIS-module Server Actions live here.
 *
 * ## RBAC contract (per directive)
 *   - `generateReport` NEVER throws an unhandled error for access denial.
 *     On `MISAccessDeniedError` it returns a safe object so the calling
 *     Server Component can pass it to `UniversalReportShell` which then
 *     renders the polite <AccessDeniedState> UI.
 *   - `exportReportToExcel` is called from a Client Component button; on
 *     access denial it throws a user-friendly string so ExportExcelButton
 *     can display its `error` state.
 *   - `listCatalogue` already filtered by `requiredPermission`; RBAC is now
 *     enforced end-to-end because `runReport` calls `assertReportAccess`.
 *
 * ## Session note
 *   `getSession()` is a mock that reads the first User from the DB and derives
 *   MIS permissions from `User.role` via `getMISPermissions()`. Once a real
 *   auth provider (NextAuth, JWT, etc.) is wired, replace `getSession` only —
 *   no other function in this file needs to change.
 */

import { prisma } from '@/backend/db';
import { runReport, REGISTRY } from '@/lib/mis/runner';
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
  billingRefundReport,
  billingOpRefundReport,
  billingDateWiseCashReport,
  billingDoctorPayoutReport,
  billingDoctorAccountPayableReport,
  billingIpPackageReport,
  billingHealthCheckupCountReport,
  billingPayerAgreementExpiryReport,
  billingDepositRefundReport,
  billingPendingBillsReport,
  billingPaymentServiceTypeReport,
  billingPaymentSummaryReport,
  billingRevenueSummaryReport,
  billingCancelBillReport,
  billingServiceTypeSummaryReport
} from '@/lib/mis/registry/billing';
import {
  revenueDepartmentWiseReport,
  revenuePayerTypeWiseReport,
  revenuePayerNameWiseReport,
  revenueServiceTypeWiseReport,
  revenueBillingCategoryWiseReport,
  revenueWardWiseReport
} from '@/lib/mis/registry/revenue';
import {
  preRegistrationReport,
  registrationConvertReport,
  registrationReport,
  appointmentReport,
  doctorEventOffReport,
  doctorEventOffSummaryReport,
  appointmentTatReport,
  doctorFootfallReport,
  ipPatientReport,
  ipConversionReport,
  ipCancelReport,
  ipDischargeReport,
  erToIpConversionReport,
  bedStatusReport,
  admissionsListReport,
  emergencyAdmissionsReport,
  bedOccupancyReport,
  emergencyDischargeReport,
  bedTransferReport,
  doctorTransferReport,
  expiredPatientsReport,
  counsellingSummaryReport,
  dischargeTatReport
} from '@/lib/mis/registry/frontdesk';
import {
  diagCardiologyAppointmentReport,
  diagNeurologyAppointmentReport,
  diagNuclearMedicineAppointmentReport,
  diagPathologyAppointmentReport,
  diagPulmonologyAppointmentReport,
  diagRadiologyAppointmentReport,
  diagCardiologyServiceReport,
  diagNeurologyServiceReport,
  diagPulmonologyServiceReport,
  diagPathologyServiceReport,
  diagTatReport,
  diagPathologyTatReport,
  diagRadiologyTatReport
} from '@/lib/mis/registry/diagnostic';
import {
  pharmacyIpIssueReport,
  pharmacyIpItemDetailReport,
  pharmacyOpItemDetailReport,
  pharmacyOpSummaryDetailReport,
  pharmacyIpDailyReport,
  pharmacyDailyIpReturnReport,
  pharmacyDailyIpIssueReport,
  pharmacyOpTaxSummaryReport,
  pharmacyOpTaxDetailsReport,
  pharmacyIpIssueWithTagsReport,
  pharmacyOpSaleWithTagsReport,
  pharmacyItemReorderLevelReport,
  pharmacySupplierListReport,
  pharmacyCurrentStockReport,
  pharmacyExpiryReport,
  pharmacyDoctorWiseSaleReport,
  pharmacyPatientPullOffReport,
  pharmacyDoctorPullOffReport,
  pharmacyIpPullOffReport
} from '@/lib/mis/registry/pharmacy';
import {
  inventoryStockReport,
  inventoryItemWiseStockReport,
  inventoryGrnSummaryReport,
  inventoryGrnReturnSummaryReport,
  inventoryItemMasterReport,
  inventoryGrnDetailReport,
  inventoryGrnReturnDetailReport,
  inventoryStoreToStoreIssueReport,
  inventoryBatchInflowOutflowReport,
  inventoryAsOnDateStockReport,
  inventoryHsnTaxSummaryReport,
  inventoryBinCardBatchReport,
  inventoryBinCardItemReport,
  inventoryMovingItemsReport,
  inventoryGrnPendingCnReport,
  inventoryStoreConsumptionReport
} from '@/lib/mis/registry/inventory';
import {
  otBookingDetailsReport,
  otSurgeryDetailsReport,
  otSurgeryTatReport,
  ambulanceOrdersReport,
  ambulanceRequestReport,
  ambulanceTatReport,
  opticalItemBillingReport,
  opticalProductBillingReport,
  opticalDailySettlementReport,
  opticalDailySettlementSumReport,
  opticalPaymentReport
} from '@/lib/mis/registry/specialized';
import { generateExcelBuffer } from '@/lib/mis/exporter';
import { GenerateReportResponse, JobStatusResponse, ExportExcelResponse } from '@/lib/mis/action-types';
import { getMISPermissions, MISAccessDeniedError } from '@/lib/mis/rbac';
import type { ColumnSpec } from '@/lib/mis/types';

// ─── Session ──────────────────────────────────────────────────────────────────

/**
 * Mock session resolver.
 *
 * Reads the first User from the DB and derives MIS permissions from their
 * `User.role` string via `getMISPermissions()`.
 *
 * IMPORTANT: Replace this function's body with a real auth lookup (NextAuth
 * `getServerSession`, JWT decode, etc.) before production. The public API of
 * `getSession()` must remain unchanged — callers only use `orgId`, `userId`,
 * and `permissions`.
 */
async function getSession() {
  const user = await prisma.user.findFirst({
    select: { id: true, organizationId: true, role: true },
  });
  if (!user) throw new Error('No users found in database for mock session');

  return {
    orgId: user.organizationId,
    userId: user.id,
    // `user.role` is the raw String from the DB (e.g. "admin", "doctor").
    // getMISPermissions() maps it to the correct MIS permission set, falling
    // back to `viewer` defaults for any unknown role string.
    permissions: getMISPermissions(user.role),
  };
}

// ─── Catalogue ────────────────────────────────────────────────────────────────

export async function listCatalogue() {
  const session = await getSession();

  const allReports = [
    billingDetailReport,
    billingItemDetailReport,
    billingSummaryReport,
    billingSummaryDetailReport,
    billingPaymentModeReport,
    billingUhidAdvanceReport,
    billingAdmissionAdvanceReport,
    billingDiscountSummaryReport,
    billingDueSettledReport,
    billingRefundReport,
    billingOpRefundReport,
    billingDateWiseCashReport,
    billingDoctorPayoutReport,
    billingDoctorAccountPayableReport,
    billingIpPackageReport,
    billingHealthCheckupCountReport,
    billingPayerAgreementExpiryReport,
    billingDepositRefundReport,
    billingPendingBillsReport,
    billingPaymentServiceTypeReport,
    billingPaymentSummaryReport,
    billingRevenueSummaryReport,
    billingCancelBillReport,
    billingServiceTypeSummaryReport,
    revenueDepartmentWiseReport,
    revenuePayerTypeWiseReport,
    revenuePayerNameWiseReport,
    revenueServiceTypeWiseReport,
    revenueBillingCategoryWiseReport,
    revenueWardWiseReport,
    preRegistrationReport,
    registrationConvertReport,
    registrationReport,
    appointmentReport,
    doctorEventOffReport,
    doctorEventOffSummaryReport,
    appointmentTatReport,
    doctorFootfallReport,
    ipPatientReport,
    ipConversionReport,
    ipCancelReport,
    ipDischargeReport,
    erToIpConversionReport,
    bedStatusReport,
    admissionsListReport,
    emergencyAdmissionsReport,
    bedOccupancyReport,
    emergencyDischargeReport,
    bedTransferReport,
    doctorTransferReport,
    expiredPatientsReport,
    counsellingSummaryReport,
    dischargeTatReport,
    diagCardiologyAppointmentReport,
    diagNeurologyAppointmentReport,
    diagNuclearMedicineAppointmentReport,
    diagPathologyAppointmentReport,
    diagPulmonologyAppointmentReport,
    diagRadiologyAppointmentReport,
    diagCardiologyServiceReport,
    diagNeurologyServiceReport,
    diagPulmonologyServiceReport,
    diagPathologyServiceReport,
    diagTatReport,
    diagPathologyTatReport,
    diagRadiologyTatReport,
    pharmacyIpIssueReport,
    pharmacyIpItemDetailReport,
    pharmacyOpItemDetailReport,
    pharmacyOpSummaryDetailReport,
    pharmacyIpDailyReport,
    pharmacyDailyIpReturnReport,
    pharmacyDailyIpIssueReport,
    pharmacyOpTaxSummaryReport,
    pharmacyOpTaxDetailsReport,
    pharmacyIpIssueWithTagsReport,
    pharmacyOpSaleWithTagsReport,
    pharmacyItemReorderLevelReport,
    pharmacySupplierListReport,
    pharmacyCurrentStockReport,
    pharmacyExpiryReport,
    pharmacyDoctorWiseSaleReport,
    pharmacyPatientPullOffReport,
    pharmacyDoctorPullOffReport,
    pharmacyIpPullOffReport,
    inventoryStockReport,
    inventoryItemWiseStockReport,
    inventoryGrnSummaryReport,
    inventoryGrnReturnSummaryReport,
    inventoryItemMasterReport,
    inventoryGrnDetailReport,
    inventoryGrnReturnDetailReport,
    inventoryStoreToStoreIssueReport,
    inventoryBatchInflowOutflowReport,
    inventoryAsOnDateStockReport,
    inventoryHsnTaxSummaryReport,
    inventoryBinCardBatchReport,
    inventoryBinCardItemReport,
    inventoryMovingItemsReport,
    inventoryGrnPendingCnReport,
    inventoryStoreConsumptionReport,
    otBookingDetailsReport,
    otSurgeryDetailsReport,
    otSurgeryTatReport,
    ambulanceOrdersReport,
    ambulanceRequestReport,
    ambulanceTatReport,
    opticalItemBillingReport,
    opticalProductBillingReport,
    opticalDailySettlementReport,
    opticalDailySettlementSumReport,
    opticalPaymentReport
  ];

  // Only surface reports the session's role can actually run.
  const accessibleReports = allReports.filter((r) =>
    session.permissions.includes(r.requiredPermission)
  );

  const grouped = accessibleReports.reduce((acc, report) => {
    if (!acc[report.category]) acc[report.category] = [];
    // Strip server-only fields before sending to the client.
    const { queryFn, drillDownTo, chartSpec, ...clientDef } = report;
    acc[report.category].push(clientDef);
    return acc;
  }, {} as Record<string, any[]>);

  return grouped;
}

// ─── Generate Report ──────────────────────────────────────────────────────────

/**
 * Runs a report and returns a `GenerateReportResponse`.
 *
 * ## Access Denied — safe return instead of throw
 * Per directive: this action MUST NOT throw an unhandled error on access
 * denial. Doing so would cause Next.js to crash to the error boundary from the
 * Server Component page. Instead, on `MISAccessDeniedError` we return:
 *
 *   { async: false, error: 'UNAUTHORIZED' }
 *
 * `UniversalReportShell` checks for `payload.error === 'UNAUTHORIZED'` and
 * renders the polite <AccessDeniedState> UI.
 *
 * All other unexpected errors are still re-thrown so the error boundary
 * (or a wrapping try/catch in page.tsx) can handle them.
 */
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
    // ── Safe path: access denial → return, not throw ──────────────────────
    if (error?.code === 'MIS_ACCESS_DENIED') {
      return {
        async: false,
        error: 'UNAUTHORIZED',
      };
    }
    // ── All other errors: re-throw for Next.js error boundary ─────────────
    throw new Error(error.message ?? 'Failed to generate report');
  }
}

// ─── Job Status ───────────────────────────────────────────────────────────────

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

  return jobs.map((job) => ({
    id: job.id,
    status: job.status,
    progress: job.progress,
    file_key: job.file_key,
    error: job.error,
    createdAt: job.createdAt,
    finished_at: job.finished_at,
  }));
}

/**
 * Runs a report and returns the result as a Base64-encoded Excel file
 * (sync path) or queues a background job (async path) for the
 * ExportExcelButton to poll via getJobStatus().
 *
 * ## Return shape
 * Sync  → { async: false, base64: string, filename: string }
 * Async → { async: true,  jobId: string }
 *
 * ## Access Denial
 * Called from a Client Component button — ExportExcelButton already handles
 * thrown errors by transitioning to its `error` state and showing the message.
 * So we throw a user-friendly string here (safe for that context).
 */
export async function exportReportToExcel(
  reportId: string,
  filters: unknown
): Promise<ExportExcelResponse> {
  const session = await getSession();

  // 1. Look up column definitions from the registry.
  const reportDef = REGISTRY[reportId];
  if (!reportDef) {
    throw new Error(`Report "${reportId}" not found in registry.`);
  }

  // 2. Run the report — assertReportAccess fires inside runReport.
  let result: GenerateReportResponse;
  try {
    result = await runReport(
      reportId,
      filters,
      session.orgId,
      session.userId,
      session.permissions
    );
  } catch (error: any) {
    if (error?.code === 'MIS_ACCESS_DENIED') {
      // Throw a user-readable message — ExportExcelButton shows it in-line.
      throw new Error(
        'You do not have permission to export this report. Contact your administrator.'
      );
    }
    throw new Error(error.message ?? 'Failed to export report.');
  }

  // 3. Large report — queue a background Excel job and return jobId.
  //    ExportExcelButton enters its 'polling' state and calls getJobStatus()
  //    every 2 s until job.status === 'Completed'.
  if (result.async) {
    // Prisma field names are exact — verified against schema.prisma in Phase 1.
    const job = await prisma.reportJob.create({
      data: {
        report_id: reportId,
        filters_json: (filters ?? {}) as any,
        requested_by: session.userId,
        organizationId: session.orgId,
        format: 'Excel',
        status: 'Queued',
      },
    });
    return { async: true, jobId: job.id };
  }

  // 4. Generate the Excel buffer.
  const buffer = await generateExcelBuffer(
    reportDef.columns,
    result.rows ?? [],
    result.totals ?? {}
  );

  // 5. Build a safe, date-stamped filename.
  const dateSuffix = new Date().toISOString().split('T')[0];
  const safeName = reportDef.name.replace(/[^a-zA-Z0-9]+/g, '_');

  // 6. Return Base64 — safe for Server Action serialisation.
  return {
    async: false,
    base64: buffer.toString('base64'),
    filename: `${safeName}_${dateSuffix}.xlsx`,
  };
}

// ─── Report Columns (for Drill-Down) ─────────────────────────────────────────

/**
 * Returns only the safe, serialisable column spec and display name for a
 * given report. Used by `UniversalReportShell` to render the `DrillDownPanel`
 * without requiring a second full `generateReport` just for schema discovery.
 *
 * Does NOT enforce RBAC — column metadata is not sensitive. The actual data
 * fetch (via `generateReport`) enforces access.
 */
export async function getReportColumns(
  reportId: string
): Promise<{ columns: ColumnSpec[]; name: string }> {
  const reportDef = REGISTRY[reportId];
  if (!reportDef) {
    throw new Error(`Report "${reportId}" not found in registry.`);
  }
  return { columns: reportDef.columns, name: reportDef.name };
}
