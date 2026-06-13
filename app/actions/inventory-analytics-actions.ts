'use server';
import { requireTenantContext } from '@/backend/tenant';

function serialize<T>(d: T): T {
  return JSON.parse(JSON.stringify(d, (_, v) =>
    typeof v === 'object' && v !== null && v?.constructor?.name === 'Decimal' ? Number(v) : v));
}

// ========================================
// ABC/VED Analysis
// ========================================

export async function computeAbcVedMatrix() {
  try {
    const { db, organizationId } = await requireTenantContext();
    const twelveMthAgo = new Date();
    twelveMthAgo.setFullYear(twelveMthAgo.getFullYear() - 1);

    const movements = await db.inventoryMovement.findMany({
      where: {
        organizationId,
        movement_type: { in: ['ISSUE','INDENT_ISSUE','CONSUMPTION','PATIENT_CHARGE'] },
        created_at: { gte: twelveMthAgo },
      },
      select: { item_id: true, quantity_out: true, unit_cost: true },
    });

    const consumptionMap = new Map<number, number>();
    for (const m of movements) {
      consumptionMap.set(m.item_id, (consumptionMap.get(m.item_id) ?? 0) + m.quantity_out * m.unit_cost);
    }

    const sorted = Array.from(consumptionMap.entries()).sort((a, b) => b[1] - a[1]);
    const totalValue = sorted.reduce((s, [, v]) => s + v, 0);
    let cumulative = 0;
    const classifications: Array<{ item_id: number; annual_value: number; abc_class: string }> = [];
    for (const [item_id, value] of sorted) {
      cumulative += value;
      const pct = totalValue > 0 ? cumulative / totalValue : 0;
      classifications.push({
        item_id,
        annual_value: value,
        abc_class: pct <= 0.7 ? 'A' : pct <= 0.9 ? 'B' : 'C',
      });
    }

    // Update items with new ABC class
    for (const c of classifications) {
      await db.itemMaster.updateMany({
        where: { id: c.item_id, organizationId },
        data: { abc_class: c.abc_class },
      });
    }

    return { success: true, data: { classifications, totalValue, itemCount: classifications.length } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ========================================
// Slow Moving / Non-Moving Stock
// ========================================

export async function getSlowMovingStocks(days = 90) {
  try {
    const { db, organizationId } = await requireTenantContext();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const activeStocks = await db.storeStock.findMany({
      where: { organizationId, quantity_on_hand: { gt: 0 } },
      include: {
        item: { select: { id: true, name: true, item_code: true, abc_class: true } },
        store: { select: { name: true } },
      },
    });

    const recentMoved = await db.inventoryMovement.groupBy({
      by: ['item_id'],
      where: {
        organizationId,
        movement_type: { in: ['ISSUE','INDENT_ISSUE','CONSUMPTION','PATIENT_CHARGE'] },
        created_at: { gte: cutoff },
      },
      _count: { item_id: true },
    });
    const movedSet = new Set(recentMoved.map((m: any) => m.item_id));

    const slowMoving = activeStocks
      .filter((s: any) => !movedSet.has(s.item_id))
      .map((s: any) => ({
        store: s.store.name,
        item_code: s.item.item_code,
        item_name: s.item.name,
        abc_class: s.item.abc_class,
        quantity_on_hand: s.quantity_on_hand,
        stock_value: s.quantity_on_hand * s.avg_unit_cost,
      }));

    return {
      success: true,
      data: { slow_moving: serialize(slowMoving), period_days: days, count: slowMoving.length },
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ========================================
// Expiry Forecast
// ========================================

export async function getExpiryForecast(days = 90) {
  try {
    const { db, organizationId } = await requireTenantContext();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);

    const nearExpiry = await db.itemBatch.findMany({
      where: {
        organizationId,
        is_quarantined: false,
        expiry_date: { gte: new Date(), lte: cutoffDate },
      },
      include: {
        item: { select: { id: true, name: true, item_code: true } },
        store_stocks: {
          include: { store: { select: { name: true } } },
        },
      },
      orderBy: { expiry_date: 'asc' },
    });

    const result = nearExpiry.map((b: any) => ({
      batch_no: b.batch_no,
      expiry_date: b.expiry_date,
      item_code: b.item.item_code,
      item_name: b.item.name,
      total_qty: b.store_stocks.reduce((s: number, ss: any) => s + ss.quantity_on_hand, 0),
      stores: b.store_stocks.map((ss: any) => ({ store: ss.store.name, qty: ss.quantity_on_hand })),
    }));

    return { success: true, data: { near_expiry: serialize(result), days, count: result.length } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ========================================
// Inventory Dashboard Summary
// ========================================

export async function getInventoryDashboardSummary() {
  try {
    const { db, organizationId } = await requireTenantContext();
    const today = new Date();
    const in30Days = new Date(); in30Days.setDate(today.getDate() + 30);
    const in90Days = new Date(); in90Days.setDate(today.getDate() + 90);

    const [totalItems, activeStores, expiring30, expiring90, zeroStock] = await Promise.all([
      db.itemMaster.count({ where: { organizationId, status: 'Active' } }),
      db.store.count({ where: { organizationId, is_active: true } }),
      db.itemBatch.count({
        where: {
          organizationId, is_quarantined: false,
          expiry_date: { gte: today, lte: in30Days },
        },
      }),
      db.itemBatch.count({
        where: {
          organizationId, is_quarantined: false,
          expiry_date: { gte: today, lte: in90Days },
        },
      }),
      db.storeStock.count({ where: { organizationId, quantity_on_hand: 0 } }),
    ]);

    // Calculate total stock value
    const allStocks = await db.storeStock.findMany({
      where: { organizationId },
      select: { quantity_on_hand: true, avg_unit_cost: true },
    });
    const totalStockValue = allStocks.reduce(
      (s: number, st: any) => s + st.quantity_on_hand * st.avg_unit_cost, 0
    );

    // Items below reorder point (use store item settings)
    const belowReorder = await db.storeItemSetting.count({
      where: {
        organizationId,
        store: { is_active: true },
        item: { status: 'Active' },
      },
    });

    return {
      success: true,
      data: {
        totalItems,
        activeStores,
        totalStockValue: Math.round(totalStockValue * 100) / 100,
        expiringIn30Days: expiring30,
        expiringIn90Days: expiring90,
        zeroStockCount: zeroStock,
        autoIndentConfigured: belowReorder,
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ========================================
// Barcode / Item Lookup
// ========================================

export async function lookupItemByBarcode(barcode: string) {
  try {
    const { db, organizationId } = await requireTenantContext();
    // Try item master barcode first
    const item = await db.itemMaster.findFirst({
      where: { organizationId, barcode },
      include: {
        category: { select: { name: true } },
        store_stocks: {
          include: { store: { select: { id: true, name: true } }, batch: { select: { batch_no: true, expiry_date: true } } },
        },
      },
    });
    if (item) return { success: true, type: 'item', data: serialize(item) };

    // Try item_code as fallback
    const byCode = await db.itemMaster.findFirst({
      where: { organizationId, item_code: barcode },
      include: { category: { select: { name: true } } },
    });
    if (byCode) return { success: true, type: 'item', data: serialize(byCode) };

    return { success: false, error: 'Item not found for this barcode/code' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
