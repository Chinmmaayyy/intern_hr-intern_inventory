import { z } from 'zod';
import { prisma } from '@/backend/db';
import { ReportDefinition, ReportCategory, ValidatedFilters } from '../types';

const defaultFilters = z.object({
  date_start: z.string().or(z.date()),
  date_end: z.string().or(z.date()),
});

// ─── Batch 13: Pharmacy — IP Issues & Detail (SN 46–50) ─────────────────

export const pharmacyIpIssueReport: ReportDefinition = {
  id: 'pharmacy-ip-issue',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - Pharmacy IP Issue',
  description: 'Summary of all pharmacy orders issued to inpatients.',
  filters: defaultFilters,
  columns: [
    { key: 'issue_date', label: 'Issue Date', type: 'date' },
    { key: 'order_id', label: 'Order ID', type: 'string' },
    { key: 'ip_number', label: 'IP Number', type: 'string' },
    { key: 'patient_name', label: 'Patient Name', type: 'string' },
    { key: 'doctor_name', label: 'Doctor', type: 'string' },
    { key: 'status', label: 'Status', type: 'string' },
    { key: 'total_amount', label: 'Total Amount', type: 'currency' },
  ],
  defaultSort: { column: 'issue_date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(po.created_at) as "issue_date",
        po.id::text as "order_id",
        po.admission_id as "ip_number",
        p.full_name as "patient_name",
        COALESCE(doc.name, 'Unassigned') as "doctor_name",
        po.status as "status",
        po.total_amount as "total_amount"
      FROM "pharmacy_orders" po
      LEFT JOIN "OPD_REG" p ON po.patient_id = p.patient_id
      LEFT JOIN "users" doc ON po.doctor_id = doc.id
      WHERE po."organizationId" = ${orgId}
        AND po.is_ipd_linked = true
        AND po.created_at >= ${new Date(date_start)}
        AND po.created_at <= ${new Date(date_end)}
      ORDER BY po.created_at DESC
    `;
    return { rows, totals: {} };
  },
};

export const pharmacyIpItemDetailReport: ReportDefinition = {
  id: 'pharmacy-ip-item-detail',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - Pharmacy IP Item Detail',
  description: 'Detailed list of all pharmacy items issued to inpatients.',
  filters: defaultFilters,
  columns: [
    { key: 'issue_date', label: 'Issue Date', type: 'date' },
    { key: 'order_id', label: 'Order ID', type: 'string' },
    { key: 'ip_number', label: 'IP Number', type: 'string' },
    { key: 'patient_name', label: 'Patient Name', type: 'string' },
    { key: 'item_name', label: 'Item Name', type: 'string' },
    { key: 'batch', label: 'Batch', type: 'string' },
    { key: 'quantity', label: 'Quantity', type: 'number' },
    { key: 'unit_price', label: 'Unit Price', type: 'currency' },
    { key: 'total_price', label: 'Total Price', type: 'currency' },
  ],
  defaultSort: { column: 'issue_date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(po.created_at) as "issue_date",
        po.id::text as "order_id",
        po.admission_id as "ip_number",
        p.full_name as "patient_name",
        poi.medicine_name as "item_name",
        poi.batch_id as "batch",
        poi.quantity_dispensed as "quantity",
        poi.unit_price as "unit_price",
        poi.total_price as "total_price"
      FROM "pharmacy_order_items" poi
      JOIN "pharmacy_orders" po ON poi.order_id = po.id
      LEFT JOIN "OPD_REG" p ON po.patient_id = p.patient_id
      WHERE po."organizationId" = ${orgId}
        AND po.is_ipd_linked = true
        AND po.created_at >= ${new Date(date_start)}
        AND po.created_at <= ${new Date(date_end)}
      ORDER BY po.created_at DESC
    `;
    return { rows, totals: {} };
  },
};

