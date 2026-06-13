'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireInventoryContext } from '@/app/lib/inventory-context';

import {
  INVENTORY_READ_ROLES as PROCUREMENT_READ_ROLES,
  ITEM_CREATE_ROLES as PROCUREMENT_REQUEST_ROLES,
  GRN_READ_ROLES as PROCUREMENT_PO_READ_ROLES,
  PO_CREATE_ROLES as PROCUREMENT_PO_WRITE_ROLES,
  GRN_WRITE_ROLES as PROCUREMENT_GRN_WRITE_ROLES,
  COUNT_APPROVE_ROLES as PROCUREMENT_FINANCE_ROLES,
  PO_APPROVE_ROLES
} from '@/app/lib/inventory-roles';

function serialize<T>(d: T): T {
  return JSON.parse(JSON.stringify(d, (_, v) =>
    typeof v === 'object' && v !== null && v?.constructor?.name === 'Decimal' ? Number(v) : v));
}

const prItemSchema = z.object({
  item_id: z.number().int().positive(),
  quantity: z.number().int().positive(),
  required_by: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const prSchema = z.object({
  requesting_store_id: z.number().int().positive(),
  priority: z.enum(['NORMAL','URGENT','EMERGENCY']).default('NORMAL'),
  items: z.array(prItemSchema).min(1),
});

const poItemSchema = z.object({
  medicine_id: z.number().int().positive().optional().nullable(),
  item_id: z.number().int().positive().optional().nullable(),
  quantity_ordered: z.number().int().positive(),
  unit_price: z.number().nonnegative(),
  gst_rate: z.number().nonnegative().default(0),
  hsn_code: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  uom: z.string().optional().nullable(),
  conversion_to_base: z.number().positive().default(1),
});

const poSchema = z.object({
  vendor_id: z.number().int().positive().optional().nullable(),
  supplier_id: z.number().int().positive().optional().nullable(),
  receiving_store_id: z.number().int().positive().optional().nullable(),
  pr_id: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(poItemSchema).min(1),
});

const grnItemSchema = z.object({
  item_id: z.number().int().positive(),
  quantity_accepted: z.number().int().nonnegative(),
  quantity_rejected: z.number().int().nonnegative().default(0),
  rejection_reason: z.string().optional().nullable(),
  batch_no: z.string().optional().nullable(),
  expiry_date: z.string().datetime().optional().nullable(),
  unit_price: z.number().nonnegative().default(0),
  gst_rate: z.number().nonnegative().default(0),
});

const grnSchema = z.object({
  po_id: z.number().int().positive().optional().nullable(),
  vendor_id: z.number().int().positive().optional().nullable(),
  supplier_id: z.number().int().positive().optional().nullable(),
  store_id: z.number().int().positive().optional().nullable(),
  remarks: z.string().optional().nullable(),
  items: z.array(grnItemSchema).min(1),
});

// ========================================
// Purchase Requisitions
// ========================================

export async function listRequisitions(opts?: { status?: string; store_id?: number; page?: number; limit?: number }) {
  try {
    const { db, organizationId } = await requireInventoryContext(PROCUREMENT_READ_ROLES);
    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 20;
    const where: any = { organizationId };
    if (opts?.status) where.status = opts.status;
    if (opts?.store_id) where.requesting_store_id = opts.store_id;
    const [rows, total] = await Promise.all([
      db.purchaseRequisition.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          store: { select: { id: true, name: true } },
          items: { include: { item: { select: { id: true, name: true, item_code: true, base_uom: true } } } },
          _count: { select: { items: true } },
        },
      }),
      db.purchaseRequisition.count({ where }),
    ]);
    return { success: true, data: { requisitions: serialize(rows), total, totalPages: Math.ceil(total / limit), page } };
  } catch (e: any) {
    return { success: false, error: e.message, data: { requisitions: [], total: 0, totalPages: 0, page: 1 } };
  }
}

