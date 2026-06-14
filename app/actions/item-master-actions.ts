'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireInventoryContext } from '@/app/lib/inventory-context';

import {
  INVENTORY_READ_ROLES,
  INVENTORY_ADMIN_ROLES,
  INVENTORY_CATEGORY_ROLES,
  ITEM_CREATE_ROLES,
  ITEM_APPROVE_ROLES
} from '@/app/lib/inventory-roles';

function serialize<T>(d: T): T {
  return JSON.parse(JSON.stringify(d, (_, v) =>
    typeof v === 'object' && v !== null && v?.constructor?.name === 'Decimal' ? Number(v) : v));
}

// ========================================
// Zod Schemas
// ========================================

const itemCategorySchema = z.object({
  name: z.string().min(1),
  parent_id: z.number().int().positive().optional().nullable(),
  item_type: z.enum(['CONSUMABLE','REAGENT','IMPLANT','LINEN','STATIONERY','MAINTENANCE','EQUIPMENT_SPARE','FOOD_DIETARY','OTHER']),
  default_gst_rate: z.number().nonnegative().default(0),
  gl_inventory_account_id: z.string().optional().nullable(),
  gl_expense_account_id: z.string().optional().nullable(),
  gl_cogs_account_id: z.string().optional().nullable(),
});

const itemMasterSchema = z.object({
  item_code: z.string().optional().nullable(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  category_id: z.number().int().positive(),
  item_type: z.enum(['CONSUMABLE','REAGENT','IMPLANT','LINEN','STATIONERY','MAINTENANCE','EQUIPMENT_SPARE','FOOD_DIETARY','OTHER']),
  base_uom: z.string().min(1),
  purchase_uom: z.string().min(1),
  uom_conversion: z.number().positive().default(1),
  hsn_sac_code: z.string().optional().nullable(),
  gst_rate: z.number().nonnegative().default(0),
  std_purchase_price: z.number().nonnegative().default(0),
  selling_price: z.number().nonnegative().default(0),
  mrp: z.number().nonnegative().default(0),
  is_batch_tracked: z.boolean().default(false),
  is_expiry_tracked: z.boolean().default(false),
  is_patient_chargeable: z.boolean().default(false),
  charge_catalog_id: z.number().int().positive().optional().nullable(),
  is_returnable: z.boolean().default(true),
  is_cold_chain: z.boolean().default(false),
  abc_class: z.enum(['A','B','C']).optional().nullable(),
  ved_class: z.enum(['V','E','D']).optional().nullable(),
  min_level: z.number().int().nonnegative().default(0),
  max_level: z.number().int().nonnegative().default(0),
  reorder_point: z.number().int().nonnegative().default(0),
  lead_time_days: z.number().int().nonnegative().default(0),
  barcode: z.string().optional().nullable(),
  status: z.enum(['Draft','Active','Discontinued']).default('Active'),
});

const itemVendorSchema = z.object({
  item_id: z.number().int().positive(),
  vendor_id: z.number().int().positive(),
  vendor_item_code: z.string().optional().nullable(),
  last_price: z.number().nonnegative().default(0),
  preference_rank: z.number().int().positive().default(1),
});

// ========================================
// Item Category Actions
// ========================================

export async function listItemCategories(opts?: { search?: string }) {
  try {
    const { db, organizationId } = await requireInventoryContext(INVENTORY_READ_ROLES);
    const where: any = { organizationId };
    if (opts?.search?.trim()) {
      where.name = { contains: opts.search, mode: 'insensitive' };
    }
    const categories = await db.itemCategory.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    });
    return { success: true, data: serialize(categories) };
  } catch (e: any) {
    return { success: false, error: e.message, data: [] };
  }
}

