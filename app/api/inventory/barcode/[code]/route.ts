import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/db';
import { getSession } from '@/app/lib/session';

/**
 * GET /api/inventory/barcode/[code]
 * Lookup an item or batch by EAN barcode, item code, or batch number.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const organizationId = session.organization_id;
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization context' }, { status: 403 });
    }

    const { code: rawCode } = await params;
    const code = decodeURIComponent(rawCode).trim();

    // 1. Try barcode field
    let item = await prisma.itemMaster.findFirst({
      where: { organizationId, barcode: code },
      include: {
        category: { select: { id: true, name: true, item_type: true } },
        store_stocks: {
          include: {
            store: { select: { id: true, name: true, store_type: true } },
            batch: { select: { id: true, batch_no: true, expiry_date: true } },
          },
          where: { quantity_on_hand: { gt: 0 } },
        },
      },
    });

    // 2. Fallback: item_code
    if (!item) {
      item = await prisma.itemMaster.findFirst({
        where: { organizationId, item_code: code },
        include: {
          category: { select: { id: true, name: true, item_type: true } },
          store_stocks: {
            include: {
              store: { select: { id: true, name: true, store_type: true } },
              batch: { select: { id: true, batch_no: true, expiry_date: true } },
            },
            where: { quantity_on_hand: { gt: 0 } },
          },
        },
      });
    }

    // 3. Try batch number
    if (!item) {
      const batch = await prisma.itemBatch.findFirst({
        where: { organizationId, batch_no: code },
        include: {
          item: {
            include: {
              category: { select: { id: true, name: true } },
            },
          },
          store_stocks: {
            include: { store: { select: { id: true, name: true } } },
            where: { quantity_on_hand: { gt: 0 } },
          },
        },
      });
      if (batch) {
        return NextResponse.json({
          success: true,
          type: 'batch',
          data: {
            batch_id: batch.id,
            batch_no: batch.batch_no,
            expiry_date: batch.expiry_date,
            cost_price: batch.cost_price,
            is_quarantined: batch.is_quarantined,
            item: batch.item,
            store_stocks: batch.store_stocks,
          },
        });
      }
    }

    if (!item) {
      return NextResponse.json({ success: false, error: `No item found for: ${code}` }, { status: 404 });
    }

    const totalStock = (item.store_stocks as Array<{ quantity_on_hand: number }>).reduce(
      (s, ss) => s + ss.quantity_on_hand, 0
    );

    return NextResponse.json({ success: true, type: 'item', data: { ...item, total_stock: totalStock } });
  } catch (e: unknown) {
    const err = e as Error;
    console.error('Barcode lookup error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
