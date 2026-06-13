import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/db';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const today = new Date();
    const in90Days = new Date(); in90Days.setDate(today.getDate() + 90);

    const nearExpiry = await prisma.itemBatch.findMany({
      where: {
        is_quarantined: false,
        expiry_date: { gte: today, lte: in90Days },
        store_stocks: { some: { quantity_on_hand: { gt: 0 } } },
      },
      include: {
        item: { select: { name: true, item_code: true, organizationId: true } },
        store_stocks: {
          where: { quantity_on_hand: { gt: 0 } },
          include: { store: { select: { id: true, name: true, organizationId: true } } },
        },
      },
    });

    let alertsCreated = 0;

    for (const batch of nearExpiry) {
      const orgId = batch.item.organizationId;
      const daysUntilExpiry = Math.ceil((batch.expiry_date!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const totalQty = batch.store_stocks.reduce((s: number, ss: { quantity_on_hand: number }) => s + ss.quantity_on_hand, 0);
      const storeNames = batch.store_stocks.map((ss: { store: { name: string } }) => ss.store.name).join(', ');

      const notifTitle = daysUntilExpiry <= 30
        ? `⚠️ CRITICAL: ${batch.item.name} expires in ${daysUntilExpiry} days`
        : `Expiry Alert: ${batch.item.name} expires in ${daysUntilExpiry} days`;

      const message = `Batch ${batch.batch_no} of item "${batch.item.name}" (${batch.item.item_code}) expires on ` +
        `${batch.expiry_date!.toISOString().split('T')[0]}. Total quantity: ${totalQty} across: ${storeNames}.`;

      await (prisma as any).notification.create({
        data: { organizationId: orgId, title: notifTitle, message, type: 'INVENTORY_EXPIRY', is_read: false },
      }).catch(() => {});

      alertsCreated++;
    }

    // Quarantine expired batches
    const expired = await prisma.itemBatch.findMany({
      where: {
        is_quarantined: false,
        expiry_date: { lt: today },
        store_stocks: { some: { quantity_on_hand: { gt: 0 } } },
      },
      select: { id: true },
    });

    if (expired.length > 0) {
      await prisma.itemBatch.updateMany({
        where: { id: { in: expired.map(e => e.id) } },
        data: { is_quarantined: true },
      });
    }

    return NextResponse.json({ success: true, alerts_created: alertsCreated, expired_quarantined: expired.length });
  } catch (e: unknown) {
    const err = e as Error;
    console.error('Expiry alert cron error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
