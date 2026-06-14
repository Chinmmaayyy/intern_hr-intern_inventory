import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createSession } from '@/app/lib/session';
import { createItem, approveItem } from '@/app/actions/item-master-actions';
import {
  createPurchaseOrder,
  approvePurchaseOrder,
  createGRN,
  createPurchaseInvoice,
} from '@/app/actions/procurement-actions';
import { createIndent, issueIndentItems, receiveConfirmIndent } from '@/app/actions/indent-actions';
import { recordConsumption } from '@/app/actions/stock-actions';

const prisma = new PrismaClient();
const ORG = 'org-avani-default';

async function sessionFor(username: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new Error(`User ${username} not found`);
  const org = await prisma.organization.findUnique({ where: { id: user.organizationId } });
  if (!org) throw new Error('Organization not found');
  await createSession({
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name || '',
    specialty: user.specialty || null,
    organization_id: org.id,
    organization_slug: org.slug,
    organization_name: org.name,
  });
}

async function stockQty(storeCode: string, itemId: number) {
  const store = await prisma.store.findFirst({ where: { store_code: storeCode, organizationId: ORG } });
  if (!store) return 0;
  const rows = await prisma.storeStock.findMany({
    where: { store_id: store.id, item_id: itemId, organizationId: ORG },
  });
  return rows.reduce((s, r) => s + r.quantity_on_hand, 0);
}

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Not available in production' }, { status: 403 });
  }

  const steps: string[] = [];
  const errors: string[] = [];

  try {
    const central = await prisma.store.findFirst({ where: { store_code: 'CENTRAL', organizationId: ORG } });
    const ward = await prisma.store.findFirst({ where: { store_code: 'WARD-A-STORE', organizationId: ORG } });
    const vendor = await prisma.vendor.findFirst({ where: { organizationId: ORG, is_active: true } });
    const category = await prisma.itemCategory.findFirst({ where: { organizationId: ORG, item_type: 'CONSUMABLE' } });
    if (!central || !ward || !vendor || !category) {
      throw new Error('Missing seed data (stores, vendor, or category)');
    }

    const itemName = `Surgical Kit A E2E ${Date.now()}`;

    await sessionFor('store1');
    const createRes = await createItem({
      name: itemName,
      item_code: `SRG-E2E-${Date.now()}`,
      category_id: category.id,
      item_type: 'CONSUMABLE',
      base_uom: 'EA',
      purchase_uom: 'EA',
      uom_conversion: 1,
      std_purchase_price: 100,
      selling_price: 150,
      mrp: 150,
      is_batch_tracked: true,
      is_expiry_tracked: true,
      is_patient_chargeable: true,
      is_returnable: true,
      is_cold_chain: false,
      min_level: 0,
      max_level: 0,
      reorder_point: 10,
      lead_time_days: 0,
      gst_rate: 12,
      status: 'Draft',
    });
    if (!createRes.success) throw new Error(`Step 1: ${createRes.error}`);
    const itemId = (createRes as any).data.id;
    if ((createRes as any).data.status !== 'Draft') throw new Error('Step 1: item not Draft');
    steps.push('Step 1: Draft item created');

    await sessionFor('admin');
    const approveRes = await approveItem(itemId);
    if (!approveRes.success) throw new Error(`Step 2: ${approveRes.error}`);
    steps.push('Step 2: Item approved');

    await sessionFor('proc1');
    const poRes = await createPurchaseOrder({
      vendor_id: vendor.id,
      receiving_store_id: central.id,
      items: [{ item_id: itemId, quantity_ordered: 100, unit_price: 100, gst_rate: 12 }],
    });
    if (!poRes.success) throw new Error(`Step 3 PO: ${poRes.error}`);
    const poId = (poRes as any).data.id;
    const poApprove = await approvePurchaseOrder(poId);
    if (!poApprove.success) throw new Error(`Step 3 approve: ${poApprove.error}`);
    steps.push('Step 3: PO approved');

    await sessionFor('store1');
    const grnRes = await createGRN({
      po_id: poId,
      vendor_id: vendor.id,
      store_id: central.id,
      items: [{
        item_id: itemId,
        quantity_accepted: 100,
        quantity_rejected: 0,
        batch_no: 'BAT-SRG-01',
        expiry_date: new Date('2027-12-31').toISOString(),
        unit_price: 100,
        gst_rate: 12,
      }],
    });
    if (!grnRes.success) throw new Error(`Step 4: ${grnRes.error}`);
    if (await stockQty('CENTRAL', itemId) !== 100) throw new Error('Step 4: central stock not 100');
    steps.push('Step 4: GRN, central stock = 100');

    await sessionFor('proc1');
    const invRes = await createPurchaseInvoice({
      poId,
      grnId: (grnRes as any).data.id,
      invoiceNumber: `INV-E2E-${Date.now()}`,
      invoiceDate: new Date().toISOString(),
      lineItems: [{ item_id: itemId, quantity: 100, unit_price: 100, gst_rate: 12 }],
    });
    if (!invRes.success) throw new Error(`Step 5: ${invRes.error}`);
    if ((invRes as any).data.status !== 'Posted') throw new Error(`Step 5: invoice status ${(invRes as any).data.status}`);
    steps.push('Step 5: Invoice posted');

    await sessionFor('nurse1');
    const indentRes = await createIndent({
      from_store_id: ward.id,
      to_store_id: central.id,
      priority: 'NORMAL',
      items: [{ item_id: itemId, qty_requested: 20 }],
    });
    if (!indentRes.success) throw new Error(`Step 6: ${indentRes.error}`);
    const indentId = (indentRes as any).data.id;
    steps.push('Step 6: Indent approved');

    await sessionFor('store1');
    const issueRes = await issueIndentItems(indentId, [{ item_id: itemId, quantity: 20 }]);
    if (!issueRes.success) throw new Error(`Step 7 issue: ${issueRes.error}`);
    if (await stockQty('CENTRAL', itemId) !== 80) throw new Error('Step 7: central stock not 80');
    steps.push('Step 7a: Issued, central = 80');

    await sessionFor('nurse1');
    const recvRes = await receiveConfirmIndent(indentId, [{ item_id: itemId, quantity: 20 }]);
    if (!recvRes.success) throw new Error(`Step 7 receive: ${recvRes.error}`);
    if (await stockQty('WARD-A-STORE', itemId) !== 20) throw new Error('Step 7: ward stock not 20');
    steps.push('Step 7b: WARD-A stock = 20');

    const consumeRes = await recordConsumption({
      store_id: ward.id,
      item_id: itemId,
      quantity: 2,
      type: 'PATIENT',
      admission_id: 'adm-inventory-e2e',
    });
    if (!consumeRes.success) throw new Error(`Step 8: ${consumeRes.error}`);
    if (await stockQty('WARD-A-STORE', itemId) !== 18) throw new Error('Step 8: ward stock not 18');

    const billItem = await prisma.invoice_items.findFirst({
      where: {
        invoice: { admission_id: 'adm-inventory-e2e', organizationId: ORG },
        description: { contains: 'Consumable' },
      },
    });
    if (!billItem) throw new Error('Step 8: no patient charge on invoice');
    steps.push('Step 8: Consumption + patient charge');

    return NextResponse.json({ success: true, steps, itemId, itemName });
  } catch (e: any) {
    errors.push(e.message);
    return NextResponse.json({ success: false, steps, errors }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
