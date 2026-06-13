'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { postChargeToIpdBill } from '@/app/actions/ipd-finance-actions';
import { postConsumptionToGL, postAdjustmentToGL } from '@/app/actions/inventory-gl-actions';
import { requireInventoryContext } from '@/app/lib/inventory-context';

import {
  GRN_READ_ROLES as STOCK_READ_ROLES,
  GRN_WRITE_ROLES as STOCK_WRITE_ROLES,
  COUNT_APPROVE_ROLES as STOCK_APPROVE_ROLES,
  CONSUMPTION_ROLES as STOCK_CONSUMPTION_ROLES,
  WRITE_OFF_APPROVE_ROLES,
} from '@/app/lib/inventory-roles';

function serialize<T>(d: T): T {
  return JSON.parse(JSON.stringify(d, (_, v) =>
    typeof v === 'object' && v !== null && v?.constructor?.name === 'Decimal' ? Number(v) : v));
}

const transferItemSchema = z.object({
  item_id: z.number().int().positive(),
  batch_id: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().positive(),
  unit_cost: z.number().nonnegative().default(0),
});

const transferSchema = z.object({
  from_store_id: z.number().int().positive(),
  to_store_id: z.number().int().positive(),
  items: z.array(transferItemSchema).min(1),
});

// ========================================
// Stock Transfer
// ========================================

export async function listTransfers(opts?: { status?: string; page?: number; limit?: number }) {
  try {
    const { db, organizationId } = await requireInventoryContext(STOCK_READ_ROLES);
    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 20;
    const where: any = { organizationId };
    if (opts?.status) where.status = opts.status;
    const [rows, total] = await Promise.all([
      db.stockTransfer.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          from_store: { select: { id: true, name: true } },
          to_store: { select: { id: true, name: true } },
          items: { include: { item: { select: { name: true, item_code: true } }, batch: { select: { batch_no: true } } } },
        },
      }),
      db.stockTransfer.count({ where }),
    ]);
    return { success: true, data: { transfers: serialize(rows), total, totalPages: Math.ceil(total / limit), page } };
  } catch (e: any) {
    return { success: false, error: e.message, data: { transfers: [], total: 0, totalPages: 0, page: 1 } };
  }
}