export const pharmacyOpItemDetailReport: ReportDefinition = {
  id: 'pharmacy-op-item-detail',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - Pharmacy OP Item Detail',
  description: 'Detailed list of all pharmacy items sold to outpatients.',
  filters: defaultFilters,
  columns: [
    { key: 'issue_date', label: 'Sale Date', type: 'date' },
    { key: 'order_id', label: 'Order ID', type: 'string' },
    { key: 'patient_name', label: 'Patient Name', type: 'string' },
    { key: 'item_name', label: 'Item Name', type: 'string' },
    { key: 'batch', label: 'Batch', type: 'string' },
    { key: 'quantity', label: 'Quantity', type: 'number' },
    { key: 'unit_price', label: 'Unit Price', type: 'currency' },
    { key: 'total_price', label: 'Total Price', type: 'currency' },
  ],
  defaultSort: { column: 'issue_date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(po.created_at) as "issue_date",
        po.id::text as "order_id",
        p.full_name as "patient_name",
        poi.medicine_name as "item_name",
        poi.batch_id as "batch",
        poi.quantity_dispensed as "quantity",
        poi.unit_price as "unit_price",
        poi.total_price as "total_price"
      FROM "pharmacy_order_items" poi
      JOIN "pharmacy_orders" po ON poi.order_id = po.id
      LEFT JOIN "OPD_REG" p ON po.patient_id = p.patient_id
      WHERE po."organizationId" = ${orgId}
        AND po.is_ipd_linked = false
        AND po.created_at >= ${new Date(date_start)}
        AND po.created_at <= ${new Date(date_end)}
      ORDER BY po.created_at DESC
    `;
    return { rows, totals: {} };
  },
};

export const pharmacyOpSummaryDetailReport: ReportDefinition = {
  id: 'pharmacy-op-summary-detail',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - Pharmacy OP Summary Detail',
  description: 'Summary of all outpatient pharmacy orders.',
  filters: defaultFilters,
  columns: [
    { key: 'issue_date', label: 'Sale Date', type: 'date' },
    { key: 'order_id', label: 'Order ID', type: 'string' },
    { key: 'patient_name', label: 'Patient Name', type: 'string' },
    { key: 'doctor_name', label: 'Doctor', type: 'string' },
    { key: 'status', label: 'Status', type: 'string' },
    { key: 'items_dispensed', label: 'Items Dispensed', type: 'number' },
    { key: 'total_amount', label: 'Total Amount', type: 'currency' },
  ],
  defaultSort: { column: 'issue_date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(po.created_at) as "issue_date",
        po.id::text as "order_id",
        p.full_name as "patient_name",
        COALESCE(doc.name, 'Unassigned') as "doctor_name",
        po.status as "status",
        po.total_amount as "total_amount",
        po.items_dispensed as "items_dispensed"
      FROM "pharmacy_orders" po
      LEFT JOIN "OPD_REG" p ON po.patient_id = p.patient_id
      LEFT JOIN "users" doc ON po.doctor_id = doc.id
      WHERE po."organizationId" = ${orgId}
        AND po.is_ipd_linked = false
        AND po.created_at >= ${new Date(date_start)}
        AND po.created_at <= ${new Date(date_end)}
      ORDER BY po.created_at DESC
    `;
    return { rows, totals: {} };
  },
};

