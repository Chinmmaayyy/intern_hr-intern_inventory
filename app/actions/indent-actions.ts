'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireInventoryContext } from '@/app/lib/inventory-context';

import {
  INDENT_READ_ROLES,
  INDENT_CREATE_ROLES,
  INDENT_APPROVE_ROLES,
  INDENT_ISSUE_ROLES
} from '@/app/lib/inventory-roles';

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
    const { db, organizationId } = await requireInventoryContext(INDENT_READ_ROLES);
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
    const { db, organizationId, session } = await requireInventoryContext(INDENT_CREATE_ROLES);
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
    const { db, organizationId } = await requireInventoryContext(INDENT_READ_ROLES);
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
    const { db, organizationId, session } = await requireInventoryContext(INDENT_APPROVE_ROLES);
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
    const { db, organizationId } = await requireInventoryContext(INDENT_ISSUE_ROLES);
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
    const { db, organizationId, session } = await requireInventoryContext(INDENT_ISSUE_ROLES);
    const indent = await db.indent.findFirst({
      where: { id: indent_id, organizationId },
      include: {
        items: true,
        from_store: { select: { id: true, name: true, branch_id: true } },
        to_store: { select: { id: true, name: true, branch_id: true } },
      }
    });
    if (!indent) return { success: false, error: 'Indent not found' };
    if (!['Approved','Partially Issued'].includes(indent.status)) return { success: false, error: 'Indent not approved for issuance' };

    const issueNumber = `ISS-${Date.now()}`;
    const isInterBranch = indent.from_store.branch_id !== indent.to_store.branch_id;

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
        let stock: any = null;
        if (line.batch_id) {
          const locked = await tx.$queryRaw<any[]>`
            SELECT id, "quantity_on_hand", "avg_unit_cost" FROM store_stocks
            WHERE store_id = ${indent.to_store_id} AND item_id = ${line.item_id} AND batch_id = ${line.batch_id} AND "organizationId" = ${organizationId}
            LIMIT 1 FOR UPDATE
          `;
          stock = locked[0] || null;
        } else {
          const locked = await tx.$queryRaw<any[]>`
            SELECT id, "quantity_on_hand", "avg_unit_cost" FROM store_stocks
            WHERE store_id = ${indent.to_store_id} AND item_id = ${line.item_id} AND batch_id IS NULL AND "organizationId" = ${organizationId}
            LIMIT 1 FOR UPDATE
          `;
          stock = locked[0] || null;
        }

        if (!stock) {
          throw new Error(`Item ID ${line.item_id} has no stock record in issuing store.`);
        }

        // Short-supply handling
        const pickQty = Math.min(line.quantity, stock.quantity_on_hand);
        if (pickQty <= 0) {
          await tx.system_audit_logs.create({
            data: {
              action: 'SHORT_SUPPLY', module: 'inventory',
              details: `Indent ${indent.indent_number} item ${line.item_id}: Zero stock available. Requested ${line.quantity}.`,
              organizationId, user_id: session.id, username: session.username, role: session.role
            }
          });
          continue;
        }

        if (pickQty < line.quantity) {
          await tx.system_audit_logs.create({
            data: {
              action: 'SHORT_SUPPLY', module: 'inventory',
              details: `Indent ${indent.indent_number} item ${line.item_id}: Short supply. Issued ${pickQty}/${line.quantity} due to stock constraint.`,
              organizationId, user_id: session.id, username: session.username, role: session.role
            }
          });
        }

        await tx.storeStock.update({
          where: { id: stock.id },
          data: { quantity_on_hand: { decrement: pickQty } },
        });

        // Create movement: INDENT_ISSUE from issuing store
        const balanceAfter = stock.quantity_on_hand - pickQty;
        await tx.inventoryMovement.create({
          data: {
            organizationId, store_id: indent.to_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null,
            movement_type: 'INDENT_ISSUE',
            quantity_in: 0, quantity_out: pickQty,
            unit_cost: stock.avg_unit_cost, value: pickQty * stock.avg_unit_cost,
            balance_after: balanceAfter,
            source_type: 'INDENT', source_id: indent_id.toString(),
            user_id: session.id,
          },
        });

        if (indent.cost_center) {
          // Direct consumption expensing (e.g. Ward cost centers) - no destination store credit
          await tx.inventoryMovement.create({
            data: {
              organizationId, store_id: indent.to_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null,
              movement_type: 'CONSUMPTION',
              quantity_in: 0, quantity_out: pickQty,
              unit_cost: stock.avg_unit_cost, value: pickQty * stock.avg_unit_cost,
              balance_after: balanceAfter,
              source_type: 'CONSUMPTION', source_id: indent_id.toString(),
              cost_center: indent.cost_center,
              user_id: session.id,
            },
          });

          // Post consumption to GL asynchronously
          try {
            const { postConsumptionToGL } = await import('./inventory-gl-actions');
            const item = await tx.itemMaster.findUnique({ where: { id: line.item_id } });
            await postConsumptionToGL({
              organizationId,
              item_id: line.item_id,
              quantity: pickQty,
              unit_cost: stock.avg_unit_cost,
              store_id: indent.to_store_id,
              source_id: indent_id.toString(),
              description: `Direct consumption issue to cost center: ${indent.cost_center}`,
              is_patient_chargeable: item?.is_patient_chargeable
            });
          } catch (glErr: any) {
            console.error('Failed to post direct issue consumption to GL:', glErr.message);
          }
        } else if (!isInterBranch) {
          // Same branch: 1-step direct receipt
          const destStock = await tx.storeStock.findFirst({
            where: { store_id: indent.from_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null },
          });
          const newDestQty = (destStock?.quantity_on_hand ?? 0) + pickQty;
          if (destStock) {
            await tx.storeStock.update({
              where: { id: destStock.id },
              data: { quantity_on_hand: newDestQty, avg_unit_cost: stock.avg_unit_cost },
            });
          } else {
            await tx.storeStock.create({
              data: { store_id: indent.from_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null, quantity_on_hand: pickQty, avg_unit_cost: stock.avg_unit_cost, organizationId },
            });
          }
          await tx.inventoryMovement.create({
            data: {
              organizationId, store_id: indent.from_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null,
              movement_type: 'INDENT_RECEIPT',
              quantity_in: pickQty, quantity_out: 0,
              unit_cost: stock.avg_unit_cost, value: pickQty * stock.avg_unit_cost,
              balance_after: newDestQty,
              source_type: 'INDENT', source_id: indent_id.toString(),
              user_id: session.id,
            },
          });

          // Same-branch: receive immediately
          await tx.indentItem.updateMany({
            where: { indent_id, item_id: line.item_id },
            data: { qty_received: { increment: pickQty } },
          });
        }

        // Update indent item qty_issued
        await tx.indentItem.updateMany({
          where: { indent_id, item_id: line.item_id },
          data: { qty_issued: { increment: pickQty } },
        });
      }

      // Determine new indent status (inter-branch gets 'Transit' status)
      const updatedItems = await tx.indentItem.findMany({ where: { indent_id } });
      const allIssued = updatedItems.every((i: any) => i.qty_issued >= i.qty_approved);
      const anyIssued = updatedItems.some((i: any) => i.qty_issued > 0);
      
      let nextStatus = indent.status;
      if (allIssued) {
        nextStatus = isInterBranch ? 'In Transit' : 'Issued';
      } else if (anyIssued) {
        nextStatus = 'Partially Issued';
      }

      await tx.indent.update({
        where: { id: indent_id },
        data: { status: nextStatus },
      });
    });

    revalidatePath('/admin/inventory/indents');
    return { success: true, issueNumber };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function receiveConfirmIndent(indent_id: number, receivedLines: Array<{
  item_id: number;
  batch_id?: number | null;
  quantity: number;
}>) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(INDENT_READ_ROLES);
    const indent = await db.indent.findFirst({
      where: { id: indent_id, organizationId },
      include: { items: true, to_store: true, from_store: true }
    });
    if (!indent) return { success: false, error: 'Indent not found' };

    await db.$transaction(async (tx: any) => {
      for (const line of receivedLines) {
        const indentItem = indent.items.find((i: any) => i.item_id === line.item_id);
        if (!indentItem) continue;

        // Fetch original issue movement to get unit cost
        const issueMovement = await tx.inventoryMovement.findFirst({
          where: {
            organizationId,
            store_id: indent.to_store_id,
            item_id: line.item_id,
            movement_type: 'INDENT_ISSUE',
            source_type: 'INDENT',
            source_id: indent_id.toString()
          },
          orderBy: { created_at: 'desc' }
        });
        const unitCost = issueMovement?.unit_cost ?? 0;

        // Credit receiving store stock
        const destStock = await tx.storeStock.findFirst({
          where: { store_id: indent.from_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null }
        });
        const newDestQty = (destStock?.quantity_on_hand ?? 0) + line.quantity;
        if (destStock) {
          await tx.storeStock.update({
            where: { id: destStock.id },
            data: { quantity_on_hand: newDestQty }
          });
        } else {
          await tx.storeStock.create({
            data: {
              store_id: indent.from_store_id,
              item_id: line.item_id,
              batch_id: line.batch_id ?? null,
              quantity_on_hand: line.quantity,
              avg_unit_cost: unitCost,
              organizationId
            }
          });
        }

        // Record movement
        await tx.inventoryMovement.create({
          data: {
            organizationId, store_id: indent.from_store_id, item_id: line.item_id, batch_id: line.batch_id ?? null,
            movement_type: 'INDENT_RECEIPT',
            quantity_in: line.quantity, quantity_out: 0,
            unit_cost: unitCost, value: line.quantity * unitCost,
            balance_after: newDestQty,
            source_type: 'INDENT', source_id: indent_id.toString(),
            user_id: session.id,
          }
        });

        // Update qty_received
        await tx.indentItem.updateMany({
          where: { indent_id, item_id: line.item_id },
          data: { qty_received: { increment: line.quantity } }
        });

        // Discrepancy warning
        const qtyIssued = indentItem.qty_issued;
        if (line.quantity < qtyIssued) {
          await tx.system_audit_logs.create({
            data: {
              action: 'INDENT_DISCREPANCY', module: 'inventory',
              details: `Indent receipt discrepancy for item ${line.item_id}: received ${line.quantity} vs issued ${qtyIssued}`,
              organizationId, user_id: session.id, username: session.username, role: session.role
            }
          });
        }
      }

      await tx.indent.update({
        where: { id: indent_id },
        data: { status: 'Received' }
      });
    });

    revalidatePath('/admin/inventory/indents');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function emergencyIssue(fromStoreId: number, toStoreId: number, items: Array<{ item_id: number; quantity: number }>) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(INDENT_ISSUE_ROLES);
    
    // Fetch config
    const configRow = await db.moduleConfig.findFirst({
      where: { organizationId, module_key: 'inventory' }
    });
    const cap = (configRow?.config_json as any)?.emergency_issue_cap ?? 10000;

    // Calculate value
    let totalValue = 0;
    for (const it of items) {
      const stock = await db.storeStock.findFirst({
        where: { store_id: toStoreId, item_id: it.item_id, organizationId }
      });
      totalValue += it.quantity * (stock?.avg_unit_cost ?? 100);
    }

    if (totalValue > cap) {
      return { success: false, error: `Emergency issue exceeds cap of ₹${cap.toLocaleString()}` };
    }

    // Raise retrospective indent
    const indentNumber = `EMERG-IND-${Date.now()}`;
    const indent = await db.$transaction(async (tx: any) => {
      const ind = await tx.indent.create({
        data: {
          indent_number: indentNumber,
          from_store_id: fromStoreId,
          to_store_id: toStoreId,
          priority: 'EMERGENCY',
          status: 'Approved',
          approved_by: session.id,
          approved_at: new Date(),
          organizationId,
          items: {
            create: items.map(it => ({
              item_id: it.item_id,
              qty_requested: it.quantity,
              qty_approved: it.quantity,
            }))
          }
        }
      });
      return ind;
    });

    // Issue it immediately
    const issueRes = await issueIndentItems(indent.id, items.map(it => ({
      item_id: it.item_id,
      quantity: it.quantity,
    })));
    return issueRes;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function listStockIssues(opts?: { indent_id?: number; page?: number; limit?: number }) {
  try {
    const { db, organizationId } = await requireInventoryContext(INDENT_READ_ROLES);
    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 20;
    const where: Record<string, unknown> = { organizationId };
    if (opts?.indent_id) where.indent_id = opts.indent_id;
    const [rows, total] = await Promise.all([
      db.stockIssue.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          from_store: { select: { id: true, name: true } },
          to_store: { select: { id: true, name: true } },
          indent: { select: { id: true, indent_number: true, status: true } },
          items: { include: { item: { select: { id: true, name: true, item_code: true } } } },
        },
      }),
      db.stockIssue.count({ where }),
    ]);
    return { success: true, data: { issues: serialize(rows), total, totalPages: Math.ceil(total / limit), page } };
  } catch (e: any) {
    return { success: false, error: e.message, data: { issues: [], total: 0, totalPages: 0, page: 1 } };
  }
}

export async function rejectIndent(id: number, reason: string) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(INDENT_APPROVE_ROLES);
    await db.indent.update({
      where: { id, organizationId } as any,
      data: { status: 'Rejected' },
    });
    await db.system_audit_logs.create({
      data: {
        action: 'REJECT_INDENT', module: 'inventory',
        details: `Rejected indent ${id}: ${reason}`,
        organizationId, user_id: session.id, username: session.username, role: session.role,
      },
    });
    revalidatePath('/admin/inventory/indents');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
