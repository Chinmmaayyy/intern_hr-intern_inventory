import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/backend/db';
import { ReportDefinition, ReportCategory, ValidatedFilters } from '../types';

export const dailyRevenueReport: ReportDefinition = {
  id: 'billing-revenue-daily',
  category: ReportCategory.Revenue,
  name: 'Daily Revenue by Doctor & Department',
  description: 'Shows daily billed and collected amounts grouped by doctor and department.',
  filters: z.object({
    date_start: z.string().or(z.date()),
    date_end: z.string().or(z.date()),
    branch_id: z.string().optional(),
    department_id: z.string().optional(),
  }),
  columns: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'department', label: 'Department', type: 'string' },
    { key: 'doctor_name', label: 'Doctor Name', type: 'string' },
    { key: 'payer_type', label: 'Payer Type', type: 'string' },
    { key: 'billed_amount', label: 'Billed Amount', type: 'currency', total: 'sum' },
    { key: 'collected_amount', label: 'Collected Amount', type: 'currency', total: 'sum' },
    { key: 'invoice_count', label: 'Invoice Count', type: 'number', total: 'sum' },
  ],
  defaultSort: { column: 'date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.billing.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end, branch_id, department_id } = filters;

    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(i.created_at) as "date",
        COALESCE(u.department, u.specialty, 'Unknown') as "department",
        COALESCE(u.name, 'Unknown') as "doctor_name",
        COALESCE(i.billing_patient_type, 'cash') as "payer_type",
        SUM(i.total_amount) as "billed_amount",
        SUM(p.amount) as "collected_amount",
        COUNT(DISTINCT i.id) as "invoice_count"
      FROM invoices i
      LEFT JOIN "users" u ON i.doctor_id = u.id
      LEFT JOIN payments p ON p.invoice_id = i.id
      WHERE i."organizationId" = ${orgId}
        AND i.status != 'cancelled'
        AND i.created_at >= ${new Date(date_start)}
        AND i.created_at <= ${new Date(date_end)}
        ${department_id ? Prisma.sql`AND (u.department = ${department_id} OR u.specialty = ${department_id})` : Prisma.empty}
      GROUP BY 
        DATE(i.created_at),
        COALESCE(u.department, u.specialty, 'Unknown'),
        u.name,
        i.billing_patient_type
      ORDER BY DATE(i.created_at) DESC
    `;

    const totals = rows.reduce(
      (acc, row) => {
        acc.billed_amount += Number(row.billed_amount || 0);
        acc.collected_amount += Number(row.collected_amount || 0);
        acc.invoice_count += Number(row.invoice_count || 0);
        return acc;
      },
      { billed_amount: 0, collected_amount: 0, invoice_count: 0 }
    );

    // Cast BigInt fields to Number for safe Server Action serialization
    const serializedRows = rows.map(row => ({
      ...row,
      billed_amount: Number(row.billed_amount),
      collected_amount: Number(row.collected_amount),
      invoice_count: Number(row.invoice_count),
    }));

    return { rows: serializedRows, totals };
  },
};
