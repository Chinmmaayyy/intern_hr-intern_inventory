import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const ORG = 'org-avani-default';

async function main() {
  console.log('\n=== DATABASE VERIFICATION ===\n');
  
  // Check vendors
  const vendors = await prisma.vendor.findMany({ where: { organizationId: ORG }, select: { id: true, vendor_name: true, vendor_code: true, is_active: true } });
  console.log('Vendors:', vendors.map(v => `${v.id}: ${v.vendor_name} (${v.vendor_code}) active=${v.is_active}`).join(', '));
  
  // Check stores
  const stores = await prisma.store.findMany({ where: { organizationId: ORG }, select: { id: true, name: true, store_type: true } });
  console.log('Stores:', stores.map(s => `${s.id}: ${s.name} (${s.store_type})`).join(', '));
  
  // Check items
  const items = await prisma.itemMaster.findMany({ where: { organizationId: ORG }, select: { id: true, name: true, status: true, item_code: true } });
  console.log('Items:', items.map(i => `${i.id}: ${i.name} [${i.status}] ${i.item_code}`).join(', '));
  
  // Check purchase orders
  const pos = await prisma.purchaseOrder.findMany({ where: { organizationId: ORG }, select: { id: true, po_number: true, status: true }, orderBy: { created_at: 'desc' }, take: 5 });
  console.log('POs (last 5):', pos.map(p => `${p.id}: ${p.po_number} [${p.status}]`).join(', '));
  
  // Check GRNs
  const grns = await prisma.goodsReceiptNote.findMany({ where: { organizationId: ORG }, select: { id: true, grn_number: true }, take: 5 });
  console.log('GRNs:', grns.length > 0 ? grns.map(g => g.grn_number).join(', ') : 'None yet');
  
  // Check indents
  const indents = await prisma.indent.findMany({ where: { organizationId: ORG }, select: { id: true, indent_number: true, status: true }, take: 5 });
  console.log('Indents:', indents.length > 0 ? indents.map(i => `${i.indent_number}[${i.status}]`).join(', ') : 'None yet');
  
  // Check consumptions
  const consumptions = await prisma.inventoryMovement.count({ where: { organizationId: ORG, movement_type: { in: ['CONSUMPTION', 'PATIENT_CHARGE'] } } });
  console.log('Consumption records:', consumptions);
  
  console.log('\n=== ALL CHECKS DONE ===\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
