/**
 * Migrates WardStock and LabReagentInventory into unified inventory tables.
 * Run: npx tsx prisma/migrate-legacy-inventory.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function upsertStoreStock(
  storeId: number,
  itemId: number,
  qty: number,
  cost: number,
  organizationId: string,
) {
  const existing = await prisma.storeStock.findFirst({
    where: { store_id: storeId, item_id: itemId, batch_id: null, organizationId },
  });
  if (existing) {
    await prisma.storeStock.update({ where: { id: existing.id }, data: { quantity_on_hand: qty } });
  } else {
    await prisma.storeStock.create({
      data: { store_id: storeId, item_id: itemId, quantity_on_hand: qty, avg_unit_cost: cost, organizationId },
    });
  }
}

async function main() {
  console.log('Starting legacy inventory migration...');
  const orgs = await prisma.organization.findMany({ where: { is_active: true }, select: { id: true } });

  for (const org of orgs) {
    console.log(`Org: ${org.id}`);

    const wards = await prisma.wards.findMany({ where: { organizationId: org.id } });
    for (const ward of wards) {
      const storeCode = `WARD-${ward.ward_id}`;
      await prisma.store.upsert({
        where: { store_code_organizationId: { store_code: storeCode, organizationId: org.id } },
        create: {
          store_code: storeCode,
          name: `${ward.ward_name} Ward Store`,
          store_type: 'WARD',
          cost_center: ward.ward_name,
          is_active: true,
          organizationId: org.id,
        },
        update: { name: `${ward.ward_name} Ward Store` },
      });
    }

    const wardStocks = await prisma.wardStock.findMany({
      where: { organizationId: org.id },
      include: { ward: true, medicine: true },
    });

    for (const ws of wardStocks) {
      if (ws.current_stock <= 0) continue;
      const store = await prisma.store.findFirst({
        where: { organizationId: org.id, store_code: `WARD-${ws.ward_id}` },
      });
      if (!store) continue;

      const item = await prisma.itemMaster.findFirst({
        where: {
          organizationId: org.id,
          OR: [
            { name: { equals: ws.medicine?.brand_name ?? '', mode: 'insensitive' } },
            { item_code: { startsWith: 'MED-' } },
          ],
        },
      });
      if (!item) continue;

      await upsertStoreStock(store.id, item.id, ws.current_stock, ws.medicine?.purchase_price ?? 0, org.id);
    }

    const labStore = await prisma.store.findFirst({ where: { organizationId: org.id, store_type: 'LAB' } });
    if (labStore) {
      const category = await prisma.itemCategory.findFirst({
        where: { organizationId: org.id, item_type: 'REAGENT' },
      });
      if (category) {
        const reagents = await prisma.labReagentInventory.findMany({ where: { organizationId: org.id } });
        for (const r of reagents) {
          const itemCode = `REG-LEG-${r.id}`;
          const item = await prisma.itemMaster.upsert({
            where: { item_code_organizationId: { item_code: itemCode, organizationId: org.id } },
            create: {
              item_code: itemCode,
              name: r.reagent_name,
              category_id: category.id,
              item_type: 'REAGENT',
              base_uom: r.unit || 'EA',
              purchase_uom: r.unit || 'EA',
              status: 'Active',
              organizationId: org.id,
            },
            update: { name: r.reagent_name },
          });
          if (r.current_stock > 0) {
            await upsertStoreStock(labStore.id, item.id, r.current_stock, 0, org.id);
          }
        }
      }
    }
  }

  console.log('Migration complete.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