export const pharmacyIpDailyReport: ReportDefinition = {
  id: 'pharmacy-ip-daily',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - Pharmacy IP Daily',
  description: 'Daily aggregated summary of inpatient pharmacy issues.',
  filters: defaultFilters,
  columns: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'total_orders', label: 'Total Orders', type: 'number' },
    { key: 'total_items_dispensed', label: 'Items Dispensed', type: 'number' },
    { key: 'total_amount', label: 'Total Amount', type: 'currency' },
  ],
  defaultSort: { column: 'date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(po.created_at) as "date",
        COUNT(po.id) as "total_orders",
        SUM(po.total_amount) as "total_amount",
        SUM(po.items_dispensed) as "total_items_dispensed"
      FROM "pharmacy_orders" po
      WHERE po."organizationId" = ${orgId}
        AND po.is_ipd_linked = true
        AND po.created_at >= ${new Date(date_start)}
        AND po.created_at <= ${new Date(date_end)}
      GROUP BY DATE(po.created_at)
      ORDER BY DATE(po.created_at) DESC
    `;
    return { 
      rows: rows.map(r => ({
        ...r,
        total_orders: Number(r.total_orders || 0),
        total_items_dispensed: Number(r.total_items_dispensed || 0),
      })), 
      totals: {} 
    };
  },
};

// ─── Batch 14: Pharmacy — Returns, Taxes & Tags (SN 51–56) ─────────────

export const pharmacyDailyIpReturnReport: ReportDefinition = {
  id: 'pharmacy-daily-ip-return',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - Daily IP Return',
  description: 'Daily aggregate of pharmacy items returned by inpatients.',
  filters: defaultFilters,
  columns: [
    { key: 'return_date', label: 'Return Date', type: 'date' },
    { key: 'total_returns', label: 'Total Return Orders', type: 'number' },
    { key: 'total_items_returned', label: 'Total Items Returned', type: 'number' },
    { key: 'total_return_value', label: 'Total Return Value', type: 'currency' },
  ],
  defaultSort: { column: 'return_date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(pr.created_at) as "return_date",
        COUNT(pr.id) as "total_returns",
        SUM(pr.quantity) as "total_items_returned",
        SUM(pr.quantity * COALESCE(pr.unit_cost, 0)) as "total_return_value"
      FROM "pharmacy_returns" pr
      LEFT JOIN "invoices" inv ON pr.original_invoice_id = inv.id
      WHERE pr."organizationId" = ${orgId}
        AND pr.return_type = 'patient_return'
        AND (inv.admission_id IS NOT NULL OR inv.invoice_type = 'IPD')
        AND pr.created_at >= ${new Date(date_start)}
        AND pr.created_at <= ${new Date(date_end)}
      GROUP BY DATE(pr.created_at)
      ORDER BY DATE(pr.created_at) DESC
    `;
    return { 
      rows: rows.map(r => ({
        ...r,
        total_returns: Number(r.total_returns || 0),
        total_items_returned: Number(r.total_items_returned || 0),
        total_return_value: Number(r.total_return_value || 0),
      })), 
      totals: {} 
    };
  },
};

