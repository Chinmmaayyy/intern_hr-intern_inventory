import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/db';

/**
 * Daily cron job to check reorder levels and auto-create Draft Purchase Requisitions/Indents.
 * Called by: external scheduler (e.g. Vercel Cron / GitHub Actions)
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

    let totalPrsCreated = 0;
    let totalIndentsCreated = 0;

    for (const org of orgs) {
      const settings = await prisma.storeItemSetting.findMany({
        where: { organizationId: org.id, auto_indent: true },
        include: {
          item: { select: { id: true, name: true, status: true } },
          store: { select: { id: true, name: true, parent_store_id: true, cost_center: true } },
        },
      });

      for (const setting of settings) {
        if (setting.item.status !== 'Active') continue;

        // Compute available stock: on-hand - quarantined
        const stockItems = await prisma.storeStock.findMany({
          where: { store_id: setting.store_id, item_id: setting.item_id, organizationId: org.id },
          include: { batch: { select: { is_quarantined: true } } }
        });

        let onHand = 0;
        let quarantined = 0;
        for (const s of stockItems) {
          onHand += s.quantity_on_hand;
          if (s.batch?.is_quarantined) {
            quarantined += s.quantity_on_hand;
          }
        }

        const netOnHand = Math.max(0, onHand - quarantined);

        if (netOnHand <= setting.reorder_point) {
          const suggestedQty = Math.max(setting.max_level - netOnHand, setting.par_level);
          const finalQty = suggestedQty > 0 ? suggestedQty : setting.par_level;

          if (setting.store.parent_store_id) {
            // Sub-store: Generate draft Indent on parent store
            const existingIndent = await prisma.indent.findFirst({
              where: {
                organizationId: org.id,
                from_store_id: setting.store_id,
                to_store_id: setting.store.parent_store_id,
                status: { in: ['Draft', 'Submitted', 'Approved', 'Partially Issued'] },
                items: { some: { item_id: setting.item_id } }
              }
            });

            if (!existingIndent) {
              const indentNumber = `IND-AUTO-${Date.now()}-${setting.store_id}-${setting.item_id}`;
              await prisma.indent.create({
                data: {
                  indent_number: indentNumber,
                  from_store_id: setting.store_id,
                  to_store_id: setting.store.parent_store_id,
                  cost_center: setting.store.cost_center || 'CC-AUTO',
                  priority: netOnHand === 0 ? 'URGENT' : 'NORMAL',
                  status: 'Draft',
                  organizationId: org.id,
                  items: {
                    create: [{
                      item_id: setting.item_id,
                      qty_requested: finalQty
                    }]
                  }
                }
              });
              totalIndentsCreated++;
            }
          } else {
            // Central Store: Generate draft Purchase Requisition
            const existingPR = await prisma.purchaseRequisition.findFirst({
              where: {
                organizationId: org.id,
                requesting_store_id: setting.store_id,
                status: { in: ['Draft', 'Submitted', 'Approved'] },
                items: { some: { item_id: setting.item_id } },
              },
            });

            if (!existingPR) {
              const prNumber = `PR-AUTO-${Date.now()}-${setting.store_id}-${setting.item_id}`;
              await prisma.purchaseRequisition.create({
                data: {
                  pr_number: prNumber,
                  requesting_store_id: setting.store_id,
                  priority: netOnHand === 0 ? 'URGENT' : 'NORMAL',
                  status: 'Draft',
                  organizationId: org.id,
                  items: {
                    create: [{ item_id: setting.item_id, quantity: finalQty }],
                  },
                },
              });
              totalPrsCreated++;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      prs_created: totalPrsCreated,
      indents_created: totalIndentsCreated
    });
  } catch (e: unknown) {
    const err = e as Error;
    console.error('Reorder cron error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
