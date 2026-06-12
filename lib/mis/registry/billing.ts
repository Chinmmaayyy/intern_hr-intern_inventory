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

export const billingDetailReport: ReportDefinition = {
  id: 'billing-detail',
  category: ReportCategory.Billing,
  name: 'Billing - Billing Detail',
  description: 'Granular list of individual invoice items.',
  filters: z.object({
    date_start: z.string().or(z.date()),
    date_end: z.string().or(z.date()),
    department_id: z.string().optional(),
  }),
  columns: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'invoice_number', label: 'Invoice No', type: 'string' },
    { key: 'department', label: 'Department', type: 'string' },
    { key: 'item_name', label: 'Item Name', type: 'string' },
    { key: 'quantity', label: 'Quantity', type: 'number', total: 'sum' },
    { key: 'amount', label: 'Amount', type: 'currency', total: 'sum' },
  ],
  defaultSort: { column: 'date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.billing.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end, department_id } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(i.created_at) as "date",
        i.invoice_number as "invoice_number",
        ii.department as "department",
        ii.description as "item_name",
        ii.quantity as "quantity",
        ii.total_price as "amount"
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i."organizationId" = ${orgId}
        AND i.status != 'cancelled'
        AND i.created_at >= ${new Date(date_start)}
        AND i.created_at <= ${new Date(date_end)}
        ${department_id ? Prisma.sql`AND ii.department = ${department_id}` : Prisma.empty}
      ORDER BY DATE(i.created_at) DESC, i.invoice_number ASC
    `;

    const totals = rows.reduce(
      (acc, row) => {
        acc.quantity += Number(row.quantity || 0);
        acc.amount += Number(row.amount || 0);
        return acc;
      },
      { quantity: 0, amount: 0 }
    );

    const serializedRows = rows.map(row => ({
      ...row,
      quantity: Number(row.quantity),
      amount: Number(row.amount),
    }));

    return { rows: serializedRows, totals };
  },
};

export const billingItemDetailReport: ReportDefinition = {
  id: 'billing-item-detail',
  category: ReportCategory.Billing,
  name: 'Billing - Billing Item Detail',
  description: 'Item-level breakdown of quantities and amounts billed.',
  filters: z.object({
    date_start: z.string().or(z.date()),
    date_end: z.string().or(z.date()),
    item_name: z.string().optional(),
  }),
  columns: [
    { key: 'item_name', label: 'Item Name', type: 'string' },
    { key: 'department', label: 'Department', type: 'string' },
    { key: 'quantity', label: 'Total Quantity', type: 'number', total: 'sum' },
    { key: 'amount', label: 'Total Amount', type: 'currency', total: 'sum' },
  ],
  defaultSort: { column: 'amount', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.billing.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end, item_name } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        ii.description as "item_name",
        ii.department as "department",
        SUM(ii.quantity) as "quantity",
        SUM(ii.total_price) as "amount"
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i."organizationId" = ${orgId}
        AND i.status != 'cancelled'
        AND i.created_at >= ${new Date(date_start)}
        AND i.created_at <= ${new Date(date_end)}
        ${item_name ? Prisma.sql`AND ii.description ILIKE ${'%' + item_name + '%'}` : Prisma.empty}
      GROUP BY ii.description, ii.department
      ORDER BY SUM(ii.total_price) DESC
    `;

    const totals = rows.reduce(
      (acc, row) => {
        acc.quantity += Number(row.quantity || 0);
        acc.amount += Number(row.amount || 0);
        return acc;
      },
      { quantity: 0, amount: 0 }
    );

    const serializedRows = rows.map(row => ({
      ...row,
      quantity: Number(row.quantity),
      amount: Number(row.amount),
    }));

    return { rows: serializedRows, totals };
  },
};