export const pharmacyDailyIpIssueReport: ReportDefinition = {
  id: 'pharmacy-daily-ip-issue',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - Daily IP Issue',
  description: 'Daily detail of pharmacy items issued to inpatients grouped by patient.',
  filters: defaultFilters,
  columns: [
    { key: 'issue_date', label: 'Issue Date', type: 'date' },
    { key: 'ip_number', label: 'IP Number', type: 'string' },
    { key: 'patient_name', label: 'Patient Name', type: 'string' },
    { key: 'items_count', label: 'Unique Items', type: 'number' },
    { key: 'total_quantity', label: 'Total Quantity', type: 'number' },
    { key: 'total_amount', label: 'Total Amount', type: 'currency' },
  ],
  defaultSort: { column: 'issue_date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(po.created_at) as "issue_date",
        po.admission_id as "ip_number",
        p.full_name as "patient_name",
        COUNT(poi.id) as "items_count",
        SUM(poi.quantity_dispensed) as "total_quantity",
        SUM(poi.total_price) as "total_amount"
      FROM "pharmacy_orders" po
      LEFT JOIN "pharmacy_order_items" poi ON po.id = poi.order_id
      LEFT JOIN "OPD_REG" p ON po.patient_id = p.patient_id
      WHERE po."organizationId" = ${orgId}
        AND po.is_ipd_linked = true
        AND po.created_at >= ${new Date(date_start)}
        AND po.created_at <= ${new Date(date_end)}
      GROUP BY DATE(po.created_at), po.admission_id, p.full_name
      ORDER BY DATE(po.created_at) DESC
    `;
    return { 
      rows: rows.map(r => ({
        ...r,
        items_count: Number(r.items_count || 0),
        total_quantity: Number(r.total_quantity || 0),
        total_amount: Number(r.total_amount || 0),
      })), 
      totals: {} 
    };
  },
};

export const pharmacyOpTaxSummaryReport: ReportDefinition = {
  id: 'pharmacy-op-tax-summary',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - OP Tax Summary',
  description: 'Daily tax aggregated summary for outpatient pharmacy sales.',
  filters: defaultFilters,
  columns: [
    { key: 'sale_date', label: 'Sale Date', type: 'date' },
    { key: 'tax_rate', label: 'Tax Rate (%)', type: 'number' },
    { key: 'total_sales', label: 'Total Sales (Incl Tax)', type: 'currency' },
    { key: 'total_tax', label: 'Total Tax Amount', type: 'currency' },
  ],
  defaultSort: { column: 'sale_date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(po.created_at) as "sale_date",
        poi.tax_rate as "tax_rate",
        SUM(poi.total_price) as "total_sales",
        SUM(poi.tax_amount) as "total_tax"
      FROM "pharmacy_order_items" poi
      JOIN "pharmacy_orders" po ON poi.order_id = po.id
      WHERE po."organizationId" = ${orgId}
        AND po.is_ipd_linked = false
        AND po.created_at >= ${new Date(date_start)}
        AND po.created_at <= ${new Date(date_end)}
      GROUP BY DATE(po.created_at), poi.tax_rate
      ORDER BY DATE(po.created_at) DESC
    `;
    return { 
      rows: rows.map(r => ({
        ...r,
        total_sales: Number(r.total_sales || 0),
        total_tax: Number(r.total_tax || 0),
      })), 
      totals: {} 
    };
  },
};

export const pharmacyOpTaxDetailsReport: ReportDefinition = {
  id: 'pharmacy-op-tax-details',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - OP Tax Details',
  description: 'Detailed tax breakdown for outpatient pharmacy sales.',
  filters: defaultFilters,
  columns: [
    { key: 'sale_date', label: 'Sale Date', type: 'date' },
    { key: 'order_id', label: 'Order ID', type: 'string' },
    { key: 'patient_name', label: 'Patient Name', type: 'string' },
    { key: 'item_name', label: 'Item Name', type: 'string' },
    { key: 'tax_rate', label: 'Tax Rate (%)', type: 'number' },
    { key: 'tax_amount', label: 'Tax Amount', type: 'currency' },
    { key: 'item_total', label: 'Item Total', type: 'currency' },
  ],
  defaultSort: { column: 'sale_date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(po.created_at) as "sale_date",
        po.id::text as "order_id",
        p.full_name as "patient_name",
        poi.medicine_name as "item_name",
        poi.total_price as "item_total",
        poi.tax_rate as "tax_rate",
        poi.tax_amount as "tax_amount"
      FROM "pharmacy_order_items" poi
      JOIN "pharmacy_orders" po ON poi.order_id = po.id
      LEFT JOIN "OPD_REG" p ON po.patient_id = p.patient_id
      WHERE po."organizationId" = ${orgId}
        AND po.is_ipd_linked = false
        AND po.created_at >= ${new Date(date_start)}
        AND po.created_at <= ${new Date(date_end)}
      ORDER BY po.created_at DESC
    `;
    return { rows, totals: {} };
  },
};

export const pharmacyIpIssueWithTagsReport: ReportDefinition = {
  id: 'pharmacy-ip-issue-with-tags',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - IP Issue with Tags',
  description: 'Pharmacy issues to inpatients along with patient engagement tags.',
  filters: defaultFilters,
  columns: [
    { key: 'issue_date', label: 'Issue Date', type: 'date' },
    { key: 'order_id', label: 'Order ID', type: 'string' },
    { key: 'ip_number', label: 'IP Number', type: 'string' },
    { key: 'patient_name', label: 'Patient Name', type: 'string' },
    { key: 'tags', label: 'Patient Tags', type: 'string' },
    { key: 'total_amount', label: 'Total Amount', type: 'currency' },
  ],
  defaultSort: { column: 'issue_date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(po.created_at) as "issue_date",
        po.id::text as "order_id",
        po.admission_id as "ip_number",
        p.full_name as "patient_name",
        pe.tags as "tags",
        po.total_amount as "total_amount"
      FROM "pharmacy_orders" po
      LEFT JOIN "OPD_REG" p ON po.patient_id = p.patient_id
      LEFT JOIN "PatientEngagement" pe ON po.patient_id = pe.patient_id AND po."organizationId" = pe."organizationId"
      WHERE po."organizationId" = ${orgId}
        AND po.is_ipd_linked = true
        AND po.created_at >= ${new Date(date_start)}
        AND po.created_at <= ${new Date(date_end)}
      ORDER BY po.created_at DESC
    `;
    return { 
      rows: rows.map(r => ({
        ...r,
        tags: r.tags ? JSON.stringify(r.tags) : '',
      })), 
      totals: {} 
    };
  },
};

