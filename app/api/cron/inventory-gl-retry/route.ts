import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/db';
import {
  postGrnToGL,
  postConsumptionToGL,
  postAdjustmentToGL,
  postWriteOffToGL,
} from '@/app/actions/inventory-gl-actions';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const unposted = await prisma.inventoryMovement.findMany({
      where: { gl_journal_id: null, movement_type: { not: 'OPENING' } },
      take: 100,
      orderBy: { created_at: 'asc' },
      include: { item: { select: { is_patient_chargeable: true } } },
    });

    let retried = 0;
    for (const mov of unposted) {
      try {
        if (!mov.source_id) continue;
        if (mov.movement_type === 'GRN_RECEIPT' && mov.source_type === 'GRN') {
          await postGrnToGL(parseInt(mov.source_id, 10));
        } else if (['CONSUMPTION', 'PATIENT_CHARGE'].includes(mov.movement_type)) {
          await postConsumptionToGL({
            organizationId: mov.organizationId,
            item_id: mov.item_id,
            quantity: mov.quantity_out,
            unit_cost: mov.unit_cost,
            store_id: mov.store_id,
            source_id: mov.source_id,
            is_patient_chargeable: mov.item?.is_patient_chargeable,
          });
        } else if (mov.movement_type.startsWith('ADJUSTMENT')) {
          await postAdjustmentToGL({
            organizationId: mov.organizationId,
            item_id: mov.item_id,
            quantity_delta: mov.movement_type === 'ADJUSTMENT_PLUS' ? mov.quantity_in : -mov.quantity_out,
            unit_cost: mov.unit_cost,
            store_id: mov.store_id,
            source_id: mov.source_id,
          });
        } else if (['DAMAGE_WRITEOFF', 'EXPIRY_WRITEOFF'].includes(mov.movement_type)) {
          await postWriteOffToGL({
            organizationId: mov.organizationId,
            item_id: mov.item_id,
            quantity: mov.quantity_out,
            unit_cost: mov.unit_cost,
            source_id: mov.source_id,
          });
        }
        retried++;
      } catch (e) {
        console.error(`GL retry failed for movement ${mov.id}:`, e);
      }
    }

    return NextResponse.json({ success: true, retried, pending: unposted.length });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
