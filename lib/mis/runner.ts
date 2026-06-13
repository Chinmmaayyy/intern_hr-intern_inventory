/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Prisma } from '@prisma/client';
import { prisma } from '@/backend/db';
import { assertReportAccess, MISAccessDeniedError } from './rbac';
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
} from './registry/billing';
import {
  revenueDepartmentWiseReport,
  revenuePayerTypeWiseReport,
  revenuePayerNameWiseReport,
  revenueServiceTypeWiseReport,
  revenueBillingCategoryWiseReport,
  revenueWardWiseReport
} from './registry/revenue';
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
} from './registry/frontdesk';
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
} from './registry/diagnostic';
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
} from './registry/pharmacy';
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
} from './registry/inventory';
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
} from './registry/specialized';
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
  [billingOpRefundReport.id]: billingOpRefundReport,
  [billingDateWiseCashReport.id]: billingDateWiseCashReport,
  [billingDoctorPayoutReport.id]: billingDoctorPayoutReport,
  [billingDoctorAccountPayableReport.id]: billingDoctorAccountPayableReport,
  [billingIpPackageReport.id]: billingIpPackageReport,
  [billingHealthCheckupCountReport.id]: billingHealthCheckupCountReport,
  [billingPayerAgreementExpiryReport.id]: billingPayerAgreementExpiryReport,
  [billingDepositRefundReport.id]: billingDepositRefundReport,
  [billingPendingBillsReport.id]: billingPendingBillsReport,
  [billingPaymentServiceTypeReport.id]: billingPaymentServiceTypeReport,
  [billingPaymentSummaryReport.id]: billingPaymentSummaryReport,
  [billingRevenueSummaryReport.id]: billingRevenueSummaryReport,
  [billingCancelBillReport.id]: billingCancelBillReport,
  [billingServiceTypeSummaryReport.id]: billingServiceTypeSummaryReport,
  [revenueDepartmentWiseReport.id]: revenueDepartmentWiseReport,
  [revenuePayerTypeWiseReport.id]: revenuePayerTypeWiseReport,
  [revenuePayerNameWiseReport.id]: revenuePayerNameWiseReport,
  [revenueServiceTypeWiseReport.id]: revenueServiceTypeWiseReport,
  [revenueBillingCategoryWiseReport.id]: revenueBillingCategoryWiseReport,
  [revenueWardWiseReport.id]: revenueWardWiseReport,
  [preRegistrationReport.id]: preRegistrationReport,
  [registrationConvertReport.id]: registrationConvertReport,
  [registrationReport.id]: registrationReport,
  [appointmentReport.id]: appointmentReport,
  [doctorEventOffReport.id]: doctorEventOffReport,
  [doctorEventOffSummaryReport.id]: doctorEventOffSummaryReport,
  [appointmentTatReport.id]: appointmentTatReport,
  [doctorFootfallReport.id]: doctorFootfallReport,
  [ipPatientReport.id]: ipPatientReport,
  [ipConversionReport.id]: ipConversionReport,
  [ipCancelReport.id]: ipCancelReport,
  [ipDischargeReport.id]: ipDischargeReport,
  [erToIpConversionReport.id]: erToIpConversionReport,
  [bedStatusReport.id]: bedStatusReport,
  [admissionsListReport.id]: admissionsListReport,
  [emergencyAdmissionsReport.id]: emergencyAdmissionsReport,
  [bedOccupancyReport.id]: bedOccupancyReport,
  [emergencyDischargeReport.id]: emergencyDischargeReport,
  [bedTransferReport.id]: bedTransferReport,
  [doctorTransferReport.id]: doctorTransferReport,
  [expiredPatientsReport.id]: expiredPatientsReport,
  [counsellingSummaryReport.id]: counsellingSummaryReport,
  [dischargeTatReport.id]: dischargeTatReport,
  [diagCardiologyAppointmentReport.id]: diagCardiologyAppointmentReport,
  [diagNeurologyAppointmentReport.id]: diagNeurologyAppointmentReport,
  [diagNuclearMedicineAppointmentReport.id]: diagNuclearMedicineAppointmentReport,
  [diagPathologyAppointmentReport.id]: diagPathologyAppointmentReport,
  [diagPulmonologyAppointmentReport.id]: diagPulmonologyAppointmentReport,
  [diagRadiologyAppointmentReport.id]: diagRadiologyAppointmentReport,
  [diagCardiologyServiceReport.id]: diagCardiologyServiceReport,
  [diagNeurologyServiceReport.id]: diagNeurologyServiceReport,
  [diagPulmonologyServiceReport.id]: diagPulmonologyServiceReport,
  [diagPathologyServiceReport.id]: diagPathologyServiceReport,
  [diagTatReport.id]: diagTatReport,
  [diagPathologyTatReport.id]: diagPathologyTatReport,
  [diagRadiologyTatReport.id]: diagRadiologyTatReport,
  [pharmacyIpIssueReport.id]: pharmacyIpIssueReport,
  [pharmacyIpItemDetailReport.id]: pharmacyIpItemDetailReport,
  [pharmacyOpItemDetailReport.id]: pharmacyOpItemDetailReport,
  [pharmacyOpSummaryDetailReport.id]: pharmacyOpSummaryDetailReport,
  [pharmacyIpDailyReport.id]: pharmacyIpDailyReport,
  [pharmacyDailyIpReturnReport.id]: pharmacyDailyIpReturnReport,
  [pharmacyDailyIpIssueReport.id]: pharmacyDailyIpIssueReport,
  [pharmacyOpTaxSummaryReport.id]: pharmacyOpTaxSummaryReport,
  [pharmacyOpTaxDetailsReport.id]: pharmacyOpTaxDetailsReport,
  [pharmacyIpIssueWithTagsReport.id]: pharmacyIpIssueWithTagsReport,
  [pharmacyOpSaleWithTagsReport.id]: pharmacyOpSaleWithTagsReport,
  [pharmacyItemReorderLevelReport.id]: pharmacyItemReorderLevelReport,
  [pharmacySupplierListReport.id]: pharmacySupplierListReport,
  [pharmacyCurrentStockReport.id]: pharmacyCurrentStockReport,
  [pharmacyExpiryReport.id]: pharmacyExpiryReport,
  [pharmacyDoctorWiseSaleReport.id]: pharmacyDoctorWiseSaleReport,
  [pharmacyPatientPullOffReport.id]: pharmacyPatientPullOffReport,
  [pharmacyDoctorPullOffReport.id]: pharmacyDoctorPullOffReport,
  [pharmacyIpPullOffReport.id]: pharmacyIpPullOffReport,
  [inventoryStockReport.id]: inventoryStockReport,
  [inventoryItemWiseStockReport.id]: inventoryItemWiseStockReport,
  [inventoryGrnSummaryReport.id]: inventoryGrnSummaryReport,
  [inventoryGrnReturnSummaryReport.id]: inventoryGrnReturnSummaryReport,
  [inventoryItemMasterReport.id]: inventoryItemMasterReport,
  [inventoryGrnDetailReport.id]: inventoryGrnDetailReport,
  [inventoryGrnReturnDetailReport.id]: inventoryGrnReturnDetailReport,
  [inventoryStoreToStoreIssueReport.id]: inventoryStoreToStoreIssueReport,
  [inventoryBatchInflowOutflowReport.id]: inventoryBatchInflowOutflowReport,
  [inventoryAsOnDateStockReport.id]: inventoryAsOnDateStockReport,
  [inventoryHsnTaxSummaryReport.id]: inventoryHsnTaxSummaryReport,
  [inventoryBinCardBatchReport.id]: inventoryBinCardBatchReport,
  [inventoryBinCardItemReport.id]: inventoryBinCardItemReport,
  [inventoryMovingItemsReport.id]: inventoryMovingItemsReport,
  [inventoryGrnPendingCnReport.id]: inventoryGrnPendingCnReport,
  [inventoryStoreConsumptionReport.id]: inventoryStoreConsumptionReport,
  [otBookingDetailsReport.id]: otBookingDetailsReport,
  [otSurgeryDetailsReport.id]: otSurgeryDetailsReport,
  [otSurgeryTatReport.id]: otSurgeryTatReport,
  [ambulanceOrdersReport.id]: ambulanceOrdersReport,
  [ambulanceRequestReport.id]: ambulanceRequestReport,
  [ambulanceTatReport.id]: ambulanceTatReport,
  [opticalItemBillingReport.id]: opticalItemBillingReport,
  [opticalProductBillingReport.id]: opticalProductBillingReport,
  [opticalDailySettlementReport.id]: opticalDailySettlementReport,
  [opticalDailySettlementSumReport.id]: opticalDailySettlementSumReport,
  [opticalPaymentReport.id]: opticalPaymentReport,
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

  // 1. Check permissions — throws MISAccessDeniedError if the user's role
  //    does not include the report's requiredPermission.
  assertReportAccess(reportDef.requiredPermission, userPermissions);

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