export const pharmacyOpSaleWithTagsReport: ReportDefinition = {
  id: 'pharmacy-op-sale-with-tags',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - OP Sale with Tags',
  description: 'Outpatient pharmacy sales along with patient engagement tags.',
  filters: defaultFilters,
  columns: [
    { key: 'sale_date', label: 'Sale Date', type: 'date' },
    { key: 'order_id', label: 'Order ID', type: 'string' },
    { key: 'patient_name', label: 'Patient Name', type: 'string' },
    { key: 'tags', label: 'Patient Tags', type: 'string' },
    { key: 'total_amount', label: 'Total Amount', type: 'currency' },
  ],
  defaultSort: { column: 'sale_date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(po.created_at) as "sale_date",
        po.id::text as "order_id",
        p.full_name as "patient_name",
        pe.tags as "tags",
        po.total_amount as "total_amount"
      FROM "pharmacy_orders" po
      LEFT JOIN "OPD_REG" p ON po.patient_id = p.patient_id
      LEFT JOIN "PatientEngagement" pe ON po.patient_id = pe.patient_id AND po."organizationId" = pe."organizationId"
      WHERE po."organizationId" = ${orgId}
        AND po.is_ipd_linked = false
        AND po.created_at >= ${new Date(date_start)}
        AND po.created_at <= ${new Date(date_end)}
      ORDER BY po.created_at DESC
    `;
    return { 
      rows: rows.map(r => ({
        ...r,
        tags: r.tags ? JSON.stringify(r.tags) : '',
      })), 
      totals: {} 
    };
  },
};

// ─── Batch 15: Pharmacy — Reorders, Suppliers & Stock (SN 57–60) ────────

export const pharmacyItemReorderLevelReport: ReportDefinition = {
  id: 'pharmacy-item-reorder-level',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - Item Reorder Level',
  description: 'List of pharmacy items that have fallen to or below their minimum stock threshold.',
  filters: defaultFilters,
  columns: [
    { key: 'medicine_id', label: 'Item ID', type: 'string' },
    { key: 'brand_name', label: 'Brand Name', type: 'string' },
    { key: 'category', label: 'Category', type: 'string' },
    { key: 'reorder_level', label: 'Min Threshold', type: 'number' },
    { key: 'current_stock', label: 'Current Stock', type: 'number' },
    { key: 'manufacturer', label: 'Manufacturer', type: 'string' },
  ],
  defaultSort: { column: 'current_stock', direction: 'asc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        m.id::text as "medicine_id",
        m.brand_name as "brand_name",
        m.category as "category",
        m.min_threshold as "reorder_level",
        COALESCE(SUM(b.current_stock), 0) as "current_stock",
        m.manufacturer as "manufacturer"
      FROM "pharmacy_medicine_master" m
      LEFT JOIN "pharmacy_batch_inventory" b ON m.id = b.medicine_id
      WHERE m."organizationId" = ${orgId}
      GROUP BY m.id, m.brand_name, m.category, m.min_threshold, m.manufacturer
      HAVING COALESCE(SUM(b.current_stock), 0) <= m.min_threshold
      ORDER BY "current_stock" ASC
    `;
    return { 
      rows: rows.map(r => ({
        ...r,
        reorder_level: Number(r.reorder_level || 0),
        current_stock: Number(r.current_stock || 0),
      })), 
      totals: {} 
    };
  },
};