export async function createItemCategory(input: unknown) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(INVENTORY_CATEGORY_ROLES);
    const data = itemCategorySchema.parse(input);
    const row = await db.itemCategory.create({
      data: { ...data, organizationId },
    });
    await db.system_audit_logs.create({
      data: {
        action: 'CREATE_ITEM_CATEGORY', module: 'inventory',
        details: `Created category: ${data.name}`,
        organizationId, user_id: session.id, username: session.username, role: session.role,
      },
    });
    revalidatePath('/admin/inventory/items');
    return { success: true, data: serialize(row) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateItemCategory(id: number, input: unknown) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(INVENTORY_CATEGORY_ROLES);
    const data = itemCategorySchema.partial().parse(input);
    const row = await db.itemCategory.update({
      where: { id } as any,
      data,
    });
    await db.system_audit_logs.create({
      data: {
        action: 'UPDATE_ITEM_CATEGORY', module: 'inventory',
        details: `Updated category ID: ${id}`,
        organizationId, user_id: session.id, username: session.username, role: session.role,
      },
    });
    revalidatePath('/admin/inventory/items');
    return { success: true, data: serialize(row) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ========================================
// Item Master Actions
// ========================================

export async function listItems(opts?: {
  search?: string;
  category_id?: number;
  item_type?: string;
  status?: string;
  abc_class?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const { db, organizationId } = await requireInventoryContext(INVENTORY_READ_ROLES);
    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 25;
    const where: any = { organizationId };
    if (opts?.search?.trim()) {
      where.OR = [
        { name: { contains: opts.search, mode: 'insensitive' } },
        { item_code: { contains: opts.search, mode: 'insensitive' } },
        { barcode: { contains: opts.search, mode: 'insensitive' } },
      ];
    }
    if (opts?.category_id) where.category_id = opts.category_id;
    if (opts?.item_type) where.item_type = opts.item_type;
    if (opts?.status) where.status = opts.status;
    if (opts?.abc_class) where.abc_class = opts.abc_class;

    const [rows, total] = await Promise.all([
      db.itemMaster.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: { select: { id: true, name: true, item_type: true } },
          store_stocks: { select: { quantity_on_hand: true, store_id: true } },
        },
      }),
      db.itemMaster.count({ where }),
    ]);

    const items = rows.map((item: typeof rows[number]) => ({
      ...item,
      total_stock: item.store_stocks.reduce(
        (sum: number, s: { quantity_on_hand: number }) => sum + s.quantity_on_hand, 0
      ),
    }));

    return {
      success: true,
      data: { items: serialize(items), total, totalPages: Math.ceil(total / limit), page },
    };
  } catch (e: any) {
    return { success: false, error: e.message, data: { items: [], total: 0, totalPages: 0, page: 1 } };
  }
}