export const billingSummaryReport: ReportDefinition = {
  id: 'billing-summary',
  category: ReportCategory.Billing,
  name: 'Billing - Billing Summary',
  description: 'High-level aggregation of total billed, discounts, and net amounts per day.',
  filters: z.object({
    date_start: z.string().or(z.date()),
    date_end: z.string().or(z.date()),
    branch_id: z.string().optional(),
  }),
  columns: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'total_billed', label: 'Total Billed', type: 'currency', total: 'sum' },
    { key: 'total_discount', label: 'Total Discount', type: 'currency', total: 'sum' },
    { key: 'net_amount', label: 'Net Amount', type: 'currency', total: 'sum' },
    { key: 'invoice_count', label: 'Invoice Count', type: 'number', total: 'sum' },
  ],
  defaultSort: { column: 'date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.billing.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end, branch_id } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(i.created_at) as "date",
        SUM(i.total_amount) as "total_billed",
        SUM(i.total_discount) as "total_discount",
        SUM(i.net_amount) as "net_amount",
        COUNT(i.id) as "invoice_count"
      FROM invoices i
      WHERE i."organizationId" = ${orgId}
        AND i.status != 'cancelled'
        AND i.created_at >= ${new Date(date_start)}
        AND i.created_at <= ${new Date(date_end)}
        -- ${branch_id ? Prisma.sql`AND branch_id = ${branch_id}` : Prisma.empty}
      GROUP BY DATE(i.created_at)
      ORDER BY DATE(i.created_at) DESC
    `;

    const totals = rows.reduce(
      (acc, row) => {
        acc.total_billed += Number(row.total_billed || 0);
        acc.total_discount += Number(row.total_discount || 0);
        acc.net_amount += Number(row.net_amount || 0);
        acc.invoice_count += Number(row.invoice_count || 0);
        return acc;
      },
      { total_billed: 0, total_discount: 0, net_amount: 0, invoice_count: 0 }
    );

    const serializedRows = rows.map(row => ({
      ...row,
      total_billed: Number(row.total_billed),
      total_discount: Number(row.total_discount),
      net_amount: Number(row.net_amount),
      invoice_count: Number(row.invoice_count),
    }));

    return { rows: serializedRows, totals };
  },
};

export const billingSummaryDetailReport: ReportDefinition = {
  id: 'billing-summary-detail',
  category: ReportCategory.Billing,
  name: 'Billing - Billing Summary Detail',
  description: 'Patient-level summary of all invoices generated within the period.',
  filters: z.object({
    date_start: z.string().or(z.date()),
    date_end: z.string().or(z.date()),
    patient_uhid: z.string().optional(),
  }),
  columns: [
    { key: 'patient_id', label: 'Patient UHID', type: 'string' },
    { key: 'invoice_number', label: 'Invoice No', type: 'string' },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'total_amount', label: 'Total Amount', type: 'currency', total: 'sum' },
    { key: 'net_amount', label: 'Net Amount', type: 'currency', total: 'sum' },
    { key: 'paid_amount', label: 'Paid Amount', type: 'currency', total: 'sum' },
    { key: 'balance_due', label: 'Balance Due', type: 'currency', total: 'sum' },
  ],
  defaultSort: { column: 'date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.billing.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end, patient_uhid } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        i.patient_id as "patient_id",
        i.invoice_number as "invoice_number",
        DATE(i.created_at) as "date",
        i.total_amount as "total_amount",
        i.net_amount as "net_amount",
        i.paid_amount as "paid_amount",
        i.balance_due as "balance_due"
      FROM invoices i
      WHERE i."organizationId" = ${orgId}
        AND i.status != 'cancelled'
        AND i.created_at >= ${new Date(date_start)}
        AND i.created_at <= ${new Date(date_end)}
        ${patient_uhid ? Prisma.sql`AND i.patient_id = ${patient_uhid}` : Prisma.empty}
      ORDER BY DATE(i.created_at) DESC, i.invoice_number ASC
    `;

    const totals = rows.reduce(
      (acc, row) => {
        acc.total_amount += Number(row.total_amount || 0);
        acc.net_amount += Number(row.net_amount || 0);
        acc.paid_amount += Number(row.paid_amount || 0);
        acc.balance_due += Number(row.balance_due || 0);
        return acc;
      },
      { total_amount: 0, net_amount: 0, paid_amount: 0, balance_due: 0 }
    );

    const serializedRows = rows.map(row => ({
      ...row,
      total_amount: Number(row.total_amount),
      net_amount: Number(row.net_amount),
      paid_amount: Number(row.paid_amount),
      balance_due: Number(row.balance_due),
    }));

    return { rows: serializedRows, totals };
  },
};

export const billingPaymentModeReport: ReportDefinition = {
  id: 'billing-payment-mode',
  category: ReportCategory.Billing,
  name: 'Billing - Payment Mode Breakup',
  description: 'Breakup of collected amounts by payment mode.',
  filters: z.object({
    date_start: z.string().or(z.date()),
    date_end: z.string().or(z.date()),
  }),
  columns: [
    { key: 'payment_mode', label: 'Payment Mode', type: 'string' },
    { key: 'transaction_count', label: 'Transaction Count', type: 'number', total: 'sum' },
    { key: 'collected_amount', label: 'Collected Amount', type: 'currency', total: 'sum' },
  ],
  defaultSort: { column: 'collected_amount', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.billing.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        p.payment_method as "payment_mode",
        COUNT(p.id) as "transaction_count",
        SUM(p.amount) as "collected_amount"
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      WHERE i."organizationId" = ${orgId}
        AND i.status != 'cancelled'
        AND i.created_at >= ${new Date(date_start)}
        AND i.created_at <= ${new Date(date_end)}
        AND p.status = 'Completed'
      GROUP BY p.payment_method
      ORDER BY SUM(p.amount) DESC
    `;

    const totals = rows.reduce(
      (acc, row) => {
        acc.transaction_count += Number(row.transaction_count || 0);
        acc.collected_amount += Number(row.collected_amount || 0);
        return acc;
      },
      { transaction_count: 0, collected_amount: 0 }
    );

    const serializedRows = rows.map(row => ({
      ...row,
      transaction_count: Number(row.transaction_count),
      collected_amount: Number(row.collected_amount),
    }));

    return { rows: serializedRows, totals };
  },
};