export const pharmacySupplierListReport: ReportDefinition = {
  id: 'pharmacy-supplier-list',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - Supplier List',
  description: 'Master list of active pharmacy suppliers/vendors.',
  filters: defaultFilters,
  columns: [
    { key: 'vendor_id', label: 'Vendor ID', type: 'string' },
    { key: 'vendor_name', label: 'Vendor Name', type: 'string' },
    { key: 'vendor_code', label: 'Vendor Code', type: 'string' },
    { key: 'contact_person', label: 'Contact Person', type: 'string' },
    { key: 'phone', label: 'Phone', type: 'string' },
    { key: 'email', label: 'Email', type: 'string' },
    { key: 'gst_number', label: 'GST Number', type: 'string' },
  ],
  defaultSort: { column: 'vendor_name', direction: 'asc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        v.id::text as "vendor_id",
        v.vendor_name as "vendor_name",
        v.vendor_code as "vendor_code",
        v.contact_person as "contact_person",
        v.phone as "phone",
        v.email as "email",
        v.gst_number as "gst_number"
      FROM "vendors" v
      WHERE v."organizationId" = ${orgId}
        AND v.is_active = true
        AND v.is_pharmacy_supplier = true
      ORDER BY v.vendor_name ASC
    `;
    return { rows, totals: {} };
  },
};

export const pharmacyCurrentStockReport: ReportDefinition = {
  id: 'pharmacy-current-stock',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - Current Stock',
  description: 'Detailed list of available pharmacy stock batches.',
  filters: defaultFilters,
  columns: [
    { key: 'brand_name', label: 'Brand Name', type: 'string' },
    { key: 'category', label: 'Category', type: 'string' },
    { key: 'batch_no', label: 'Batch No.', type: 'string' },
    { key: 'current_stock', label: 'Current Stock', type: 'number' },
    { key: 'mrp', label: 'MRP', type: 'currency' },
    { key: 'actual_cost', label: 'Actual Cost', type: 'currency' },
    { key: 'expiry_date', label: 'Expiry Date', type: 'date' },
    { key: 'stock_value', label: 'Total Value', type: 'currency' },
  ],
  defaultSort: { column: 'brand_name', direction: 'asc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        m.brand_name as "brand_name",
        m.category as "category",
        b.batch_no as "batch_no",
        b.current_stock as "current_stock",
        b.mrp as "mrp",
        b.actual_cost as "actual_cost",
        DATE(b.expiry_date) as "expiry_date",
        (b.current_stock * COALESCE(b.actual_cost, 0)) as "stock_value"
      FROM "pharmacy_batch_inventory" b
      JOIN "pharmacy_medicine_master" m ON b.medicine_id = m.id
      WHERE m."organizationId" = ${orgId}
        AND b.current_stock > 0
      ORDER BY m.brand_name ASC, b.expiry_date ASC
    `;
    return { 
      rows: rows.map(r => ({
        ...r,
        current_stock: Number(r.current_stock || 0),
        stock_value: Number(r.stock_value || 0),
      })), 
      totals: {} 
    };
  },
};