export async function createStoreTransfer(input: unknown) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(STOCK_WRITE_ROLES);
    const data = transferSchema.parse(input);
    const transferNumber = `TRF-${Date.now()}`;

    const fromStore = await db.store.findFirst({ where: { id: data.from_store_id, organizationId } });
    const toStore = await db.store.findFirst({ where: { id: data.to_store_id, organizationId } });
    if (!fromStore || !toStore) return { success: false, error: 'Store not found' };
    const isInterBranch = fromStore.branch_id !== toStore.branch_id;

    const transfer = await db.$transaction(async (tx: any) => {
      const t = await tx.stockTransfer.create({
        data: {
          transfer_number: transferNumber,
          from_store_id: data.from_store_id,
          to_store_id: data.to_store_id,
          status: isInterBranch ? 'In Transit' : 'Received',
          dispatch_user_id: session.id,
          dispatch_at: new Date(),
          received_at: isInterBranch ? null : new Date(),
          organizationId,
          items: { create: data.items },
        },
        include: { items: true },
      });

      for (const line of data.items) {
        const srcStock = await tx.storeStock.findFirst({
          where: { store_id: data.from_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null, organizationId },
        });
        if (!srcStock || srcStock.quantity_on_hand < line.quantity) {
          throw new Error(`Insufficient stock in source store for item ID ${line.item_id}`);
        }
        const unitCost = line.unit_cost > 0 ? line.unit_cost : srcStock.avg_unit_cost;
        await tx.storeStock.update({
          where: { id: srcStock.id },
          data: { quantity_on_hand: { decrement: line.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            organizationId, store_id: data.from_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null,
            movement_type: 'TRANSFER_OUT',
            quantity_in: 0, quantity_out: line.quantity,
            unit_cost: unitCost, value: line.quantity * unitCost,
            balance_after: srcStock.quantity_on_hand - line.quantity,
            source_type: 'TRANSFER', source_id: t.id.toString(),
            user_id: session.id,
          },
        });

        if (!isInterBranch) {
          const dstStock = await tx.storeStock.findFirst({
            where: { store_id: data.to_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null },
          });
          const newDstQty = (dstStock?.quantity_on_hand ?? 0) + line.quantity;
          if (dstStock) {
            await tx.storeStock.update({
              where: { id: dstStock.id },
              data: { quantity_on_hand: newDstQty },
            });
          } else {
            await tx.storeStock.create({
              data: { store_id: data.to_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null, quantity_on_hand: line.quantity, avg_unit_cost: unitCost, organizationId },
            });
          }
          await tx.inventoryMovement.create({
            data: {
              organizationId, store_id: data.to_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null,
              movement_type: 'TRANSFER_IN',
              quantity_in: line.quantity, quantity_out: 0,
              unit_cost: unitCost, value: line.quantity * unitCost,
              balance_after: newDstQty,
              source_type: 'TRANSFER', source_id: t.id.toString(),
              user_id: session.id,
            },
          });
        }
      }
      return t;
    });

    revalidatePath('/admin/inventory/transfers');
    revalidatePath('/inventory/transfers');
    return { success: true, data: serialize(transfer) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function receiveTransfer(transfer_id: number) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(STOCK_WRITE_ROLES);
    const transfer = await db.stockTransfer.findFirst({
      where: { id: transfer_id, organizationId },
      include: { items: true, from_store: true, to_store: true },
    });
    if (!transfer) return { success: false, error: 'Transfer not found' };
    if (transfer.status !== 'In Transit') return { success: false, error: 'Transfer is not in transit' };

    await db.$transaction(async (tx: any) => {
      for (const line of transfer.items) {
        const issueMov = await tx.inventoryMovement.findFirst({
          where: {
            organizationId,
            store_id: transfer.from_store_id,
            item_id: line.item_id,
            movement_type: 'TRANSFER_OUT',
            source_type: 'TRANSFER',
            source_id: transfer.id.toString(),
          },
          orderBy: { created_at: 'desc' },
        });
        const unitCost = issueMov?.unit_cost ?? line.unit_cost ?? 0;

        const dstStock = await tx.storeStock.findFirst({
          where: { store_id: transfer.to_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null, organizationId },
        });
        const newDstQty = (dstStock?.quantity_on_hand ?? 0) + line.quantity;
        if (dstStock) {
          await tx.storeStock.update({ where: { id: dstStock.id }, data: { quantity_on_hand: newDstQty } });
        } else {
          await tx.storeStock.create({
            data: {
              store_id: transfer.to_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null,
              quantity_on_hand: line.quantity, avg_unit_cost: unitCost, organizationId,
            },
          });
        }
        await tx.inventoryMovement.create({
          data: {
            organizationId, store_id: transfer.to_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null,
            movement_type: 'TRANSFER_IN',
            quantity_in: line.quantity, quantity_out: 0,
            unit_cost: unitCost, value: line.quantity * unitCost,
            balance_after: newDstQty,
            source_type: 'TRANSFER', source_id: transfer.id.toString(),
            user_id: session.id,
          },
        });
      }
      await tx.stockTransfer.update({
        where: { id: transfer_id },
        data: { status: 'Received', receive_user_id: session.id, received_at: new Date() },
      });
    });

    revalidatePath('/admin/inventory/transfers');
    revalidatePath('/inventory/transfers');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ========================================
// Physical Stock Count
// ========================================

export async function listCountSessions(opts?: { store_id?: number; status?: string }) {
  try {
    const { db, organizationId } = await requireInventoryContext(STOCK_READ_ROLES);
    const where: any = { organizationId };
    if (opts?.store_id) where.store_id = opts.store_id;
    if (opts?.status) where.status = opts.status;
    const sessions = await db.stockCountSession.findMany({
      where, orderBy: { created_at: 'desc' },
      include: { store: { select: { id: true, name: true } }, _count: { select: { lines: true } } },
    });
    return { success: true, data: serialize(sessions) };
  } catch (e: any) {
    return { success: false, error: e.message, data: [] };
  }
}

export async function getStockCountSessionById(id: number) {
  try {
    const { db, organizationId } = await requireInventoryContext(STOCK_READ_ROLES);
    const session = await db.stockCountSession.findFirst({
      where: { id, organizationId },
      include: {
        store: { select: { id: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, name: true, item_code: true, base_uom: true } },
            batch: { select: { id: true, batch_no: true } },
          },
        },
      },
    });
    if (!session) return { success: false, error: 'Session not found' };
    return { success: true, data: serialize(session) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function createStockCountSession(store_id: number) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(STOCK_WRITE_ROLES);
    const sessionNumber = `CNT-${Date.now()}`;
    // Snapshot current book quantities
    const stocks = await db.storeStock.findMany({
      where: { store_id, organizationId, quantity_on_hand: { gt: 0 } },
    });
    const countSession = await db.stockCountSession.create({
      data: {
        session_number: sessionNumber,
        store_id,
        status: 'Counting',
        frozen_at: new Date(),
        organizationId,
        lines: {
          create: stocks.map((s: any) => ({
            item_id: s.item_id,
            batch_id: s.batch_id,
            book_qty: s.quantity_on_hand,
            counted_qty: 0,
          })),
        },
      },
      include: { lines: true },
    });
    revalidatePath('/admin/inventory/counts');
    return { success: true, data: serialize(countSession) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateCountLine(session_id: number, line_id: number, counted_qty: number) {
  try {
    const { db } = await requireInventoryContext(STOCK_WRITE_ROLES);
    const line = await db.stockCountLine.update({
      where: { id: line_id } as any,
      data: { counted_qty },
    });
    return { success: true, data: serialize(line) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function approveCountSession(session_id: number) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(STOCK_APPROVE_ROLES);

    const countSession = await db.stockCountSession.findFirst({
      where: { id: session_id, organizationId },
      include: { lines: true },
    });
    if (!countSession) return { success: false, error: 'Count session not found' };

    // Tolerance-based check for store_manager
    const configRow = await db.moduleConfig.findFirst({
      where: { organizationId, module_key: 'inventory' }
    });
    const tolerance = (configRow?.config_json as any)?.adjustment_tolerance_pct ?? 2.0; // percent e.g. 2%

    let exceedsTolerance = false;
    for (const line of countSession.lines) {
      const variance = line.counted_qty - line.book_qty;
      if (variance === 0) continue;
      const varPct = (Math.abs(variance) / (line.book_qty || 1)) * 100;
      if (varPct > tolerance) {
        exceedsTolerance = true;
        break;
      }
    }

    if (exceedsTolerance && session.role === 'store_manager') {
      await db.stockCountSession.update({
        where: { id: session_id },
        data: { status: 'Pending Approval' }
      });
      revalidatePath('/admin/inventory/counts');
      return { success: true, pendingFinance: true, message: `Count variance exceeds tolerance of ${tolerance}%. Submitted for Finance Approval.` };
    }

    const adjustmentLines: Array<{ item_id: number; quantity_delta: number; unit_cost: number; source_id: string }> = [];

    await db.$transaction(async (tx: any) => {
      const adjNumber = `ADJ-${Date.now()}`;
      const adj = await tx.stockAdjustment.create({
        data: {
          adjustment_number: adjNumber,
          store_id: countSession.store_id,
          count_session_id: session_id,
          reason_code: 'COUNT_VARIANCE',
          status: 'Approved',
          approved_by: session.id,
          approved_at: new Date(),
          organizationId,
        },
      });

      for (const line of countSession.lines) {
        const variance = line.counted_qty - line.book_qty;
        if (variance === 0) continue;

        // Update StoreStock
        const stock = await tx.storeStock.findFirst({
          where: { store_id: countSession.store_id, item_id: line.item_id, batch_id: line.batch_id },
        });
        if (stock) {
          await tx.storeStock.update({
            where: { id: stock.id },
            data: { quantity_on_hand: line.counted_qty },
          });
          const unitCost = stock.avg_unit_cost;
          const varianceValue = Math.abs(variance) * unitCost;
          await tx.stockCountLine.update({
            where: { id: line.id },
            data: { variance_value: varianceValue },
          });
          await tx.inventoryMovement.create({
            data: {
              organizationId, store_id: countSession.store_id, item_id: line.item_id, batch_id: line.batch_id,
              movement_type: variance > 0 ? 'ADJUSTMENT_PLUS' : 'ADJUSTMENT_MINUS',
              quantity_in: variance > 0 ? variance : 0,
              quantity_out: variance < 0 ? Math.abs(variance) : 0,
              unit_cost: unitCost, value: varianceValue,
              balance_after: line.counted_qty,
              source_type: 'ADJUSTMENT', source_id: adj.id.toString(),
              user_id: session.id,
              reason: 'Physical count variance',
            },
          });
          adjustmentLines.push({
            item_id: line.item_id,
            quantity_delta: variance,
            unit_cost: unitCost,
            source_id: `${adj.id}-${line.item_id}`,
          });
        }
      }

      await tx.stockCountSession.update({
        where: { id: session_id },
        data: { status: 'Posted', approved_by: session.id, approved_at: new Date() },
      });
    });

    for (const line of adjustmentLines) {
      await postAdjustmentToGL({
        organizationId,
        item_id: line.item_id,
        quantity_delta: line.quantity_delta,
        unit_cost: line.unit_cost,
        store_id: countSession.store_id,
        source_id: line.source_id,
        reason: 'Physical count variance',
      });
    }

    // Trigger GL posting for adjustment
    revalidatePath('/admin/inventory/stock-counts');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ========================================
// Stock Ledger (movement history)
// ========================================

export async function getStockLedger(opts: {
  store_id?: number;
  item_id?: number;
  movement_type?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const { db, organizationId } = await requireInventoryContext(STOCK_READ_ROLES);
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 50;
    const where: any = { organizationId };
    if (opts.store_id) where.store_id = opts.store_id;
    if (opts.item_id) where.item_id = opts.item_id;
    if (opts.movement_type) where.movement_type = opts.movement_type;
    if (opts.from_date || opts.to_date) {
      where.created_at = {};
      if (opts.from_date) where.created_at.gte = new Date(opts.from_date);
      if (opts.to_date) where.created_at.lte = new Date(opts.to_date);
    }
    const [rows, total] = await Promise.all([
      db.inventoryMovement.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          item: { select: { name: true, item_code: true, base_uom: true } },
          store: { select: { name: true } },
          batch: { select: { batch_no: true } },
        },
      }),
      db.inventoryMovement.count({ where }),
    ]);
    return { success: true, data: { movements: serialize(rows), total, totalPages: Math.ceil(total / limit), page } };
  } catch (e: any) {
    return { success: false, error: e.message, data: { movements: [], total: 0, totalPages: 0, page: 1 } };
  }
}

export async function quarantineBatch(batch_id: number, is_quarantined = true) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(STOCK_WRITE_ROLES);
    const batch = await db.itemBatch.update({
      where: { id: batch_id, organizationId },
      data: { is_quarantined },
    });
    await db.system_audit_logs.create({
      data: { action: is_quarantined ? 'QUARANTINE_BATCH' : 'RELEASE_BATCH', module: 'inventory', details: `Batch ID: ${batch_id}`, organizationId, user_id: session.id, username: session.username, role: session.role },
    });
    revalidatePath('/admin/inventory/adjustments');
    return { success: true, data: serialize(batch) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function listItemBatches(opts?: { search?: string }) {
  try {
    const { db, organizationId } = await requireInventoryContext(STOCK_READ_ROLES);
    const where: any = { organizationId };
    if (opts?.search?.trim()) {
      where.batch_no = { contains: opts.search, mode: 'insensitive' };
    }
    const batches = await db.itemBatch.findMany({
      where,
      orderBy: { expiry_date: 'asc' },
      include: { item: { select: { id: true, name: true, item_code: true } } },
    });
    return { success: true, data: serialize(batches) };
  } catch (e: any) {
    return { success: false, error: e.message, data: [] };
  }
}

export async function recordConsumption(input: {
  store_id: number;
  item_id: number;
  batch_id?: number | null;
  quantity: number;
  type: 'PATIENT' | 'DEPARTMENT';
  admission_id?: string | null;
  patient_id?: string | null;
  cost_center?: string | null;
  reason?: string | null;
}) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(STOCK_CONSUMPTION_ROLES);
    
    // Verify inputs
    const store = await db.store.findFirst({ where: { id: input.store_id, organizationId } });
    if (!store) return { success: false, error: 'Store not found' };

    const item = await db.itemMaster.findFirst({ where: { id: input.item_id, organizationId } });
    if (!item) return { success: false, error: 'Item not found' };

    if (input.type === 'PATIENT' && !input.admission_id && !input.patient_id) {
      return { success: false, error: 'Admission ID or Patient ID is required for patient consumption' };
    }

    const result = await db.$transaction(async (tx: any) => {
      // Find stock
      const stock = await tx.storeStock.findFirst({
        where: {
          store_id: input.store_id,
          item_id: input.item_id,
          batch_id: input.batch_id ?? null,
          organizationId
        }
      });

      if (!stock || stock.quantity_on_hand < input.quantity) {
        throw new Error(`Insufficient stock available in this store. Current: ${stock?.quantity_on_hand ?? 0}`);
      }

      // Deduct stock
      const newQty = stock.quantity_on_hand - input.quantity;
      await tx.storeStock.update({
        where: { id: stock.id },
        data: { quantity_on_hand: newQty }
      });

      const movementType = (input.type === 'PATIENT' && item.is_patient_chargeable) ? 'PATIENT_CHARGE' : 'CONSUMPTION';

      // Create movement
      const movement = await tx.inventoryMovement.create({
        data: {
          organizationId,
          store_id: input.store_id,
          item_id: input.item_id,
          batch_id: input.batch_id ?? null,
          movement_type: movementType,
          quantity_in: 0,
          quantity_out: input.quantity,
          unit_cost: stock.avg_unit_cost,
          value: input.quantity * stock.avg_unit_cost,
          balance_after: newQty,
          source_type: input.type === 'PATIENT' ? 'PATIENT' : 'DEPARTMENT',
          source_id: `CONS-${Date.now()}`,
          cost_center: input.cost_center || store.cost_center,
          patient_id: input.patient_id ?? null,
          admission_id: input.admission_id ?? null,
          user_id: session.id,
          reason: input.reason ?? null
        }
      });

      return { movement, avgUnitCost: stock.avg_unit_cost };
    });

    // Post charge to patient bill if patient chargeable
    if (input.type === 'PATIENT' && item.is_patient_chargeable) {
      if (input.admission_id) {
        // IPD path
        await postChargeToIpdBill({
          admission_id: input.admission_id,
          source_module: 'inventory',
          source_ref_id: result.movement.id.toString(),
          description: `Consumable: ${item.name}`,
          quantity: input.quantity,
          unit_price: item.selling_price || item.mrp || 0
        });
      } else if (input.patient_id) {
        // OPD path
        const { createInvoice, addInvoiceItem } = await import('./finance-actions');
        
        let invoice = await db.invoices.findFirst({
          where: { patient_id: input.patient_id, status: 'Draft', invoice_type: 'OPD', organizationId }
        });
        
        let invoiceId = invoice?.id;
        
        if (!invoiceId) {
          const invRes = await createInvoice({
            patient_id: input.patient_id,
            invoice_type: 'OPD',
            notes: 'Consumables charging'
          });
          if (invRes.success) {
            invoiceId = (invRes as any).data?.id;
          }
        }
        
        if (invoiceId) {
          await addInvoiceItem({
            invoice_id: invoiceId,
            department: 'Pharmacy',
            description: item.name,
            quantity: input.quantity,
            unit_price: item.selling_price || item.mrp || 0,
            tax_rate: item.gst_rate || 0,
            service_category: 'Consumable'
          });
        }
      }
    }

    // Post to GL
    const glRes = await postConsumptionToGL({
      organizationId,
      item_id: item.id,
      quantity: input.quantity,
      unit_cost: result.avgUnitCost,
      store_id: input.store_id,
      source_id: result.movement.source_id,
      description: `Consumption of ${item.name} from ${store.name}`,
      is_patient_chargeable: item.is_patient_chargeable
    });

    if (glRes.success && glRes.journalId) {
      await db.inventoryMovement.update({
        where: { id: result.movement.id },
        data: { gl_journal_id: glRes.journalId },
      });
    }

    await db.system_audit_logs.create({
      data: {
        action: 'RECORD_CONSUMPTION',
        module: 'inventory',
        details: `Recorded consumption of ${input.quantity} ${item.name} in store ${store.name}`,
        organizationId,
        user_id: session.id,
        username: session.username,
        role: session.role
      }
    });

    revalidatePath('/admin/inventory/adjustments');
    return { success: true, movementId: result.movement.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function recordWriteOff(batchId: number, quantity: number, reason: string) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(WRITE_OFF_APPROVE_ROLES);
    
    // Verify batch
    const batch = await db.itemBatch.findUnique({
      where: { id: batchId, organizationId },
      include: { item: true }
    });
    if (!batch) return { success: false, error: 'Batch not found' };

    // Verify stock exists in store
    const storeStock = await db.storeStock.findFirst({
      where: { batch_id: batchId, organizationId }
    });
    if (!storeStock || storeStock.quantity_on_hand < quantity) {
      return { success: false, error: `Insufficient stock in batch. Available: ${storeStock?.quantity_on_hand ?? 0}` };
    }

    const result = await db.$transaction(async (tx: any) => {
      const newQty = storeStock.quantity_on_hand - quantity;
      await tx.storeStock.update({
        where: { id: storeStock.id },
        data: { quantity_on_hand: newQty }
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          organizationId,
          store_id: storeStock.store_id,
          item_id: batch.item_id,
          batch_id: batchId,
          movement_type: 'DAMAGE_WRITEOFF',
          quantity_in: 0,
          quantity_out: quantity,
          unit_cost: batch.cost_price || storeStock.avg_unit_cost || 0,
          value: quantity * (batch.cost_price || storeStock.avg_unit_cost || 0),
          balance_after: newQty,
          source_type: 'ADJUSTMENT',
          source_id: `WO-${Date.now()}`,
          cost_center: 'Quarantine',
          user_id: session.id,
          reason: reason
        }
      });
      return { movement, cost: batch.cost_price || storeStock.avg_unit_cost || 0, store_id: storeStock.store_id };
    });

    // Post to GL
    const { postWriteOffToGL } = await import('./inventory-gl-actions');
    const glRes = await postWriteOffToGL({
      organizationId,
      item_id: batch.item_id,
      quantity,
      unit_cost: result.cost,
      source_id: result.movement.source_id,
      reason
    });

    if (glRes.success && glRes.journalId) {
      await db.inventoryMovement.update({
        where: { id: result.movement.id },
        data: { gl_journal_id: glRes.journalId }
      });
    }

    await db.system_audit_logs.create({
      data: {
        action: 'RECORD_WRITEOFF', module: 'inventory',
        details: `Recorded write-off of ${quantity} items from batch ${batch.batch_no}: ${reason}`,
        organizationId, user_id: session.id, username: session.username, role: session.role
      }
    });

    revalidatePath('/admin/inventory/adjustments');
    return { success: true, movementId: result.movement.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
