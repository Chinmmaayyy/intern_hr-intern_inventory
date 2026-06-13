import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/db';

/**
 * Monthly cron job to recalculate reorder points based on average daily consumption.
 * Auth: X-Cron-Secret header or bypassed in development
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const orgs = await prisma.organization.findMany({
      where: { is_active: true },
      select: { id: true },
    });

    let totalUpdated = 0;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const org of orgs) {
      const configRow = await prisma.moduleConfig.findFirst({
        where: { organizationId: org.id, module_key: 'inventory' }
      });
      if (!configRow || !configRow.enabled) {
        continue;
      }

      const config = configRow.config_json as any;
      const leadTime = config?.rop_lead_time_days ?? 7;
      const safetyStock = config?.rop_safety_stock ?? 0;

      // Group consumption movements by store and item
      const consumptionSums = await prisma.inventoryMovement.groupBy({
        by: ['store_id', 'item_id'],
        where: {
          organizationId: org.id,
          movement_type: { in: ['CONSUMPTION', 'PATIENT_CHARGE'] },
          created_at: { gte: thirtyDaysAgo }
        },
        _sum: {
          quantity_out: true
        }
      });

      const settings = await prisma.storeItemSetting.findMany({
        where: { organizationId: org.id },
      });

      for (const setting of settings) {
        const sumRecord = consumptionSums.find(
          c => c.store_id === setting.store_id && c.item_id === setting.item_id
        );
        const totalQty = sumRecord?._sum?.quantity_out || 0;
        const avgDaily = totalQty / 30;
        const suggestedROP = Math.ceil(avgDaily * leadTime + safetyStock);

        if (suggestedROP !== setting.reorder_point) {
          await prisma.storeItemSetting.update({
            where: { id: setting.id },
            data: { reorder_point: suggestedROP }
          });
          totalUpdated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      settings_updated: totalUpdated
    });
  } catch (e: unknown) {
    const err = e as Error;
    console.error('ROP assist recalc cron error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