export const pharmacyExpiryReport: ReportDefinition = {
  id: 'pharmacy-expiry-report',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - Expiry Report',
  description: 'List of pharmacy stock sorted by expiration date to track soon-to-expire or expired items.',
  filters: defaultFilters,
  columns: [
    { key: 'brand_name', label: 'Brand Name', type: 'string' },
    { key: 'batch_no', label: 'Batch No.', type: 'string' },
    { key: 'current_stock', label: 'Current Stock', type: 'number' },
    { key: 'expiry_date', label: 'Expiry Date', type: 'date' },
    { key: 'supplier_name', label: 'Supplier Name', type: 'string' },
    { key: 'is_expired', label: 'Is Expired', type: 'string' },
  ],
  defaultSort: { column: 'expiry_date', direction: 'asc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        m.brand_name as "brand_name",
        b.batch_no as "batch_no",
        b.current_stock as "current_stock",
        DATE(b.expiry_date) as "expiry_date",
        b.supplier_name as "supplier_name",
        (b.expiry_date < NOW()) as "is_expired"
      FROM "pharmacy_batch_inventory" b
      JOIN "pharmacy_medicine_master" m ON b.medicine_id = m.id
      WHERE m."organizationId" = ${orgId}
        AND b.current_stock > 0
      ORDER BY b.expiry_date ASC
    `;
    return { 
      rows: rows.map(r => ({
        ...r,
        current_stock: Number(r.current_stock || 0),
      })), 
      totals: {} 
    };
  },
};

// ─── Batch 16: Pharmacy — Doctor Wise & Pull Off (SN 61–63) ──────────────

export const pharmacyDoctorWiseSaleReport: ReportDefinition = {
  id: 'pharmacy-doctor-wise-sale',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - Doctor Wise Sale',
  description: 'Aggregated pharmacy sales tracking dispensing linked to individual doctors.',
  filters: defaultFilters,
  columns: [
    { key: 'sale_date', label: 'Sale Date', type: 'date' },
    { key: 'doctor_name', label: 'Doctor Name', type: 'string' },
    { key: 'total_orders', label: 'Total Orders', type: 'number' },
    { key: 'items_dispensed', label: 'Items Dispensed', type: 'number' },
    { key: 'total_amount', label: 'Total Amount', type: 'currency' },
  ],
  defaultSort: { column: 'sale_date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(po.created_at) as "sale_date",
        COALESCE(doc.name, 'Unassigned') as "doctor_name",
        COUNT(po.id) as "total_orders",
        SUM(po.items_dispensed) as "items_dispensed",
        SUM(po.total_amount) as "total_amount"
      FROM "pharmacy_orders" po
      LEFT JOIN "users" doc ON po.doctor_id = doc.id
      WHERE po."organizationId" = ${orgId}
        AND po.created_at >= ${new Date(date_start)}
        AND po.created_at <= ${new Date(date_end)}
      GROUP BY DATE(po.created_at), doc.name
      ORDER BY DATE(po.created_at) DESC, doc.name ASC
    `;
    return { 
      rows: rows.map(r => ({
        ...r,
        total_orders: Number(r.total_orders || 0),
        items_dispensed: Number(r.items_dispensed || 0),
        total_amount: Number(r.total_amount || 0),
      })), 
      totals: {} 
    };
  },
};

