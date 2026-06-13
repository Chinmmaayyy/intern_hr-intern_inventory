'use server';
import { requireRoleAndTenant } from '@/backend/tenant';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

// Role groups for inventory indent operations
const INDENT_READ_ROLES = ['admin', 'finance', 'pharmacist', 'lab_technician', 'ipd_manager', 'doctor', 'receptionist'];
const INDENT_CREATE_ROLES = ['admin', 'pharmacist', 'lab_technician', 'ipd_manager', 'doctor', 'receptionist'];
const INDENT_APPROVE_ROLES = ['admin'];
const INDENT_ISSUE_ROLES = ['admin', 'pharmacist'];

function serialize<T>(d: T): T {
  return JSON.parse(JSON.stringify(d, (_, v) =>
    typeof v === 'object' && v !== null && v?.constructor?.name === 'Decimal' ? Number(v) : v));
}

const indentItemSchema = z.object({
  item_id: z.number().int().positive(),
  qty_requested: z.number().int().positive(),
});

const indentSchema = z.object({
  from_store_id: z.number().int().positive(),
  to_store_id: z.number().int().positive(),
  priority: z.enum(['NORMAL','URGENT','EMERGENCY']).default('NORMAL'),
  cost_center: z.string().optional().nullable(),
  admission_id: z.string().optional().nullable(),
  items: z.array(indentItemSchema).min(1),
});

const issueItemSchema = z.object({
  item_id: z.number().int().positive(),
  batch_id: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().positive(),
});

// ========================================
// Indent Actions
// ========================================

export async function listIndents(opts?: {
  status?: string;
  from_store_id?: number;
  to_store_id?: number;
  page?: number;
  limit?: number;
}) {
  try {
    const { db, organizationId } = await requireRoleAndTenant(INDENT_READ_ROLES);
    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 20;
    const where: any = { organizationId };
    if (opts?.status) where.status = opts.status;
    if (opts?.from_store_id) where.from_store_id = opts.from_store_id;
    if (opts?.to_store_id) where.to_store_id = opts.to_store_id;
    const [rows, total] = await Promise.all([
      db.indent.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          from_store: { select: { id: true, name: true } },
          to_store: { select: { id: true, name: true } },
          items: { include: { item: { select: { id: true, name: true, item_code: true, base_uom: true } } } },
          _count: { select: { items: true } },
        },
      }),
      db.indent.count({ where }),
    ]);
    return { success: true, data: { indents: serialize(rows), total, totalPages: Math.ceil(total / limit), page } };
  } catch (e: any) {
    return { success: false, error: e.message, data: { indents: [], total: 0, totalPages: 0, page: 1 } };
  }
}

