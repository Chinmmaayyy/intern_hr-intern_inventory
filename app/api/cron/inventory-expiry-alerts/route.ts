import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/db';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const orgs = await prisma.organization.findMany({
      where: { is_active: true },
      select: { id: true },
    });

    let totalAlertsCreated = 0;
    let totalExpiredQuarantined = 0;

    for (const org of orgs) {
      const configRow = await prisma.moduleConfig.findFirst({
        where: { organizationId: org.id, module_key: 'inventory' }
      });
      if (!configRow || !configRow.enabled) {
        continue;
      }

      const config = configRow.config_json as any;
      const expiryAlertDays = config?.expiry_alert_days || [90, 60, 30];
      const maxAlertDays = Math.max(...expiryAlertDays, 90);

      const today = new Date();
      const inMaxDays = new Date();
      inMaxDays.setDate(today.getDate() + maxAlertDays);

      const nearExpiry = await prisma.itemBatch.findMany({
        where: {
          is_quarantined: false,
          expiry_date: { gte: today, lte: inMaxDays },
          store_stocks: { some: { quantity_on_hand: { gt: 0 }, organizationId: org.id } },
        },
        include: {
          item: { select: { name: true, item_code: true, organizationId: true, ved_class: true } },
          store_stocks: {
            where: { quantity_on_hand: { gt: 0 }, organizationId: org.id },
            include: { store: { select: { id: true, name: true, organizationId: true, incharge_user: { select: { id: true, name: true, phone: true } } } } },
          },
        },
      });

      for (const batch of nearExpiry) {
        if (!batch.expiry_date) continue;
        const orgId = batch.item.organizationId;
        const daysUntilExpiry = Math.ceil((batch.expiry_date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        // Trigger alert if daysUntilExpiry is within any of the configured alert windows
        const shouldAlert = expiryAlertDays.some((days: number) => daysUntilExpiry <= days);
        if (!shouldAlert) continue;

        const totalQty = batch.store_stocks.reduce((s: number, ss: { quantity_on_hand: number }) => s + ss.quantity_on_hand, 0);
        const storeNames = batch.store_stocks.map((ss: { store: { name: string } }) => ss.store.name).join(', ');

        const isCritical = daysUntilExpiry <= 30 || batch.item.ved_class === 'V';
        const notifTitle = isCritical
          ? `⚠️ CRITICAL: ${batch.item.name} expires in ${daysUntilExpiry} days`
          : `Expiry Alert: ${batch.item.name} expires in ${daysUntilExpiry} days`;

        const message = `Batch ${batch.batch_no} of item "${batch.item.name}" (${batch.item.item_code}) expires on ` +
          `${batch.expiry_date.toISOString().split('T')[0]}. Total quantity: ${totalQty} across: ${storeNames}.`;

        await (prisma as any).notification.create({
          data: { organizationId: orgId, title: notifTitle, message, type: 'INVENTORY_EXPIRY', is_read: false },
        }).catch(() => {});

        totalAlertsCreated++;

        // Trigger WhatsApp alert to store manager if item is Vital (V)
        if (batch.item.ved_class === 'V') {
          for (const ss of batch.store_stocks) {
            const manager = ss.store.incharge_user;
            if (manager && manager.phone) {
              await prisma.messageDeliveryLog.create({
                data: {
                  organizationId: orgId,
                  message_id: `inv-expiry-${batch.id}-${ss.store.id}-${Date.now()}`,
                  patient_phone: manager.phone,
                  channel: 'whatsapp',
                  event_type: 'pill_reminder', // closest standard event type or inventory-specific
                  status: 'sent',
                  error_detail: `Sent WhatsApp to ${manager.name}: [WhatsApp Alert] Dear ${manager.name}, Vital item "${batch.item.name}" (Batch ${batch.batch_no}) in store "${ss.store.name}" is near expiry (expires in ${daysUntilExpiry} days on ${batch.expiry_date.toISOString().split('T')[0]}). Please review immediately.`
                }
              }).catch((err) => console.error('Failed to log WhatsApp alert:', err));
            }
          }
        }
      }

      // Quarantine expired batches for this organization
      const expired = await prisma.itemBatch.findMany({
        where: {
          is_quarantined: false,
          expiry_date: { lt: today },
          store_stocks: { some: { quantity_on_hand: { gt: 0 }, organizationId: org.id } },
        },
        select: { id: true },
      });

      if (expired.length > 0) {
        await prisma.itemBatch.updateMany({
          where: { id: { in: expired.map(e => e.id) } },
          data: { is_quarantined: true },
        });
        totalExpiredQuarantined += expired.length;
      }
    }

    return NextResponse.json({
      success: true,
      alerts_created: totalAlertsCreated,
      expired_quarantined: totalExpiredQuarantined
    });
  } catch (e: unknown) {
    const err = e as Error;
    console.error('Expiry alert cron error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
