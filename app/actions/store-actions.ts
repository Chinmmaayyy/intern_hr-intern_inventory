'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireInventoryContext } from '@/app/lib/inventory-context';
import {
  INVENTORY_READ_ROLES,
  GRN_WRITE_ROLES as INVENTORY_ADMIN_ROLES,
  COUNT_APPROVE_ROLES as INVENTORY_FINANCE_ROLES,
  assertStoreAccess,
} from '@/app/lib/inventory-roles';

function serialize<T>(d: T): T {
  return JSON.parse(JSON.stringify(d, (_, v) =>
    typeof v === 'object' && v !== null && v?.constructor?.name === 'Decimal' ? Number(v) : v));
}

const storeSchema = z.object({
  store_code: z.string().min(1),
  name: z.string().min(1),
  store_type: z.enum(['CENTRAL','PHARMACY','WARD','OT','ER','LAB','RADIOLOGY','MAINTENANCE','HOUSEKEEPING','KITCHEN','CSSD']),
  branch_id: z.string().optional().nullable(),
  parent_store_id: z.number().int().positive().optional().nullable(),
  cost_center: z.string().optional().nullable(),
  incharge_user_id: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

const storeItemSettingSchema = z.object({
  store_id: z.number().int().positive(),
  item_id: z.number().int().positive(),
  par_level: z.number().int().nonnegative().default(0),
  reorder_point: z.number().int().nonnegative().default(0),
  max_level: z.number().int().nonnegative().default(0),
  auto_indent: z.boolean().default(false),
});

// ========================================
// Store CRUD
// ========================================

export async function listStores(opts?: { search?: string; store_type?: string; is_active?: boolean }) {
  try {
    const { db, organizationId } = await requireInventoryContext(INVENTORY_READ_ROLES);
    const where: any = { organizationId };
    if (opts?.search?.trim()) where.name = { contains: opts.search, mode: 'insensitive' };
    if (opts?.store_type) where.store_type = opts.store_type;
    if (opts?.is_active !== undefined) where.is_active = opts.is_active;
    const stores = await db.store.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        branch: { select: { id: true, branch_name: true } },
        parent_store: { select: { id: true, name: true } },
        incharge_user: { select: { id: true, name: true } },
        _count: { select: { store_stocks: true } },
      },
    });
    return { success: true, data: serialize(stores) };
  } catch (e: any) {
    return { success: false, error: e.message, data: [] };
  }
}

