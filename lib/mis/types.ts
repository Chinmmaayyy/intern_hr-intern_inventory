import { z } from 'zod';

export enum ReportCategory {
  Registration = 'Registration',
  Appointment = 'Appointment',
  Billing = 'Billing',
  Diagnostic = 'Diagnostic',
  Pharmacy = 'Pharmacy',
  Admission = 'Admission',
  OT = 'OT',
  Inventory = 'Inventory',
  Ambulance = 'Ambulance',
  Optical = 'Optical',
  Revenue = 'Revenue',
  Daily_Revenue = 'Daily Revenue',
}

export interface ColumnSpec {
  key: string;
  label: string;
  type: 'string' | 'number' | 'currency' | 'date' | 'percent';
  align?: 'left' | 'center' | 'right';
  total?: 'sum' | 'avg';
}

export interface ChartSpec {
  type: 'bar' | 'line' | 'pie' | 'doughnut';
  xAxisKey: string;
  yAxisKeys: string[];
  colors?: string[];
}

export type ValidatedFilters = Record<string, any>;

export interface ReportDefinition {
  id: string;                          // e.g. "billing-revenue-daily"
  category: ReportCategory;            // enum: Registration/Appointment/Billing...
  name: string;
  description: string;
  filters: z.ZodSchema;                // ZodSchema for validation
  columns: ColumnSpec[];               // e.g. { key, label, type, align, total }
  defaultSort: { column: string; direction: 'asc' | 'desc' };
  rowLimitSync: number;                // default 5000 — above this triggers async job
  queryFn: (filters: ValidatedFilters, orgId: string) => Promise<{ rows: Record<string, unknown>[]; totals: Record<string, number> }>;
  chartSpec?: ChartSpec;               // optional Chart.js spec for visual reports
  drillDownTo?: string;                // report_id of the detail report for drill-down
  requiredPermission: string;          // e.g. "mis_reports.billing.view"
  moduleFlag?: string;                 // e.g. "optical" — hides report if module disabled
}