export const pharmacyPatientPullOffReport: ReportDefinition = {
  id: 'pharmacy-patient-pull-off',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - Patient Pull Off',
  description: 'Log of pharmacy items withdrawn (dispensed) and tracked to patients.',
  filters: defaultFilters,
  columns: [
    { key: 'pull_date', label: 'Date', type: 'date' },
    { key: 'patient_name', label: 'Patient Name', type: 'string' },
    { key: 'item_name', label: 'Item Name', type: 'string' },
    { key: 'quantity', label: 'Quantity Dispensed', type: 'number' },
    { key: 'amount', label: 'Amount', type: 'currency' },
  ],
  defaultSort: { column: 'pull_date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(po.created_at) as "pull_date",
        p.full_name as "patient_name",
        poi.medicine_name as "item_name",
        poi.quantity_dispensed as "quantity",
        poi.total_price as "amount"
      FROM "pharmacy_order_items" poi
      JOIN "pharmacy_orders" po ON poi.order_id = po.id
      LEFT JOIN "OPD_REG" p ON po.patient_id = p.patient_id
      WHERE po."organizationId" = ${orgId}
        AND poi.quantity_dispensed > 0
        AND po.created_at >= ${new Date(date_start)}
        AND po.created_at <= ${new Date(date_end)}
      ORDER BY po.created_at DESC
    `;
    return { 
      rows: rows.map(r => ({
        ...r,
        quantity: Number(r.quantity || 0),
        amount: Number(r.amount || 0),
      })), 
      totals: {} 
    };
  },
};

export const pharmacyDoctorPullOffReport: ReportDefinition = {
  id: 'pharmacy-doctor-pull-off',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - Doctor Pull Off',
  description: 'Log of pharmacy items withdrawn (dispensed) and tracked to ordering doctors.',
  filters: defaultFilters,
  columns: [
    { key: 'pull_date', label: 'Date', type: 'date' },
    { key: 'doctor_name', label: 'Doctor Name', type: 'string' },
    { key: 'item_name', label: 'Item Name', type: 'string' },
    { key: 'quantity', label: 'Quantity Dispensed', type: 'number' },
    { key: 'amount', label: 'Amount', type: 'currency' },
  ],
  defaultSort: { column: 'pull_date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(po.created_at) as "pull_date",
        COALESCE(doc.name, 'Unassigned') as "doctor_name",
        poi.medicine_name as "item_name",
        poi.quantity_dispensed as "quantity",
        poi.total_price as "amount"
      FROM "pharmacy_order_items" poi
      JOIN "pharmacy_orders" po ON poi.order_id = po.id
      LEFT JOIN "users" doc ON po.doctor_id = doc.id
      WHERE po."organizationId" = ${orgId}
        AND poi.quantity_dispensed > 0
        AND po.created_at >= ${new Date(date_start)}
        AND po.created_at <= ${new Date(date_end)}
      ORDER BY po.created_at DESC
    `;
    return { 
      rows: rows.map(r => ({
        ...r,
        quantity: Number(r.quantity || 0),
        amount: Number(r.amount || 0),
      })), 
      totals: {} 
    };
  },
};

export const pharmacyIpPullOffReport: ReportDefinition = {
  id: 'pharmacy-ip-pull-off',
  category: ReportCategory.Pharmacy,
  name: 'Pharmacy - IP Pharmacy Pull Off Report',
  description: 'Log of pharmacy items withdrawn (dispensed) strictly for inpatients.',
  filters: defaultFilters,
  columns: [
    { key: 'pull_date', label: 'Date', type: 'date' },
    { key: 'ip_number', label: 'IP Number', type: 'string' },
    { key: 'patient_name', label: 'Patient Name', type: 'string' },
    { key: 'item_name', label: 'Item Name', type: 'string' },
    { key: 'quantity', label: 'Quantity Dispensed', type: 'number' },
    { key: 'amount', label: 'Amount', type: 'currency' },
  ],
  defaultSort: { column: 'pull_date', direction: 'desc' },
  rowLimitSync: 5000,
  requiredPermission: 'mis_reports.pharmacy.view',
  queryFn: async (filters: ValidatedFilters, orgId: string) => {
    const { date_start, date_end } = filters;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(po.created_at) as "pull_date",
        po.admission_id as "ip_number",
        p.full_name as "patient_name",
        poi.medicine_name as "item_name",
        poi.quantity_dispensed as "quantity",
        poi.total_price as "amount"
      FROM "pharmacy_order_items" poi
      JOIN "pharmacy_orders" po ON poi.order_id = po.id
      LEFT JOIN "OPD_REG" p ON po.patient_id = p.patient_id
      WHERE po."organizationId" = ${orgId}
        AND po.is_ipd_linked = true
        AND poi.quantity_dispensed > 0
        AND po.created_at >= ${new Date(date_start)}
        AND po.created_at <= ${new Date(date_end)}
      ORDER BY po.created_at DESC
    `;
    return { 
      rows: rows.map(r => ({
        ...r,
        quantity: Number(r.quantity || 0),
        amount: Number(r.amount || 0),
      })), 
      totals: {} 
    };
  },
};