export async function createStore(input: unknown) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(INVENTORY_ADMIN_ROLES);
    const data = storeSchema.parse(input);
    const existing = await db.store.findFirst({ where: { store_code: data.store_code, organizationId } });
    if (existing) return { success: false, error: `Store code '${data.store_code}' already exists` };
    const row = await db.store.create({ data: { ...data, organizationId } });
    await db.system_audit_logs.create({
      data: {
        action: 'CREATE_STORE', module: 'inventory',
        details: `Created store: ${data.name}`,
        organizationId, user_id: session.id, username: session.username, role: session.role,
      },
    });
    revalidatePath('/admin/inventory/stores');
    return { success: true, data: serialize(row) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateStore(id: number, input: unknown) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(INVENTORY_ADMIN_ROLES);
    const data = storeSchema.partial().parse(input);
    const row = await db.store.update({ where: { id } as any, data });
    revalidatePath('/admin/inventory/stores');
    return { success: true, data: serialize(row) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getStoreById(id: number) {
  try {
    const { db, organizationId } = await requireInventoryContext(INVENTORY_READ_ROLES);
    const store = await db.store.findFirst({
      where: { id, organizationId },
      include: {
        branch: true,
        parent_store: true,
        child_stores: true,
        incharge_user: { select: { id: true, name: true } },
        store_settings: {
          include: {
            item: { select: { id: true, name: true, item_code: true, base_uom: true } },
          },
        },
      },
    });
    if (!store) return { success: false, error: 'Store not found' };
    return { success: true, data: serialize(store) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ========================================
// Store Stock & Item Settings
// ========================================

export async function getStoreStock(store_id: number, opts?: { search?: string; page?: number; limit?: number }) {
  try {
    const { db, organizationId } = await requireInventoryContext(INVENTORY_READ_ROLES);
    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 50;
    const where: any = { store_id, organizationId };
    if (opts?.search?.trim()) {
      where.item = { name: { contains: opts.search, mode: 'insensitive' } };
    }
    const [rows, total] = await Promise.all([
      db.storeStock.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          item: {
            select: {
              id: true, name: true, item_code: true, base_uom: true,
              reorder_point: true, min_level: true, max_level: true,
            },
          },
          batch: { select: { id: true, batch_no: true, expiry_date: true } },
        },
        orderBy: { item: { name: 'asc' } },
      }),
      db.storeStock.count({ where }),
    ]);
    return {
      success: true,
      data: { stocks: serialize(rows), total, totalPages: Math.ceil(total / limit), page },
    };
  } catch (e: any) {
    return { success: false, error: e.message, data: { stocks: [], total: 0, totalPages: 0, page: 1 } };
  }
}

export async function upsertStoreItemSetting(input: unknown) {
  try {
    const { db, organizationId } = await requireInventoryContext(INVENTORY_ADMIN_ROLES);
    const data = storeItemSettingSchema.parse(input);
    const row = await db.storeItemSetting.upsert({
      where: { store_id_item_id: { store_id: data.store_id, item_id: data.item_id } },
      create: { ...data, organizationId },
      update: {
        par_level: data.par_level,
        reorder_point: data.reorder_point,
        max_level: data.max_level,
        auto_indent: data.auto_indent,
      },
    });
    revalidatePath(`/inventory/stores/${data.store_id}`);
    return { success: true, data: serialize(row) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ========================================
// Opening Stock Posting
// ========================================

export async function postOpeningStock(
  store_id: number,
  lines: Array<{
    item_id: number;
    batch_no?: string;
    expiry_date?: string;
    quantity: number;
    unit_cost: number;
  }>
) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(INVENTORY_ADMIN_ROLES);
    const store = await db.store.findFirst({ where: { id: store_id, organizationId } });
    if (!store) return { success: false, error: 'Store not found' };

    const results = await db.$transaction(async (tx: any) => {
      const movements = [];
      for (const line of lines) {
        const item = await tx.itemMaster.findFirst({ where: { id: line.item_id, organizationId } });
        if (!item) throw new Error(`Item ID ${line.item_id} not found`);

        let batchId: number | null = null;
        if (item.is_batch_tracked && line.batch_no) {
          const batch = await tx.itemBatch.upsert({
            where: { item_id_batch_no: { item_id: line.item_id, batch_no: line.batch_no } },
            create: {
              item_id: line.item_id, batch_no: line.batch_no,
              expiry_date: line.expiry_date ? new Date(line.expiry_date) : undefined,
              cost_price: line.unit_cost, organizationId,
            },
            update: {},
          });
          batchId = batch.id;
        }

        const existing = await tx.storeStock.findFirst({
          where: { store_id, item_id: line.item_id, batch_id: batchId },
        });
        const newQty = (existing?.quantity_on_hand ?? 0) + line.quantity;
        const newCost = existing
          ? ((existing.quantity_on_hand * existing.avg_unit_cost) + (line.quantity * line.unit_cost)) / newQty
          : line.unit_cost;

        if (existing) {
          await tx.storeStock.update({
            where: { id: existing.id },
            data: { quantity_on_hand: newQty, avg_unit_cost: newCost },
          });
        } else {
          await tx.storeStock.create({
            data: {
              store_id, item_id: line.item_id, batch_id: batchId,
              quantity_on_hand: line.quantity, avg_unit_cost: line.unit_cost, organizationId,
            },
          });
        }

        const mov = await tx.inventoryMovement.create({
          data: {
            organizationId, store_id, item_id: line.item_id, batch_id: batchId,
            movement_type: 'OPENING',
            quantity_in: line.quantity, quantity_out: 0,
            unit_cost: line.unit_cost, value: line.quantity * line.unit_cost,
            balance_after: newQty,
            source_type: 'OPENING', source_id: 'opening-stock',
            user_id: session.id,
          },
        });
        movements.push(mov);
      }
      return movements;
    });

    await db.system_audit_logs.create({
      data: {
        action: 'POST_OPENING_STOCK', module: 'inventory',
        details: `Posted ${lines.length} opening stock lines for store ${store_id}`,
        organizationId, user_id: session.id, username: session.username, role: session.role,
      },
    });

    // Post opening stock to GL (non-blocking per line)
    try {
      const { postOpeningStockToGL } = await import('./inventory-gl-actions');
      for (const mov of results) {
        await postOpeningStockToGL({
          organizationId,
          item_id: mov.item_id,
          quantity: mov.quantity_in,
          unit_cost: mov.unit_cost,
          store_id,
          source_id: mov.id.toString(),
        });
      }
    } catch (glErr: unknown) {
      console.error('Opening stock GL posting error:', (glErr as Error).message);
    }

    revalidatePath(`/inventory/stores/${store_id}`);
    return { success: true, created: results.length };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ========================================
// Stock Valuation Summary
// ========================================

export async function getStoreValuationSummary(store_id?: number) {
  try {
    const { db, organizationId } = await requireInventoryContext(INVENTORY_FINANCE_ROLES);
    const where: any = { organizationId };
    if (store_id) where.store_id = store_id;
    const stocks = await db.storeStock.findMany({
      where,
      include: {
        item: { select: { name: true, item_code: true, item_type: true } },
        store: { select: { name: true } },
      },
    });
    const totalValue = stocks.reduce(
      (sum: number, s: any) => sum + s.quantity_on_hand * s.avg_unit_cost, 0
    );
    const byType = stocks.reduce((acc: Record<string, number>, s: any) => {
      const t = s.item.item_type;
      acc[t] = (acc[t] ?? 0) + s.quantity_on_hand * s.avg_unit_cost;
      return acc;
    }, {});
    return { success: true, data: { totalValue, byType, stockCount: stocks.length } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
