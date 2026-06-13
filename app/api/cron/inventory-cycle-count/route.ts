import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/db';

/** Schedule cycle count tasks by ABC class: A=monthly, B=quarterly, C=half-yearly */
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

    let tasksCreated = 0;
    const now = new Date();
    const month = now.getMonth();
    const isQuarterStart = [0, 3, 6, 9].includes(month);
    const isHalfYear = month === 0 || month === 6;

    for (const org of orgs) {
      const config = await prisma.moduleConfig.findFirst({
        where: { organizationId: org.id, module_key: 'inventory', enabled: true },
      });
      if (!config) continue;

      const abcFilter: string[] = ['A'];
      if (isQuarterStart) abcFilter.push('B');
      if (isHalfYear) abcFilter.push('C');

      const stores = await prisma.store.findMany({
        where: { organizationId: org.id, is_active: true },
        select: { id: true, name: true, incharge_user_id: true },
      });

      for (const store of stores) {
        const items = await prisma.itemMaster.findMany({
          where: { organizationId: org.id, status: 'Active', abc_class: { in: abcFilter } },
          select: { id: true },
        });
        if (items.length === 0) continue;

        const existing = await prisma.stockCountSession.findFirst({
          where: {
            organizationId: org.id,
            store_id: store.id,
            status: { in: ['Draft', 'Frozen', 'Counting', 'Review', 'Pending Approval'] },
            created_at: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
          },
        });
        if (existing) continue;

        const stocks = await prisma.storeStock.findMany({
          where: {
            organizationId: org.id,
            store_id: store.id,
            item_id: { in: items.map(i => i.id) },
            quantity_on_hand: { gt: 0 },
          },
        });
        if (stocks.length === 0) continue;

        await prisma.stockCountSession.create({
          data: {
            session_number: `CNT-CYCLE-${store.id}-${Date.now()}`,
            store_id: store.id,
            status: 'Counting',
            frozen_at: now,
            organizationId: org.id,
            lines: {
              create: stocks.map(s => ({
                item_id: s.item_id,
                batch_id: s.batch_id,
                book_qty: s.quantity_on_hand,
                counted_qty: 0,
              })),
            },
          },
        });

        if (store.incharge_user_id) {
          await prisma.notification.create({
            data: {
              organizationId: org.id,
              user_id: store.incharge_user_id,
              title: `Cycle count due: ${store.name}`,
              body: `A scheduled cycle count session has been created for ${store.name}. Please complete counting this month.`,
              type: 'INVENTORY_CYCLE_COUNT',
              is_read: false,
            },
          }).catch(() => {});
        }
        tasksCreated++;
      }
    }

    return NextResponse.json({ success: true, tasks_created: tasksCreated });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
