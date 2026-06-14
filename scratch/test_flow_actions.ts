import Module from 'module';

// 1. Setup Mock Require for Next.js modules
let currentSessionPayload: string | null = null;
const originalRequire = (Module as any).prototype.require;
(Module as any).prototype.require = function (id: string) {
  if (id === 'next/headers') {
    return {
      cookies: () => ({
        get: (name: string) => {
          if (name === 'session' && currentSessionPayload) {
            return { value: currentSessionPayload };
          }
          return null;
        },
        set: () => {}
      })
    };
  }
  if (id === 'next/cache') {
    return {
      revalidatePath: () => {}
    };
  }
  return originalRequire.apply(this, arguments);
};

import { SignJWT } from 'jose';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || '8f3b2c7a9d4e1f5b6c0a7e3d9f2b4c6a1e8f5d3b7c9a2e6d4f1b8c0a7e3d9f2');

async function mockLogin(username: string, role: string, id: string) {
  const payload = {
    id,
    username,
    role,
    name: username,
    specialty: null,
    organization_id: 'org-avani-default',
    organization_slug: 'avani',
    organization_name: 'Avani Hospital'
  };
  const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('8h')
      .setIssuedAt()
      .sign(JWT_SECRET);
  currentSessionPayload = token;
}

async function test() {
  console.log('--- STARTING ACTIONS FLOW VERIFICATION ---');

  // Load modules dynamically after require interception is active
  const { createItem, approveItem } = await import('../app/actions/item-master-actions');
  const { createPurchaseOrder, approvePurchaseOrder, sendPurchaseOrder, createGRN, createPurchaseInvoice } = await import('../app/actions/procurement-actions');
  const { createIndent, approveIndent, issueIndentItems, receiveConfirmIndent } = await import('../app/actions/indent-actions');
  const { logConsumption } = await import('../app/actions/stock-actions');

  // Clear existing test items if any to avoid name conflicts
  await prisma.itemMaster.deleteMany({ where: { name: 'Surgical Kit A (Test Action)' } });

  // STEP 1: Create a Draft Item (Store Manager)
  await mockLogin('store1', 'store_manager', '75e3158f-31d1-4427-a6d8-9a7e4e27ebb7');
  const category = await prisma.itemCategory.findFirst({ where: { organizationId: 'org-avani-default' } });
  if (!category) throw new Error('No item category found. Seed the DB first.');

  const itemRes = await createItem({
    name: 'Surgical Kit A (Test Action)',
    description: 'Maker checker test item',
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
    is_patient_chargeable: true
  });

  if (!itemRes.success) throw new Error(`Step 1 failed (createItem): ${itemRes.error}`);
  const item = itemRes.data;
  console.log(`Step 1 Passed: Item created with status '${item.status}'`);

  // Verify prices are NOT active in DB
  const dbItem = await prisma.itemMaster.findUnique({ where: { id: item.id } });
  if (!dbItem) throw new Error('Created item not found in DB');
  if (dbItem.std_purchase_price !== 0 || dbItem.selling_price !== 0 || dbItem.mrp !== 0) {
    throw new Error(`Step 1 Validation Failed: Prices are active directly in draft: purchase=${dbItem.std_purchase_price}, selling=${dbItem.selling_price}`);
  }
  if (dbItem.pending_std_purchase_price !== 100 || dbItem.pending_selling_price !== 150 || dbItem.pending_mrp !== 150) {
    throw new Error(`Step 1 Validation Failed: Pending prices not set correctly: ${dbItem.pending_std_purchase_price}`);
  }
  console.log(`Step 1 Validation Passed: Standard prices not active yet, pending prices stored: Pur: ${dbItem.pending_std_purchase_price}, Sel: ${dbItem.pending_selling_price}`);

  // STEP 2: Approve the Item (Admin)
  await mockLogin('admin', 'admin', '5590d502-9408-47d0-9b76-201e364ce5ce');
  const approveRes = await approveItem(item.id);
  if (!approveRes.success) throw new Error(`Step 2 failed (approveItem): ${approveRes.error}`);

  // Verify prices are finalized/active
  const approvedDbItem = await prisma.itemMaster.findUnique({ where: { id: item.id } });
  if (!approvedDbItem) throw new Error('Approved item not found in DB');
  if (approvedDbItem.status !== 'Active') throw new Error(`Expected Active status, got ${approvedDbItem.status}`);
  if (approvedDbItem.std_purchase_price !== 100 || approvedDbItem.selling_price !== 150 || approvedDbItem.mrp !== 150) {
    throw new Error(`Step 2 Validation Failed: Prices not finalized: purchase=${approvedDbItem.std_purchase_price}, selling=${approvedDbItem.selling_price}`);
  }
  if (approvedDbItem.pending_std_purchase_price !== null || approvedDbItem.pending_selling_price !== null) {
    throw new Error('Step 2 Validation Failed: Pending prices not cleared');
  }
  console.log(`Step 2 Passed: Item approved, standard prices now active: Pur: ${approvedDbItem.std_purchase_price}, Sel: ${approvedDbItem.selling_price}`);

  // STEP 3: Raise and Approve a Purchase Order (Procurement Officer)
  await mockLogin('proc1', 'procurement_officer', '82ca95dc-5c84-4b22-b826-4aec771e36e3');
  const vendor = await prisma.vendor.findFirst({ where: { organizationId: 'org-avani-default' } });
  if (!vendor) throw new Error('No vendor found.');

  const poRes = await createPurchaseOrder({
    vendor_id: vendor.id,
    receiving_store_id: 1, // Central store
    items: [
      {
        item_id: item.id,
        quantity_ordered: 100,
        unit_price: 100,
        gst_rate: 0
      }
    ]
  });
  if (!poRes.success) throw new Error(`Step 3 failed (createPurchaseOrder): ${poRes.error}`);
  const po = poRes.data;
  console.log(`Step 3 Passed: PO created in '${po.status}' status`);

  // Approve PO
  const poApproveRes = await approvePurchaseOrder(po.id);
  if (!poApproveRes.success) throw new Error(`Step 3 failed (approvePurchaseOrder): ${poApproveRes.error}`);
  console.log(`Step 3 Passed: PO approved`);

  // Send PO (ordered)
  const poSendRes = await sendPurchaseOrder(po.id);
  if (!poSendRes.success) throw new Error(`Step 3 failed (sendPurchaseOrder): ${poSendRes.error}`);
  console.log(`Step 3 Passed: PO sent, status: '${poSendRes.data.status}'`);

  // STEP 4: Receive Goods (GRN) (Store Manager)
  await mockLogin('store1', 'store_manager', '75e3158f-31d1-4427-a6d8-9a7e4e27ebb7');
  const grnRes = await createGRN({
    po_id: po.id,
    vendor_id: vendor.id,
    store_id: 1, // Central
    remarks: 'Maker checker test receipt',
    items: [
      {
        item_id: item.id,
        quantity_accepted: 100,
        quantity_rejected: 0,
        batch_no: 'BAT-SRG-01',
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        unit_price: 100,
        gst_rate: 0
      }
    ]
  });
  if (!grnRes.success) throw new Error(`Step 4 failed (createGRN): ${grnRes.error}`);
  const grn = grnRes.data;
  console.log(`Step 4 Passed: GRN recorded`);

  // Verify stock levels in Central Store (Store ID 1)
  const centralStock = await prisma.storeStock.findFirst({
    where: { store_id: 1, item_id: item.id }
  });
  if (!centralStock || centralStock.quantity_on_hand !== 100) {
    throw new Error(`Step 4 Validation Failed: Expected stock 100, got ${centralStock?.quantity_on_hand ?? 0}`);
  }
  console.log(`Step 4 Validation Passed: Central Store stock level for Surgical Kit A is exactly 100`);

  // STEP 5: Perform 3-Way Match & Post Invoice (Procurement Officer)
  await mockLogin('proc1', 'procurement_officer', '82ca95dc-5c84-4b22-b826-4aec771e36e3');
  const invRes = await createPurchaseInvoice({
    poId: po.id,
    grnId: grn.id,
    invoiceNumber: `INV-${Date.now()}`,
    invoiceDate: new Date().toISOString(),
    lineItems: [
      {
        item_id: item.id,
        quantity: 100,
        unit_price: 100,
        gst_rate: 0
      }
    ]
  });
  if (!invRes.success) throw new Error(`Step 5 failed (createPurchaseInvoice): ${invRes.error}`);
  const invoice = invRes.data;
  if (invoice.status !== 'Posted') throw new Error(`Expected Posted status, got '${invoice.status}'`);
  console.log(`Step 5 Passed: Invoice posted, status '${invoice.status}'`);

  // STEP 6: Request Indent (Ward Nurse)
  await mockLogin('nurse1', 'nurse', '605bf5c5-c553-4596-aec2-9e3d2f6fcce4');
  const indentRes = await createIndent({
    from_store_id: 4, // Ward A
    to_store_id: 1, // Central
    priority: 'NORMAL',
    items: [
      {
        item_id: item.id,
        qty_requested: 20
      }
    ]
  });
  if (!indentRes.success) throw new Error(`Step 6 failed (createIndent): ${indentRes.error}`);
  const indent = indentRes.data;
  console.log(`Step 6 Passed: Indent created by nurse, status '${indent.status}'`);

  // STEP 7: Dispatch Stock & Confirm Receipt (Store Manager & Ward Nurse)
  // Store manager approves indent first
  await mockLogin('store1', 'store_manager', '75e3158f-31d1-4427-a6d8-9a7e4e27ebb7');
  const indentApprove = await approveIndent(indent.id, [{ item_id: item.id, qty_approved: 20 }]);
  if (!indentApprove.success) throw new Error(`Step 7 failed (approveIndent): ${indentApprove.error}`);
  console.log(`Step 7 Passed: Indent approved by store manager`);

  // Store manager issues items
  const centralBatch = await prisma.itemBatch.findFirst({ where: { item_id: item.id } });
  if (!centralBatch) throw new Error('Central store batch not found');

  const issueRes = await issueIndentItems(indent.id, [
    {
      item_id: item.id,
      batch_id: centralBatch.id,
      quantity: 20
    }
  ]);
  if (!issueRes.success) throw new Error(`Step 7 failed (issueIndentItems): ${issueRes.error}`);
  console.log(`Step 7 Passed: Indent issued by store manager`);

  // Verify Central Store stock drops from 100 to 80
  const centralStockPostIssue = await prisma.storeStock.findFirst({
    where: { store_id: 1, item_id: item.id }
  });
  if (!centralStockPostIssue || centralStockPostIssue.quantity_on_hand !== 80) {
    throw new Error(`Step 7 Central Stock Verification Failed: Expected 80, got ${centralStockPostIssue?.quantity_on_hand ?? 0}`);
  }
  console.log(`Step 7 Validation Passed: Central Store stock dropped to 80`);

  // Nurse confirms receipt
  await mockLogin('nurse1', 'nurse', '605bf5c5-c553-4596-aec2-9e3d2f6fcce4');
  const receiveRes = await receiveConfirmIndent(indent.id, [
    {
      item_id: item.id,
      batch_id: centralBatch.id,
      quantity: 20
    }
  ]);
  if (!receiveRes.success) throw new Error(`Step 7 failed (receiveConfirmIndent): ${receiveRes.error}`);
  console.log(`Step 7 Passed: Indent receipt confirmed by nurse`);

  // Verify Ward A Store stock is 20
  const wardStock = await prisma.storeStock.findFirst({
    where: { store_id: 4, item_id: item.id }
  });
  if (!wardStock || wardStock.quantity_on_hand !== 20) {
    throw new Error(`Step 7 Ward Stock Verification Failed: Expected 20, got ${wardStock?.quantity_on_hand ?? 0}`);
  }
  console.log(`Step 7 Validation Passed: Ward-A Store stock is exactly 20`);

  // STEP 8: Log Consumption & Patient Charge (Ward Nurse)
  const wardBatch = await prisma.itemBatch.findFirst({ where: { item_id: item.id } }); // batch should be in WARD-A now
  const consumptionRes = await logConsumption({
    store_id: 4,
    item_id: item.id,
    batch_id: wardBatch?.id,
    quantity: 2,
    type: 'PATIENT',
    admission_id: 'AXT-ADM-26-27-001',
    patient_id: 'AVN-2026-00001'
  });
  if (!consumptionRes.success) throw new Error(`Step 8 failed (logConsumption): ${consumptionRes.error}`);
  console.log(`Step 8 Passed: Consumption logged successfully`);

  // Verify Ward A Stock drops to 18
  const wardStockPostConsumption = await prisma.storeStock.findFirst({
    where: { store_id: 4, item_id: item.id }
  });
  if (!wardStockPostConsumption || wardStockPostConsumption.quantity_on_hand !== 18) {
    throw new Error(`Step 8 Stock Verification Failed: Expected 18, got ${wardStockPostConsumption?.quantity_on_hand ?? 0}`);
  }
  console.log(`Step 8 Validation Passed: Ward-A Store stock dropped to 18`);

  // Verify patient charge exists in billing
  const ipdCharges = await prisma.$queryRaw<any[]>`
    SELECT * FROM ipd_patient_charges
    WHERE admission_id = 'AXT-ADM-26-27-001'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (ipdCharges.length === 0) throw new Error('Step 8 Billing Verification Failed: No charge record found in ipd_patient_charges');
  const charge = ipdCharges[0];
  if (charge.description !== `Consumable: Surgical Kit A (Test Action)` || charge.quantity !== 2 || charge.unit_price !== 150) {
    throw new Error(`Step 8 Billing Verification Failed: Charge details incorrect: description=${charge.description}, quantity=${charge.quantity}, price=${charge.unit_price}`);
  }
  console.log(`Step 8 Validation Passed: interim patient bill charge correctly posted! Details: '${charge.description}', Qty: ${charge.quantity}, Price: ₹${charge.unit_price}`);

  console.log('--- ALL 8 STEPS COMPLETED AND VERIFIED PERFECTLY! ---');
  await prisma.$disconnect();
}

test().catch(e => {
  console.error('VERIFICATION FAILED:', e);
  prisma.$disconnect();
  process.exit(1);
});
