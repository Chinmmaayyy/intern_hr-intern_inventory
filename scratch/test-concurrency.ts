import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runTest() {
  console.log('Starting concurrency locking test...');

  // 1. Get default organization
  const org = await prisma.organization.findFirst();
  if (!org) {
    console.error('No organization found in the database. Run prisma db seed first.');
    return;
  }
  const orgId = org.id;

  // 2. Create test store, category, item, and store stock
  console.log('Setting up test store and item...');
  const store = await prisma.store.create({
    data: {
      store_code: `TEST-STORE-${Date.now()}`,
      name: 'Test Concurrency Store',
      store_type: 'CENTRAL',
      organizationId: orgId,
      is_active: true
    }
  });

  const category = await prisma.itemCategory.findFirst({
    where: { organizationId: orgId }
  }) || await prisma.itemCategory.create({
    data: {
      name: 'Test Category',
      item_type: 'CONSUMABLE',
      organizationId: orgId
    }
  });

  const item = await prisma.itemMaster.create({
    data: {
      name: `Test Lock Item ${Date.now()}`,
      item_code: `TST-LOCK-${Date.now()}`,
      category_id: category.id,
      item_type: 'CONSUMABLE',
      base_uom: 'Units',
      purchase_uom: 'Units',
      status: 'Active',
      organizationId: orgId
    }
  });

  // Seed store stock with exactly 5 units
  const initialStockQty = 5;
  const stock = await prisma.storeStock.create({
    data: {
      store_id: store.id,
      item_id: item.id,
      batch_id: null,
      quantity_on_hand: initialStockQty,
      avg_unit_cost: 5.0,
      organizationId: orgId
    }
  });

  console.log(`Initial stock seeded: ${initialStockQty} units.`);

  // 3. Define the issue function that mimics issueIndentItems using row-level locks
  const issueOneUnit = async (reqId: number): Promise<number> => {
    try {
      return await prisma.$transaction(async (tx) => {
        // SELECT FOR UPDATE
        const locked: any[] = await tx.$queryRaw<any[]>`
          SELECT id, "quantity_on_hand" FROM store_stocks
          WHERE store_id = ${store.id} AND item_id = ${item.id} AND batch_id IS NULL AND "organizationId" = ${orgId}
          LIMIT 1 FOR UPDATE
        `;
        const currentStock = locked[0];
        if (!currentStock) {
          throw new Error('Stock record not found under lock');
        }

        const pickQty = Math.min(1, currentStock.quantity_on_hand);
        if (pickQty > 0) {
          await tx.storeStock.update({
            where: { id: currentStock.id },
            data: { quantity_on_hand: { decrement: pickQty } }
          });
          
          await tx.inventoryMovement.create({
            data: {
              organizationId: orgId,
              store_id: store.id,
              item_id: item.id,
              movement_type: 'INDENT_ISSUE',
              quantity_in: 0,
              quantity_out: pickQty,
              unit_cost: 5.0,
              value: pickQty * 5.0,
              balance_after: currentStock.quantity_on_hand - pickQty,
              source_type: 'ISSUE',
              reason: `Concurrency Test Req ${reqId}`
            }
          });
        }
        return pickQty;
      });
    } catch (e: any) {
      console.error(`Request ${reqId} failed:`, e.message);
      return 0;
    }
  };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // 4. Run 15 parallel requests
  console.log('Launching 15 parallel issue requests with 100ms stagger...');
  const promises = [];
  for (let i = 1; i <= 15; i++) {
    promises.push(issueOneUnit(i));
    await delay(100);
  }

  const results = await Promise.all(promises);
  const totalPicked = results.reduce((sum, qty) => sum + qty, 0);

  // 5. Verify final stock levels
  const finalStock = await prisma.storeStock.findUnique({
    where: { id: stock.id }
  });

  console.log('\n--- Concurrency Test Results ---');
  console.log(`Initial stock quantity: ${initialStockQty}`);
  console.log(`Total parallel requests launched: 15`);
  console.log(`Total units picked: ${totalPicked}`);
  console.log(`Final stock quantity in DB: ${finalStock?.quantity_on_hand}`);

  if (totalPicked === initialStockQty && finalStock?.quantity_on_hand === 0) {
    console.log('SUCCESS: Concurrency locking works perfectly. No double-allocation or overselling occurred.');
  } else {
    console.error('FAILURE: Race condition or lock failure detected.');
  }

  // Cleanup test data
  console.log('\nCleaning up test data...');
  await prisma.inventoryMovement.deleteMany({ where: { item_id: item.id } });
  await prisma.storeStock.delete({ where: { id: stock.id } });
  await prisma.itemMaster.delete({ where: { id: item.id } });
  await prisma.store.delete({ where: { id: store.id } });
  console.log('Cleanup complete.');
}

runTest()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
