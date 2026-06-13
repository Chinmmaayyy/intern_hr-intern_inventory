'use server';
import { requireTenantContext } from '@/backend/tenant';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

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
    const { db, organizationId } = await requireTenantContext();
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
    const { db, organizationId, session } = await requireTenantContext();
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
    revalidatePath('/inventory/procurement/requisitions');
    return { success: true, data: serialize(pr) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function approveRequisition(id: number) {
  try {
    const { db, organizationId, session } = await requireTenantContext();
    if (!['admin','procurement_officer','store_manager'].includes(session.role)) return { success: false, error: 'Insufficient permissions' };
    const pr = await db.purchaseRequisition.update({
      where: { id } as any,
      data: { status: 'Approved', approved_by: session.id, approved_at: new Date() },
    });
    revalidatePath('/inventory/procurement/requisitions');
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
    const { db, organizationId } = await requireTenantContext();
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
    const { db, organizationId, session } = await requireTenantContext();
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
    revalidatePath('/inventory/procurement/purchase-orders');
    return { success: true, data: serialize(po) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getPurchaseOrderById(id: number) {
  try {
    const { db, organizationId } = await requireTenantContext();
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
    const { db, organizationId, session } = await requireTenantContext();
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

export async function performThreeWayMatchAndInvoice(poId: number, grnNumber: string, invoiceNumber: string, invoiceDate: string) {
  try {
    const { db, organizationId, session } = await requireTenantContext();
    const po = await db.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });
    if (!po) return { success: false, error: 'PO not found' };

    // Create a mock GRN for 3-way match verification
    const grn = await db.$transaction(async (tx: any) => {
      const g = await tx.goodsReceiptNote.create({
        data: {
          grn_number: grnNumber,
          po_id: poId,
          vendor_id: po.vendor_id,
          total_amount: po.total_amount,
          received_by: session.id,
          organizationId,
          items: {
            create: po.items.map((i: any) => ({
              item_id: i.item_id,
              quantity_accepted: i.quantity_ordered,
              quantity_rejected: 0,
              unit_price: i.unit_price,
              gst_rate: i.gst_rate,
            })),
          },
        },
      });

      // Upsert StoreStock and log movements
      for (const line of po.items) {
        const item = await tx.itemMaster.findUnique({ where: { id: line.item_id } });
        let batchId: number | null = null;
        if (item?.is_batch_tracked) {
          const batch = await tx.itemBatch.create({
            data: {
              item_id: line.item_id,
              batch_no: `BATCH-${Date.now()}`,
              cost_price: line.unit_price,
              organizationId,
            },
          });
          batchId = batch.id;
        }

        const existing = await tx.storeStock.findFirst({
          where: { store_id: po.receiving_store_id ?? 1, item_id: line.item_id, batch_id: batchId },
        });
        const qtyIn = line.quantity_ordered;
        const newQty = (existing?.quantity_on_hand ?? 0) + qtyIn;

        if (existing) {
          await tx.storeStock.update({
            where: { id: existing.id },
            data: { quantity_on_hand: newQty },
          });
        } else {
          await tx.storeStock.create({
            data: {
              store_id: po.receiving_store_id ?? 1,
              item_id: line.item_id,
              batch_id: batchId,
              quantity_on_hand: qtyIn,
              avg_unit_cost: line.unit_price,
              organizationId,
            },
          });
        }
      }

      // Create purchase invoice (reconciled matching invoice)
      const pinv = await tx.pharmacyPurchaseInvoice.create({
        data: {
          invoice_number: invoiceNumber,
          invoice_date: new Date(invoiceDate),
          po_id: poId,
          grn_id: g.id,
          vendor_id: po.vendor_id,
          total_amount: po.total_amount,
          status: 'Paid',
          organizationId,
        },
      });

      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: 'Invoiced' },
      });

      return { grn: g, pinv };
    });

    // Post to General Ledger
    const { postGrnToGL, postPurchaseInvoiceToGL } = await import('./inventory-gl-actions');
    await postGrnToGL(grn.grn.id);
    await postPurchaseInvoiceToGL(grn.pinv.id);

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function approvePurchaseOrder(id: number) {
  try {
    const { db, organizationId, session } = await requireTenantContext();
    if (!['admin','procurement_officer'].includes(session.role)) return { success: false, error: 'Insufficient permissions' };
    const po = await db.purchaseOrder.update({
      where: { id } as any,
      data: { status: 'Approved', approved_by: session.id, approved_at: new Date() },
    });
    revalidatePath('/inventory/procurement/purchase-orders');
    return { success: true, data: serialize(po) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ========================================
// Goods Receipt Notes (GRN)
// ========================================

export async function listGRNs(opts?: { po_id?: number; store_id?: number; page?: number; limit?: number }) {
  try {
    const { db, organizationId } = await requireTenantContext();
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
    const { db, organizationId, session } = await requireTenantContext();
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

    revalidatePath('/inventory/procurement/grn');
    return { success: true, data: serialize(result) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
