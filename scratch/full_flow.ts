import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getFirstIds(orgId: string) {
  const store = await prisma.store.findFirst({ where: { organizationId: orgId }, orderBy: { id: 'asc' } });
  const wardStore = await prisma.store.findFirst({ where: { organizationId: orgId, store_type: 'WARD' }, orderBy: { id: 'asc' } });
  const vendor = await prisma.vendor.findFirst({ where: { organizationId: orgId }, orderBy: { id: 'asc' } });
  return { storeId: store?.id ?? 1, wardStoreId: wardStore?.id ?? 2, vendorId: vendor?.id ?? 1 };
}

async function run() {
  const orgId = 'org-avani-default';
  const { storeId, wardStoreId, vendorId } = await getFirstIds(orgId);

  // 1. Create Draft Item
  const draft = await prisma.itemMaster.create({
    data: {
      organizationId: orgId,
      name: 'Surgical Kit A (Test)',
      item_code: `ITEM-TEST-${Date.now()}`,
      description: 'Test item for full flow',
      item_type: 'CONSUMABLE',
      base_uom: 'EA',
      purchase_uom: 'EA',
      uom_conversion: 1,
      std_purchase_price: 100,
      selling_price: 150,
      mrp: 150,
      status: 'Draft',
      category_id: 1,
    },
  });
  console.log('Draft Item created:', draft.id);

  // 2. Approve Item
  await prisma.itemMaster.update({ where: { id: draft.id }, data: { status: 'Active' } });
  console.log('Item approved, now Active');

  // 3. Create Purchase Order
  const po = await prisma.purchaseOrder.create({
    data: {
      organizationId: orgId,
      po_number: `PO-${Date.now()}`,
      vendor_id: vendorId,
      status: 'Draft',
      total_amount: 100 * 100,
    },
  });
  await prisma.purchaseOrderItem.create({
    data: { purchase_order_id: po.id, item_id: draft.id, quantity_ordered: 100, unit_price: 100, total_price: 100 * 100 },
  });
  await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: 'Approved' } });
  await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: 'Ordered' } });
  console.log('PO created and moved to Ordered');

  // 4. Create GRN
  const grn = await prisma.goodsReceiptNote.create({
    data: {
      organizationId: orgId,
      grn_number: `GRN-${Date.now()}`,
      po_id: po.id,
      status: 'Received',
      total_amount: 100 * 100,
      store_id: storeId,
    },
  });
  await prisma.goodsReceiptNoteItem.create({
    data: {
      grn_id: grn.id,
      item_id: draft.id,
      quantity_accepted: 100,
      unit_price: 100,
      total_price: 100 * 100,
      batch_no: 'BAT-SRG-01',
      expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  console.log('GRN created');

  // 5. Create Invoice
  // Let's see if there is a purchaseInvoice or pharmacyPurchaseInvoice table in database.
  // We saw in actions: `db.pharmacyPurchaseInvoice.create`
  const invoice = await prisma.pharmacyPurchaseInvoice.create({
    data: {
      organizationId: orgId,
      invoice_number: `INV-${Date.now()}`,
      po_id: po.id,
      grn_id: grn.id,
      status: 'Posted',
      total_amount: 100 * 100,
      invoice_date: new Date(),
      vendor_id: vendorId,
      subtotal: 100 * 100,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      variance_approved: true,
      gl_posted: true,
    },
  });
  await prisma.pharmacyPurchaseInvoiceItem.create({
    data: { purchase_invoice_id: invoice.id, item_id: draft.id, quantity: 100, unit_price: 100, total_amount: 100 * 100 },
  });
  console.log('Invoice posted');

  // 6. Create Indent
  const indent = await prisma.indent.create({
    data: {
      organizationId: orgId,
      indent_number: `IND-${Date.now()}`,
      source_store_id: storeId,
      destination_store_id: wardStoreId,
      status: 'Submitted',
    },
  });
  await prisma.indentItem.create({ data: { indent_id: indent.id, item_id: draft.id, quantity_requested: 20 } });
  console.log('Indent created');

  // 7. Issue Stock
  await prisma.indentItem.update({
    where: { indent_id_item_id: { indent_id: indent.id, item_id: draft.id } },
    data: { quantity_issued: 20 },
  });
  await prisma.indent.update({ where: { id: indent.id }, data: { status: 'Issued' } });
  console.log('Indent issued');

  // Receive at Ward
  await prisma.indentItem.update({
    where: { indent_id_item_id: { indent_id: indent.id, item_id: draft.id } },
    data: { quantity_received: 20 },
  });
  await prisma.indent.update({ where: { id: indent.id }, data: { status: 'Received' } });
  console.log('Ward received stock');

  // 8. Log Consumption
  await prisma.inventoryMovement.create({
    data: {
      organizationId: orgId,
      movement_type: 'CONSUMPTION',
      store_id: wardStoreId,
      item_id: draft.id,
      quantity: 2,
      description: 'Patient procedure consumption',
    },
  });
  console.log('Consumption logged');

  await prisma.$disconnect();
}

run().catch(e => {
  console.error('Error during flow:', e);
  prisma.$disconnect();
});