export async function createIndent(input: unknown) {
  try {
    const { db, organizationId, session } = await requireRoleAndTenant(INDENT_CREATE_ROLES);
    const data = indentSchema.parse(input);
    const indentNumber = `IND-${Date.now()}`;
    const indent = await db.indent.create({
      data: {
        indent_number: indentNumber,
        from_store_id: data.from_store_id,
        to_store_id: data.to_store_id,
        priority: data.priority,
        cost_center: data.cost_center,
        admission_id: data.admission_id,
        status: 'Submitted',
        organizationId,
        items: { create: data.items },
      },
      include: { items: true },
    });
    await db.system_audit_logs.create({
      data: { action: 'CREATE_INDENT', module: 'inventory', details: `Created Indent: ${indentNumber}`, organizationId, user_id: session.id, username: session.username, role: session.role },
    });
    revalidatePath('/admin/inventory/indents');
    return { success: true, data: serialize(indent) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getIndentById(id: number) {
  try {
    const { db, organizationId } = await requireRoleAndTenant(INDENT_READ_ROLES);
    const indent = await db.indent.findFirst({
      where: { id, organizationId },
      include: {
        from_store: { select: { id: true, name: true } },
        to_store: { select: { id: true, name: true } },
        items: {
          include: {
            item: { select: { id: true, name: true, item_code: true, base_uom: true } },
          },
        },
      },
    });
    if (!indent) return { success: false, error: 'Indent not found' };
    return { success: true, data: serialize(indent) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function approveIndent(id: number, approvedItems: Array<{ item_id: number; qty_approved: number }>) {
  try {
    const { db, organizationId, session } = await requireRoleAndTenant(INDENT_APPROVE_ROLES);
    await db.$transaction(async (tx: any) => {
      await tx.indent.update({
        where: { id } as any,
        data: { status: 'Approved', approved_by: session.id, approved_at: new Date() },
      });
      for (const ai of approvedItems) {
        await tx.indentItem.updateMany({
          where: { indent_id: id, item_id: ai.item_id },
          data: { qty_approved: ai.qty_approved },
        });
      }
    });
    revalidatePath('/admin/inventory/indents');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ========================================
// Stock Issue Actions (FEFO picking)
// ========================================

export async function getFEFOSuggestion(store_id: number, item_id: number, quantity: number) {
  try {
    const { db, organizationId } = await requireRoleAndTenant(INDENT_ISSUE_ROLES);
    // Get batch-level stocks ordered by expiry (FEFO)
    const stocks = await db.storeStock.findMany({
      where: { store_id, item_id, organizationId, quantity_on_hand: { gt: 0 } },
      include: { batch: { select: { id: true, batch_no: true, expiry_date: true } } },
      orderBy: { batch: { expiry_date: 'asc' } },
    });

    const allocations: Array<{ batch_id: number | null; batch_no: string; expiry_date: Date | null; qty: number }> = [];
    let remaining = quantity;
    for (const s of stocks) {
      if (remaining <= 0) break;
      const pick = Math.min(s.quantity_on_hand, remaining);
      allocations.push({
        batch_id: s.batch_id,
        batch_no: s.batch?.batch_no ?? 'NO-BATCH',
        expiry_date: s.batch?.expiry_date ?? null,
        qty: pick,
      });
      remaining -= pick;
    }
    return { success: true, data: { allocations, canFulfill: remaining === 0, shortfall: remaining } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function issueIndentItems(indent_id: number, issueLines: Array<{
  item_id: number;
  batch_id?: number | null;
  quantity: number;
}>) {
  try {
    const { db, organizationId, session } = await requireRoleAndTenant(INDENT_ISSUE_ROLES);
    const indent = await db.indent.findFirst({ where: { id: indent_id, organizationId }, include: { items: true } });
    if (!indent) return { success: false, error: 'Indent not found' };
    if (!['Approved','Partially Issued'].includes(indent.status)) return { success: false, error: 'Indent not approved for issuance' };

    const issueNumber = `ISS-${Date.now()}`;

    await db.$transaction(async (tx: any) => {
      const issue = await tx.stockIssue.create({
        data: {
          issue_number: issueNumber,
          indent_id,
          from_store_id: indent.to_store_id,
          to_store_id: indent.from_store_id,
          organizationId,
          items: { create: issueLines },
        },
      });

      for (const line of issueLines) {
        // Deduct from issuing store stock
        const stock = await tx.storeStock.findFirst({
          where: { store_id: indent.to_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null, organizationId },
        });
        if (!stock || stock.quantity_on_hand < line.quantity) {
          throw new Error(`Insufficient stock for item ID ${line.item_id}`);
        }
        await tx.storeStock.update({
          where: { id: stock.id },
          data: { quantity_on_hand: { decrement: line.quantity } },
        });

        // Create movement: INDENT_ISSUE from issuing store
        const balanceAfter = stock.quantity_on_hand - line.quantity;
        await tx.inventoryMovement.create({
          data: {
            organizationId, store_id: indent.to_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null,
            movement_type: 'INDENT_ISSUE',
            quantity_in: 0, quantity_out: line.quantity,
            unit_cost: stock.avg_unit_cost, value: line.quantity * stock.avg_unit_cost,
            balance_after: balanceAfter,
            source_type: 'INDENT', source_id: indent_id.toString(),
            user_id: session.id,
          },
        });

        // Credit receiving store stock (INDENT_RECEIPT)
        const destStock = await tx.storeStock.findFirst({
          where: { store_id: indent.from_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null },
        });
        const newDestQty = (destStock?.quantity_on_hand ?? 0) + line.quantity;
        if (destStock) {
          await tx.storeStock.update({
            where: { id: destStock.id },
            data: { quantity_on_hand: newDestQty, avg_unit_cost: stock.avg_unit_cost },
          });
        } else {
          await tx.storeStock.create({
            data: { store_id: indent.from_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null, quantity_on_hand: line.quantity, avg_unit_cost: stock.avg_unit_cost, organizationId },
          });
        }
        await tx.inventoryMovement.create({
          data: {
            organizationId, store_id: indent.from_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null,
            movement_type: 'INDENT_RECEIPT',
            quantity_in: line.quantity, quantity_out: 0,
            unit_cost: stock.avg_unit_cost, value: line.quantity * stock.avg_unit_cost,
            balance_after: newDestQty,
            source_type: 'INDENT', source_id: indent_id.toString(),
            user_id: session.id,
          },
        });

        // Update indent item qty_issued
        await tx.indentItem.updateMany({
          where: { indent_id, item_id: line.item_id },
          data: { qty_issued: { increment: line.quantity } },
        });
      }

      // Determine new indent status
      const updatedItems = await tx.indentItem.findMany({ where: { indent_id } });
      const allIssued = updatedItems.every((i: any) => i.qty_issued >= i.qty_approved);
      const anyIssued = updatedItems.some((i: any) => i.qty_issued > 0);
      await tx.indent.update({
        where: { id: indent_id },
        data: { status: allIssued ? 'Issued' : anyIssued ? 'Partially Issued' : indent.status },
      });
    });

    revalidatePath('/admin/inventory/indents');
    return { success: true, issueNumber };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