export async function getItemById(id: number) {
  try {
    const { db, organizationId } = await requireInventoryContext(INVENTORY_READ_ROLES);
    const item = await db.itemMaster.findFirst({
      where: { id, organizationId },
      include: {
        category: true,
        vendors: {
          include: {
            vendor: { select: { id: true, vendor_name: true, vendor_code: true } },
          },
        },
        batches: {
          where: { is_quarantined: false },
          orderBy: { expiry_date: 'asc' },
        },
        store_stocks: {
          include: {
            store: { select: { id: true, name: true, store_type: true } },
          },
        },
        store_settings: {
          include: { store: { select: { id: true, name: true } } },
        },
      },
    });
    if (!item) return { success: false, error: 'Item not found' };
    return { success: true, data: serialize(item) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function createItem(input: unknown) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(ITEM_CREATE_ROLES);
    const data = itemMasterSchema.parse(input);

    // Duplicate detection: name + base_uom
    const duplicate = await db.itemMaster.findFirst({
      where: {
        name: { equals: data.name.trim(), mode: 'insensitive' },
        base_uom: { equals: data.base_uom.trim(), mode: 'insensitive' },
        organizationId
      }
    });
    if (duplicate) {
      return { success: false, error: `Item with name '${data.name}' and base UOM '${data.base_uom}' already exists.` };
    }

    // Auto-generate item_code if not specified
    let itemCode = data.item_code;
    if (!itemCode) {
      const prefix = (data.item_type || 'OTHER').substring(0, 3).toUpperCase();
      const count = await db.itemMaster.count({
        where: {
          item_code: { startsWith: `${prefix}-` },
          organizationId
        }
      });
      itemCode = `${prefix}-${(count + 1).toString().padStart(4, '0')}`;
    }

    const existingCode = await db.itemMaster.findFirst({
      where: { item_code: itemCode, organizationId },
    });
    if (existingCode) return { success: false, error: `Item code '${itemCode}' already exists` };

    // Maker-checker status: store_manager -> Draft, admin -> Active (default)
    const status = session.role === 'admin' ? 'Active' : 'Draft';

    const insertData: any = { ...data, item_code: itemCode, status, organizationId };
    if (status === 'Draft') {
      insertData.pending_std_purchase_price = data.std_purchase_price;
      insertData.pending_selling_price = data.selling_price;
      insertData.pending_mrp = data.mrp;
      insertData.std_purchase_price = 0;
      insertData.selling_price = 0;
      insertData.mrp = 0;
    }

    const row = await db.itemMaster.create({
      data: insertData,
    });

    await db.system_audit_logs.create({
      data: {
        action: 'CREATE_ITEM', module: 'inventory',
        details: `Created item: ${data.name} (${itemCode}) as status '${status}'`,
        organizationId, user_id: session.id, username: session.username, role: session.role,
      },
    });
    revalidatePath('/admin/inventory/items');
    return { success: true, data: serialize(row) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateItem(id: number, input: unknown) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(ITEM_CREATE_ROLES);
    const data = itemMasterSchema.partial().parse(input);

    const currentItem = await db.itemMaster.findUnique({
      where: { id, organizationId }
    });
    if (!currentItem) return { success: false, error: 'Item not found' };

    let updateData: any = { ...data };

    // Intercept price updates if user is store_manager
    if (session.role === 'store_manager') {
      const hasPriceChanges = 
        (data.std_purchase_price !== undefined && data.std_purchase_price !== currentItem.std_purchase_price) ||
        (data.selling_price !== undefined && data.selling_price !== currentItem.selling_price) ||
        (data.mrp !== undefined && data.mrp !== currentItem.mrp);

      if (hasPriceChanges) {
        if (data.std_purchase_price !== undefined) {
          updateData.pending_std_purchase_price = data.std_purchase_price;
          delete updateData.std_purchase_price;
        }
        if (data.selling_price !== undefined) {
          updateData.pending_selling_price = data.selling_price;
          delete updateData.selling_price;
        }
        if (data.mrp !== undefined) {
          updateData.pending_mrp = data.mrp;
          delete updateData.mrp;
        }

        await db.system_audit_logs.create({
          data: {
            action: 'PROP_PRICE_CHANGE', module: 'inventory',
            details: `Proposed price changes for item ID ${id}: std_purchase_price=${data.std_purchase_price}, selling_price=${data.selling_price}, mrp=${data.mrp}`,
            organizationId, user_id: session.id, username: session.username, role: session.role,
          },
        });
      }
    }

    const row = await db.itemMaster.update({
      where: { id } as any,
      data: updateData,
    });

    await db.system_audit_logs.create({
      data: {
        action: 'UPDATE_ITEM', module: 'inventory',
        details: `Updated item ID: ${id}`,
        organizationId, user_id: session.id, username: session.username, role: session.role,
      },
    });
    revalidatePath('/admin/inventory/items');
    return { success: true, data: serialize(row) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function approveItem(id: number) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(ITEM_APPROVE_ROLES);
    const item = await db.itemMaster.findUnique({
      where: { id, organizationId }
    });
    if (!item) return { success: false, error: 'Item not found' };

    const updateData: any = { status: 'Active' };

    // Apply pending price updates
    if (item.pending_std_purchase_price !== null) {
      updateData.std_purchase_price = item.pending_std_purchase_price;
      updateData.pending_std_purchase_price = null;
    }
    if (item.pending_selling_price !== null) {
      updateData.selling_price = item.pending_selling_price;
      updateData.pending_selling_price = null;
    }
    if (item.pending_mrp !== null) {
      updateData.mrp = item.pending_mrp;
      updateData.pending_mrp = null;
    }

    const row = await db.itemMaster.update({
      where: { id } as any,
      data: updateData,
    });

    await db.system_audit_logs.create({
      data: {
        action: 'APPROVE_ITEM', module: 'inventory',
        details: `Approved item ID: ${id} and applied pending price updates.`,
        organizationId, user_id: session.id, username: session.username, role: session.role,
      },
    });
    revalidatePath('/admin/inventory/items');
    return { success: true, data: serialize(row) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function discontinueItem(id: number, reason: string) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(INVENTORY_ADMIN_ROLES);

    // Discontinue stock check guard
    const stocks = await db.storeStock.findMany({
      where: { item_id: id, organizationId }
    });
    const totalQty = stocks.reduce((sum: number, s: any) => sum + s.quantity_on_hand, 0);
    if (totalQty > 0) {
      return { success: false, error: `Cannot discontinue: item has a total stock of ${totalQty} units on hand.` };
    }

    const openIndents = await db.indentItem.count({
      where: {
        item_id: id,
        indent: { organizationId, status: { in: ['Draft','Submitted','Approved','Partially Issued'] } },
      },
    });
    if (openIndents > 0) return { success: false, error: 'Cannot discontinue: item has open indents' };

    const row = await db.itemMaster.update({
      where: { id } as any,
      data: { status: 'Discontinued' },
    });
    await db.system_audit_logs.create({
      data: {
        action: 'DISCONTINUE_ITEM', module: 'inventory',
        details: `Discontinued item ID: ${id}. Reason: ${reason}`,
        organizationId, user_id: session.id, username: session.username, role: session.role,
      },
    });
    revalidatePath('/admin/inventory/items');
    return { success: true, data: serialize(row) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}


// ========================================
// Bulk Import
// ========================================

export async function importItems(rows: Record<string, string>[], dryRun = true) {
  try {
    const { db, organizationId, session } = await requireInventoryContext(INVENTORY_ADMIN_ROLES);
    const results: Array<{ row: number; status: 'ok' | 'error'; message?: string }> = [];
    const toCreate: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      try {
        const category = await db.itemCategory.findFirst({
          where: { organizationId, name: { equals: (raw['category'] || '').trim(), mode: 'insensitive' } },
        });
        if (!category) throw new Error(`Category '${raw['category']}' not found`);
        const parsed = itemMasterSchema.parse({
          item_code: raw['item_code'],
          name: raw['name'],
          description: raw['description'] || null,
          category_id: category.id,
          item_type: (raw['item_type'] || 'CONSUMABLE').toUpperCase(),
          base_uom: raw['base_uom'] || 'EA',
          purchase_uom: raw['purchase_uom'] || raw['base_uom'] || 'EA',
          uom_conversion: parseFloat(raw['uom_conversion'] || '1') || 1,
          hsn_sac_code: raw['hsn_sac_code'] || null,
          gst_rate: parseFloat(raw['gst_rate'] || '0'),
          std_purchase_price: parseFloat(raw['std_purchase_price'] || '0'),
          selling_price: parseFloat(raw['selling_price'] || '0'),
          mrp: parseFloat(raw['mrp'] || '0'),
          is_batch_tracked: raw['is_batch_tracked']?.toLowerCase() === 'yes',
          is_expiry_tracked: raw['is_expiry_tracked']?.toLowerCase() === 'yes',
          is_patient_chargeable: raw['is_patient_chargeable']?.toLowerCase() === 'yes',
          is_returnable: (raw['is_returnable'] || 'yes').toLowerCase() !== 'no',
          min_level: parseInt(raw['min_level'] || '0'),
          max_level: parseInt(raw['max_level'] || '0'),
          reorder_point: parseInt(raw['reorder_point'] || '0'),
          lead_time_days: parseInt(raw['lead_time_days'] || '0'),
          barcode: raw['barcode'] || null,
          status: 'Active',
        });
        toCreate.push({ ...parsed, organizationId });
        results.push({ row: i + 2, status: 'ok' });
      } catch (err: any) {
        results.push({ row: i + 2, status: 'error', message: err.message });
      }
    }

    const errors = results.filter(r => r.status === 'error');
    if (dryRun || errors.length > 0) {
      return { success: errors.length === 0, dryRun: true, results, created: 0, errors: errors.length };
    }

    let created = 0;
    for (const item of toCreate) {
      const existing = await db.itemMaster.findFirst({
        where: { item_code: item.item_code, organizationId },
      });
      if (!existing) {
        await db.itemMaster.create({ data: item });
        created++;
      }
    }
    await db.system_audit_logs.create({
      data: {
        action: 'IMPORT_ITEMS', module: 'inventory',
        details: `Imported ${created} items`,
        organizationId, user_id: session.id, username: session.username, role: session.role,
      },
    });
    revalidatePath('/admin/inventory/items');
    return { success: true, dryRun: false, results, created, errors: 0 };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ========================================
// Item Vendor Mapping
// ========================================

export async function upsertItemVendor(input: unknown) {
  try {
    const { db, organizationId } = await requireInventoryContext(INVENTORY_ADMIN_ROLES);
    const data = itemVendorSchema.parse(input);
    const row = await db.itemVendor.upsert({
      where: { item_id_vendor_id: { item_id: data.item_id, vendor_id: data.vendor_id } },
      create: { ...data, organizationId },
      update: {
        vendor_item_code: data.vendor_item_code,
        last_price: data.last_price,
        preference_rank: data.preference_rank,
      },
    });
    revalidatePath(`/inventory/items/${data.item_id}`);
    return { success: true, data: serialize(row) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function removeItemVendor(item_id: number, vendor_id: number) {
  try {
    const { db } = await requireInventoryContext(INVENTORY_ADMIN_ROLES);
    await db.itemVendor.delete({
      where: { item_id_vendor_id: { item_id, vendor_id } },
    });
    revalidatePath(`/inventory/items/${item_id}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