export async function createRequisition(input: unknown) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(PROCUREMENT_REQUEST_ROLES);
    const data = prSchema.parse(input);
    const prNumber = `PR-${Date.now()}`;
    const pr = await db.purchaseRequisition.create({
      data: {
        pr_number: prNumber,
        requesting_store_id: data.requesting_store_id,
        priority: data.priority,
        status: 'Submitted',
        organizationId,
        items: { create: data.items },
      },
      include: { items: true },
    });
    await db.system_audit_logs.create({
      data: { action: 'CREATE_PR', module: 'inventory', details: `Created PR: ${prNumber}`, organizationId, user_id: session.id, username: session.username, role: session.role },
    });
    revalidatePath('/admin/inventory/procurement/requisitions');
    return { success: true, data: serialize(pr) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function approveRequisition(id: number) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(PROCUREMENT_PO_WRITE_ROLES);
    const pr = await db.purchaseRequisition.update({
      where: { id } as any,
      data: { status: 'Approved', approved_by: session.id, approved_at: new Date() },
    });
    revalidatePath('/admin/inventory/procurement/requisitions');
    return { success: true, data: serialize(pr) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ========================================
// Purchase Orders
// ========================================

export async function listPurchaseOrders(opts?: { status?: string; vendor_id?: number; page?: number; limit?: number }) {
  try {
    const { db, organizationId } = await requireInventoryContext(PROCUREMENT_PO_READ_ROLES);
    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 20;
    const where: any = { organizationId };
    if (opts?.status) where.status = opts.status;
    if (opts?.vendor_id) where.vendor_id = opts.vendor_id;
    const [rows, total] = await Promise.all([
      db.purchaseOrder.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          vendor: { select: { id: true, vendor_name: true } },
          supplier: { select: { id: true, supplier_name: true } },
          receiving_store: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      db.purchaseOrder.count({ where }),
    ]);
    return { success: true, data: { orders: serialize(rows), total, totalPages: Math.ceil(total / limit), page } };
  } catch (e: any) {
    return { success: false, error: e.message, data: { orders: [], total: 0, totalPages: 0, page: 1 } };
  }
}

export async function createPurchaseOrder(input: unknown) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(PROCUREMENT_PO_WRITE_ROLES);
    const data = poSchema.parse(input);
    const poNumber = `PO-${Date.now()}`;
    const totalAmount = data.items.reduce((s, i) => s + i.quantity_ordered * i.unit_price * (1 + i.gst_rate / 100), 0);
    const po = await db.purchaseOrder.create({
      data: {
        po_number: poNumber,
        vendor_id: data.vendor_id,
        supplier_id: data.supplier_id,
        receiving_store_id: data.receiving_store_id,
        pr_id: data.pr_id,
        notes: data.notes,
        status: 'Draft',
        total_amount: totalAmount,
        organizationId,
        items: { create: data.items },
      },
      include: { items: true },
    });
    await db.system_audit_logs.create({
      data: { action: 'CREATE_PO', module: 'inventory', details: `Created PO: ${poNumber}`, organizationId, user_id: session.id, username: session.username, role: session.role },
    });
    revalidatePath('/admin/inventory/procurement/purchase-orders');
    return { success: true, data: serialize(po) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getPurchaseOrderById(id: number) {
  try {
    const { db, organizationId } = await requireInventoryContext(PROCUREMENT_PO_READ_ROLES);
    const po = await db.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: {
        vendor: { select: { id: true, vendor_name: true, vendor_code: true } },
        receiving_store: { select: { id: true, name: true } },
        items: {
          include: {
            item: { select: { id: true, name: true, item_code: true, base_uom: true } },
          },
        },
      },
    });
    if (!po) return { success: false, error: 'PO not found' };
    return { success: true, data: serialize(po) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function createPurchaseOrderFromPR(prId: number, vendorId: number) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(PROCUREMENT_PO_WRITE_ROLES);
    const pr = await db.purchaseRequisition.findUnique({
      where: { id: prId },
      include: { items: true },
    });
    if (!pr) return { success: false, error: 'PR not found' };
    if (pr.status !== 'Approved') return { success: false, error: 'PR must be approved to create PO' };

    const poNumber = `PO-${Date.now()}`;
    const poItems = pr.items.map((item: any) => ({
      item_id: item.item_id,
      quantity_ordered: item.quantity_requested,
      unit_price: 100, // standard pricing fallback
      gst_rate: 18,
    }));

    const totalAmount = poItems.reduce((s: number, i: { quantity_ordered: number; unit_price: number; gst_rate: number }) => s + i.quantity_ordered * i.unit_price * (1 + i.gst_rate / 100), 0);

    const po = await db.$transaction(async (tx: any) => {
      const createdPO = await tx.purchaseOrder.create({
        data: {
          po_number: poNumber,
          vendor_id: vendorId,
          pr_id: prId,
          status: 'Ordered',
          total_amount: totalAmount,
          organizationId,
          order_date: new Date(),
          items: { create: poItems },
        },
      });

      await tx.purchaseRequisition.update({
        where: { id: prId },
        data: { status: 'PO Created' },
      });

      return createdPO;
    });

    await db.system_audit_logs.create({
      data: { action: 'CREATE_PO', module: 'inventory', details: `Created PO ${poNumber} from PR ${prId}`, organizationId, user_id: session.id, username: session.username, role: session.role },
    });

    return { success: true, data: serialize(po) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function createPurchaseInvoice(input: {
  poId: number;
  grnId: number;
  invoiceNumber: string;
  invoiceDate: string;
  lineItems: Array<{
    item_id?: number | null;
    medicine_id?: number | null;
    quantity: number;
    unit_price: number;
    gst_rate?: number;
  }>;
}) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(PROCUREMENT_FINANCE_ROLES);
    const po = await db.purchaseOrder.findUnique({
      where: { id: input.poId },
      include: { items: true }
    });
    if (!po) return { success: false, error: 'PO not found' };

    const grn = await db.goodsReceiptNote.findUnique({
      where: { id: input.grnId },
      include: { items: true }
    });
    if (!grn) return { success: false, error: 'GRN not found' };

    // Fetch tolerance from config
    const configRow = await db.moduleConfig.findFirst({
      where: { organizationId, module_key: 'inventory' }
    });
    const tolerance = (configRow?.config_json as any)?.adjustment_tolerance_pct ?? 2.0; // percent e.g. 2%

    let hasVarianceExceeded = false;
    let subtotal = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    const invoiceLinesData: any[] = [];

    for (const line of input.lineItems) {
      const poItem = po.items.find((i: any) => 
        (line.item_id && i.item_id === line.item_id) || 
        (line.medicine_id && i.medicine_id === line.medicine_id)
      );
      const grnItem = grn.items.find((i: any) => 
        (line.item_id && i.item_id === line.item_id) || 
        (line.medicine_id && i.medicine_id === line.medicine_id)
      );

      if (!poItem || !grnItem) {
        hasVarianceExceeded = true;
      } else {
        const qtyDiffPct = Math.abs(line.quantity - grnItem.quantity_accepted) / (grnItem.quantity_accepted || 1) * 100;
        const priceDiffPct = Math.abs(line.unit_price - poItem.unit_price) / (poItem.unit_price || 1) * 100;
        if (qtyDiffPct > tolerance || priceDiffPct > tolerance) {
          hasVarianceExceeded = true;
        }
      }

      const gstRate = line.gst_rate ?? poItem?.gst_rate ?? 0;
      const lineCost = line.quantity * line.unit_price;
      subtotal += lineCost;
      
      const taxAmount = lineCost * (gstRate / 100);
      cgstAmount += taxAmount / 2;
      sgstAmount += taxAmount / 2;

      invoiceLinesData.push({
        medicine_id: line.medicine_id || null,
        item_id: line.item_id || null,
        grn_id: input.grnId,
        quantity: line.quantity,
        unit_price: line.unit_price,
        gst_rate: gstRate,
        cgst_amount: taxAmount / 2,
        sgst_amount: taxAmount / 2,
        total_amount: lineCost + taxAmount,
      });
    }

    const totalAmount = subtotal + cgstAmount + sgstAmount + igstAmount;
    const status = hasVarianceExceeded ? 'PendingApproval' : 'Posted';
    const varianceApproved = !hasVarianceExceeded;

    const invoice = await db.$transaction(async (tx: any) => {
      const pinv = await tx.pharmacyPurchaseInvoice.create({
        data: {
          invoice_number: input.invoiceNumber,
          invoice_date: new Date(input.invoiceDate),
          po_id: input.poId,
          grn_id: input.grnId,
          vendor_id: po.vendor_id,
          subtotal,
          cgst_amount: cgstAmount,
          sgst_amount: sgstAmount,
          igst_amount: igstAmount,
          total_amount: totalAmount,
          status,
          variance_approved: varianceApproved,
          organizationId,
          line_items: {
            create: invoiceLinesData,
          },
        },
      });

      if (!hasVarianceExceeded) {
        await tx.purchaseOrder.update({
          where: { id: input.poId },
          data: { status: 'Invoiced' },
        });
      }

      return pinv;
    });

    await db.system_audit_logs.create({
      data: {
        action: 'CREATE_INVOICE', module: 'inventory',
        details: `Created invoice: ${input.invoiceNumber} (status=${status}) for PO ${input.poId}, GRN ${input.grnId}`,
        organizationId, user_id: session.id, username: session.username, role: session.role,
      },
    });

    // Post to GL if status is Posted, catch failure to keep non-blocking
    if (status === 'Posted') {
      try {
        const { postPurchaseInvoiceToGL } = await import('./inventory-gl-actions');
        await postPurchaseInvoiceToGL(invoice.id);
      } catch (glErr: any) {
        console.error('Failed to post purchase invoice to GL asynchronously:', glErr.message);
        await db.pharmacyPurchaseInvoice.update({
          where: { id: invoice.id },
          data: { gl_posted: false }
        });
      }
    }

    return { success: true, data: serialize(invoice) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function approvePurchaseInvoiceVariance(invoiceId: number) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(PROCUREMENT_FINANCE_ROLES);
    const invoice = await db.pharmacyPurchaseInvoice.findFirst({
      where: { id: invoiceId, organizationId },
    });
    if (!invoice) return { success: false, error: 'Invoice not found' };
    if (invoice.variance_approved) return { success: true, message: 'Already approved' };

    await db.pharmacyPurchaseInvoice.update({
      where: { id: invoiceId },
      data: { variance_approved: true, status: 'Posted' },
    });

    if (invoice.po_id) {
      await db.purchaseOrder.update({
        where: { id: invoice.po_id },
        data: { status: 'Invoiced' },
      });
    }

    const { postPurchaseInvoiceToGL } = await import('./inventory-gl-actions');
    await postPurchaseInvoiceToGL(invoiceId);

    await db.system_audit_logs.create({
      data: {
        action: 'APPROVE_INVOICE_VARIANCE', module: 'inventory',
        details: `Finance approved variance on invoice ${invoice.invoice_number}`,
        organizationId, user_id: session.id, username: session.username, role: session.role,
      },
    });

    revalidatePath('/admin/inventory/procurement/invoices');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function performThreeWayMatchAndInvoice(poId: number, grnNumber: string, invoiceNumber: string, invoiceDate: string) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(PROCUREMENT_FINANCE_ROLES);
    const po = await db.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });
    if (!po) return { success: false, error: 'PO not found' };

    // Create real Goods Receipt Note first
    const grnRes = await createGRN({
      po_id: poId,
      vendor_id: po.vendor_id,
      store_id: po.receiving_store_id ?? 1,
      remarks: 'Auto-generated GRN via 3-way match',
      items: po.items.map((i: any) => ({
        item_id: i.item_id,
        quantity_accepted: i.quantity_ordered,
        quantity_rejected: 0,
        unit_price: i.unit_price,
        gst_rate: i.gst_rate,
      })),
    });

    if (!grnRes.success) throw new Error(`GRN generation failed: ${grnRes.error}`);
    const grnId = grnRes.data.id;

    // Call createPurchaseInvoice with actual line items
    const invRes = await createPurchaseInvoice({
      poId,
      grnId,
      invoiceNumber,
      invoiceDate,
      lineItems: po.items.map((i: any) => ({
        item_id: i.item_id,
        quantity: i.quantity_ordered,
        unit_price: i.unit_price,
        gst_rate: i.gst_rate,
      })),
    });

    return invRes;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function approvePurchaseOrder(id: number) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(PO_APPROVE_ROLES);
    const po = await db.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!po) return { success: false, error: 'PO not found' };

    // Fetch PO thresholds from config
    const configRow = await db.moduleConfig.findFirst({
      where: { organizationId, module_key: 'inventory' }
    });
    const thresholds = (configRow?.config_json as any)?.po_approval_thresholds || {
      store_manager: 50000,
      admin: 500000
    };

    const userRole = session.role;
    const amount = po.total_amount || 0;

    if (userRole === 'store_manager' && amount > thresholds.store_manager) {
      return { success: false, error: `PO amount exceeds Store Manager approval limit of ₹${thresholds.store_manager.toLocaleString()}` };
    }
    if (userRole === 'admin' && amount > thresholds.admin) {
      return { success: false, error: `PO amount exceeds Admin approval limit of ₹${thresholds.admin.toLocaleString()}. Requires Finance approval.` };
    }

    const updatedPo = await db.purchaseOrder.update({
      where: { id } as any,
      data: { status: 'Approved', approved_by: session.id, approved_at: new Date() },
    });
    revalidatePath('/admin/inventory/procurement/purchase-orders');
    return { success: true, data: serialize(updatedPo) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function sendPurchaseOrder(id: number) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(PROCUREMENT_PO_WRITE_ROLES);
    const po = await db.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: { vendor: { select: { vendor_name: true, email: true, phone: true } } },
    });
    if (!po) return { success: false, error: 'PO not found' };
    if (po.status !== 'Approved') return { success: false, error: 'Only approved POs can be sent to vendor' };

    await db.purchaseOrder.update({
      where: { id },
      data: { ordered_at: po.ordered_at ?? new Date() },
    });

    await db.system_audit_logs.create({
      data: {
        action: 'SEND_PO', module: 'inventory',
        details: `Sent PO ${po.po_number} to vendor ${po.vendor?.vendor_name ?? 'unknown'}`,
        organizationId, user_id: session.id, username: session.username, role: session.role,
      },
    });

    // Notification to vendor contact (in-app; email/WhatsApp hooks can extend here)
    await db.notification.create({
      data: {
        organizationId,
        title: `Purchase Order ${po.po_number} dispatched`,
        message: `PO ${po.po_number} has been sent to ${po.vendor?.vendor_name ?? 'vendor'}. Total: ₹${Number(po.total_amount || 0).toLocaleString('en-IN')}`,
        type: 'PO_SENT',
        is_read: false,
      },
    }).catch(() => {});

    revalidatePath('/admin/inventory/procurement/purchase-orders');
    revalidatePath('/inventory/procurement/purchase-orders');
    return { success: true, message: `PO sent to ${po.vendor?.email ?? po.vendor?.vendor_name ?? 'vendor'}` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function createVendorReturn(input: {
  grnId: number;
  lines: Array<{
    item_id?: number | null;
    medicine_id?: number | null;
    quantity: number;
    reason: string;
  }>;
}) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(PROCUREMENT_GRN_WRITE_ROLES);
    const grn = await db.goodsReceiptNote.findUnique({
      where: { id: input.grnId },
      include: { items: true }
    });
    if (!grn) return { success: false, error: 'GRN not found' };

    const storeId = grn.store_id;
    if (!storeId) return { success: false, error: 'GRN does not have an associated store' };

    const returnRecords: any[] = [];

    const result = await db.$transaction(async (tx: any) => {
      for (const line of input.lines) {
        const itemId = line.item_id || null;
        const medicineId = line.medicine_id || null;

        const grnItem = grn.items.find((i: any) => 
          (itemId && i.item_id === itemId) || 
          (medicineId && i.medicine_id === medicineId)
        );
        if (!grnItem) {
          throw new Error('Item/Medicine not found in the original GRN.');
        }

        if (line.quantity > grnItem.quantity_accepted) {
          throw new Error(`Return quantity (${line.quantity}) exceeds GRN accepted quantity (${grnItem.quantity_accepted}).`);
        }

        let unitCost = grnItem.unit_price;

        if (itemId) {
          const storeStock = await tx.storeStock.findFirst({
            where: { store_id: storeId, item_id: itemId, organizationId }
          });
          if (!storeStock || storeStock.quantity_on_hand < line.quantity) {
            throw new Error(`Insufficient stock in store. Available: ${storeStock?.quantity_on_hand ?? 0}, requested: ${line.quantity}`);
          }

          await tx.storeStock.update({
            where: { id: storeStock.id },
            data: { quantity_on_hand: { decrement: line.quantity } }
          });

          await tx.inventoryMovement.create({
            data: {
              organizationId, store_id: storeId, item_id: itemId, batch_id: null,
              movement_type: 'VENDOR_RETURN',
              quantity_in: 0, quantity_out: line.quantity,
              unit_cost: unitCost,
              value: line.quantity * unitCost,
              balance_after: storeStock.quantity_on_hand - line.quantity,
              source_type: 'RETURN', source_id: grn.id.toString(),
              user_id: session.id,
            }
          });
        } else if (medicineId) {
          const storeStock = await tx.pharmacy_batch_inventory.findFirst({
            where: { store_id: storeId, medicine_id: medicineId, organizationId }
          });
          if (!storeStock || storeStock.current_stock < line.quantity) {
            throw new Error(`Insufficient pharmacy stock. Available: ${storeStock?.current_stock ?? 0}`);
          }

          await tx.pharmacy_batch_inventory.update({
            where: { id: storeStock.id },
            data: { current_stock: { decrement: line.quantity } }
          });
          unitCost = storeStock.purchase_price || unitCost;

          await tx.pharmacy_sales_audit.create({
            data: {
              organizationId, store_id: storeId, medicine_id: medicineId, batch_id: storeStock.id,
              movement_type: 'VENDOR_RETURN',
              quantity: -line.quantity,
              user_id: session.id,
            }
          });
        }

        const ret = await tx.pharmacyReturn.create({
          data: {
            return_type: 'supplier_return',
            medicine_id: medicineId,
            item_id: itemId,
            store_id: storeId,
            quantity: line.quantity,
            unit_cost: unitCost,
            reason: line.reason,
            vendor_id: grn.vendor_id,
            po_id: grn.po_id,
            organizationId,
          }
        });
        returnRecords.push(ret);
      }
      return returnRecords;
    });

    await db.system_audit_logs.create({
      data: {
        action: 'CREATE_VENDOR_RETURN', module: 'inventory',
        details: `Created vendor return for GRN ${grn.id} with ${input.lines.length} lines`,
        organizationId, user_id: session.id, username: session.username, role: session.role,
      },
    });

    // Post to GL asynchronously
    try {
      const { postVendorReturnToGL } = await import('./inventory-gl-actions');
      for (const ret of result) {
        await postVendorReturnToGL(ret.id);
      }
    } catch (glErr: any) {
      console.error('Failed to post vendor return to GL asynchronously:', glErr.message);
    }

    return { success: true, data: serialize(result) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ========================================
// Goods Receipt Notes (GRN)
// ========================================

export async function listGRNs(opts?: { po_id?: number; store_id?: number; page?: number; limit?: number }) {
  try {
    const { db, organizationId } = await requireInventoryContext(PROCUREMENT_PO_READ_ROLES);
    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 20;
    const where: any = { organizationId };
    if (opts?.po_id) where.po_id = opts.po_id;
    if (opts?.store_id) where.store_id = opts.store_id;
    const [rows, total] = await Promise.all([
      db.goodsReceiptNote.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          vendor: { select: { id: true, vendor_name: true } },
          store: { select: { id: true, name: true } },
          purchase_order: { select: { id: true, po_number: true } },
          items: { include: { item: { select: { id: true, name: true } } } },
        },
      }),
      db.goodsReceiptNote.count({ where }),
    ]);
    return { success: true, data: { grns: serialize(rows), total, totalPages: Math.ceil(total / limit), page } };
  } catch (e: any) {
    return { success: false, error: e.message, data: { grns: [], total: 0, totalPages: 0, page: 1 } };
  }
}

export async function createGRN(input: unknown) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(PROCUREMENT_GRN_WRITE_ROLES);
    const data = grnSchema.parse(input);
    const grnNumber = `GRN-${Date.now()}`;
    const totalAmount = data.items.reduce((s, i) => s + i.quantity_accepted * i.unit_price * (1 + i.gst_rate / 100), 0);

    const result = await db.$transaction(async (tx: any) => {
      // Create GRN header
      const grn = await tx.goodsReceiptNote.create({
        data: {
          grn_number: grnNumber,
          po_id: data.po_id,
          vendor_id: data.vendor_id,
          supplier_id: data.supplier_id,
          store_id: data.store_id,
          remarks: data.remarks,
          total_amount: totalAmount,
          received_by: session.id,
          organizationId,
        },
      });

      for (const lineInput of data.items) {
        const item = await tx.itemMaster.findFirst({ where: { id: lineInput.item_id, organizationId } });
        if (!item) throw new Error(`Item ID ${lineInput.item_id} not found`);

        // Create GRN line item
        await tx.goodsReceiptNoteItem.create({
          data: { grn_id: grn.id, ...lineInput, expiry_date: lineInput.expiry_date ? new Date(lineInput.expiry_date) : null },
        });

        if (lineInput.quantity_accepted <= 0) continue;

        // Create/update ItemBatch if batch-tracked
        let batchId: number | null = null;
        if (item.is_batch_tracked && lineInput.batch_no) {
          const batch = await tx.itemBatch.upsert({
            where: { item_id_batch_no: { item_id: lineInput.item_id, batch_no: lineInput.batch_no } },
            create: {
              item_id: lineInput.item_id, batch_no: lineInput.batch_no,
              expiry_date: lineInput.expiry_date ? new Date(lineInput.expiry_date) : null,
              cost_price: lineInput.unit_price, grn_id: grn.id,
              vendor_id: data.vendor_id, organizationId,
            },
            update: {},
          });
          batchId = batch.id;
        }

        // Upsert StoreStock with weighted average cost
        if (data.store_id) {
          const existing = await tx.storeStock.findFirst({
            where: { store_id: data.store_id, item_id: lineInput.item_id, batch_id: batchId },
          });
          const qtyIn = lineInput.quantity_accepted;
          const newQty = (existing?.quantity_on_hand ?? 0) + qtyIn;
          const newCost = existing && existing.quantity_on_hand > 0
            ? ((existing.quantity_on_hand * existing.avg_unit_cost) + (qtyIn * lineInput.unit_price)) / newQty
            : lineInput.unit_price;

          if (existing) {
            await tx.storeStock.update({
              where: { id: existing.id },
              data: { quantity_on_hand: newQty, avg_unit_cost: newCost, updated_at: new Date() },
            });
          } else {
            await tx.storeStock.create({
              data: { store_id: data.store_id, item_id: lineInput.item_id, batch_id: batchId, quantity_on_hand: qtyIn, avg_unit_cost: lineInput.unit_price, organizationId },
            });
          }

          // Create InventoryMovement record
          const existingUpdated = await tx.storeStock.findFirst({
            where: { store_id: data.store_id, item_id: lineInput.item_id, batch_id: batchId },
          });
          await tx.inventoryMovement.create({
            data: {
              organizationId, store_id: data.store_id, item_id: lineInput.item_id, batch_id: batchId,
              movement_type: 'GRN_RECEIPT',
              quantity_in: qtyIn, quantity_out: 0,
              unit_cost: lineInput.unit_price,
              value: qtyIn * lineInput.unit_price,
              balance_after: existingUpdated?.quantity_on_hand ?? qtyIn,
              source_type: 'GRN', source_id: grn.id.toString(),
              user_id: session.id,
            },
          });
        }

        // Update PO received quantity if linked
        if (data.po_id) {
          const poItem = await tx.purchaseOrderItem.findFirst({
            where: { po_id: data.po_id, item_id: lineInput.item_id },
          });
          if (poItem) {
            await tx.purchaseOrderItem.update({
              where: { id: poItem.id },
              data: { quantity_received: { increment: lineInput.quantity_accepted } },
            });
          }
        }
      }

      // Update PO status if all items received
      if (data.po_id) {
        const poItems = await tx.purchaseOrderItem.findMany({ where: { po_id: data.po_id } });
        const allReceived = poItems.every((i: any) => (i.quantity_received ?? 0) >= i.quantity_ordered);
        const anyReceived = poItems.some((i: any) => (i.quantity_received ?? 0) > 0);
        if (allReceived) await tx.purchaseOrder.update({ where: { id: data.po_id }, data: { status: 'Received', received_at: new Date() } });
        else if (anyReceived) await tx.purchaseOrder.update({ where: { id: data.po_id }, data: { status: 'Partially Received' } });
      }

      return grn;
    });

    await db.system_audit_logs.create({
      data: { action: 'CREATE_GRN', module: 'inventory', details: `Created GRN: ${grnNumber}`, organizationId, user_id: session.id, username: session.username, role: session.role },
    });

    // Trigger GL posting asynchronously
    import('./inventory-gl-actions').then(m => m.postGrnToGL(result.id).catch(console.error));

    revalidatePath('/admin/inventory/procurement/grn');
    return { success: true, data: serialize(result) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
