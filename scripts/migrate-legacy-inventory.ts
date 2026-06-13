import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting legacy inventory migration...');

  try {
    const orgs = await prisma.organization.findMany({
      where: { is_active: true },
      select: { id: true }
    });

    for (const org of orgs) {
      const organizationId = org.id;
      console.log(`\nProcessing organization: ${organizationId}`);

      // 1. Resolve default GL accounts for opening balance equity
      const equityAccount = await prisma.gL_Account.findFirst({
        where: { account_code: { in: ['3900', '3000'] }, organizationId }
      });
      if (!equityAccount) {
        console.warn(`Warning: Opening Balance Equity account (3900/3000) not found for org ${organizationId}. Skipping GL posting.`);
      }

      // Fetch active financial period
      const activePeriod = await prisma.financialPeriod.findFirst({
        where: {
          organizationId,
          status: 'Open',
          start_date: { lte: new Date() },
          end_date: { gte: new Date() }
        }
      });

      // Keep track of GL line items we need to post for this organization
      const glLinesToPost: Array<{
        accountId: string;
        debit: number;
        credit: number;
        description: string;
        costCenter?: string;
      }> = [];

      // A list of created inventory movement IDs to link to the journal entry later
      const movementIdsToUpdate: number[] = [];

      // ==========================================
      // A. Migrate WardStock (Medicines)
      // ==========================================
      const wardStocks = await prisma.wardStock.findMany({
        where: { organizationId },
        include: {
          ward: true,
          medicine: true
        }
      });

      console.log(`Found ${wardStocks.length} WardStock records to migrate.`);

      for (const ws of wardStocks) {
        const wardName = ws.ward.name;
        const storeCode = `WARD-${wardName.replace(/\s+/g, '-').toUpperCase()}`;

        // Get or create WARD store
        let store = await prisma.store.findFirst({
          where: { store_code: storeCode, organizationId }
        });
        if (!store) {
          store = await prisma.store.create({
            data: {
              store_code: storeCode,
              name: `${wardName} Store`,
              store_type: 'WARD',
              organizationId,
              cost_center: `CC-${wardName.replace(/\s+/g, '-').toUpperCase()}`,
              is_active: true
            }
          });
        }

        // Check if ItemCategory for Medicines exists
        let category = await prisma.itemCategory.findFirst({
          where: { name: 'Medicines', organizationId }
        });
        if (!category) {
          category = await prisma.itemCategory.create({
            data: {
              name: 'Medicines',
              code: 'MED',
              organizationId,
              gl_inventory_account_id: '1170' // Default inventory code
            }
          });
        }

        // Get or create ItemMaster for this medicine
        let item = await prisma.itemMaster.findFirst({
          where: { name: ws.medicine.brand_name, organizationId }
        });
        if (!item) {
          item = await prisma.itemMaster.create({
            data: {
              name: ws.medicine.brand_name,
              item_code: `MED-${ws.medicine.id}`,
              category_id: category.id,
              item_type: 'CONSUMABLE',
              base_uom: 'Units',
              purchase_uom: 'Units',
              std_purchase_price: ws.medicine.purchase_price,
              selling_price: ws.medicine.selling_price,
              mrp: ws.medicine.mrp,
              gst_rate: ws.medicine.gst_percent,
              status: 'Active',
              organizationId
            }
          });
        }

        // Create or update StoreStock
        let stock = await prisma.storeStock.findFirst({
          where: { store_id: store.id, item_id: item.id, batch_id: null, organizationId }
        });

        if (stock) {
          await prisma.storeStock.update({
            where: { id: stock.id },
            data: { quantity_on_hand: stock.quantity_on_hand + ws.current_stock }
          });
        } else {
          stock = await prisma.storeStock.create({
            data: {
              store_id: store.id,
              item_id: item.id,
              batch_id: null,
              quantity_on_hand: ws.current_stock,
              avg_unit_cost: ws.medicine.purchase_price,
              organizationId
            }
          });
        }

        // Record Inventory Movement
        const movement = await prisma.inventoryMovement.create({
          data: {
            organizationId,
            store_id: store.id,
            item_id: item.id,
            movement_type: 'OPENING',
            quantity_in: ws.current_stock,
            unit_cost: ws.medicine.purchase_price,
            value: ws.current_stock * ws.medicine.purchase_price,
            balance_after: ws.current_stock + (stock ? stock.quantity_on_hand : 0),
            source_type: 'ADJUSTMENT',
            reason: 'Legacy WardStock Migration'
          }
        });

        movementIdsToUpdate.push(movement.id);

        // Accumulate GL lines if there's stock value
        const stockValue = ws.current_stock * ws.medicine.purchase_price;
        if (stockValue > 0 && equityAccount) {
          // Resolve inventory account for this category
          const invAccountId = category.gl_inventory_account_id || '1170';
          // Find actual GL Account ID by code or name
          const actualInvAccount = await prisma.gL_Account.findFirst({
            where: { account_code: invAccountId, organizationId }
          });

          if (actualInvAccount) {
            glLinesToPost.push({
              accountId: actualInvAccount.id,
              debit: stockValue,
              credit: 0,
              description: `Opening Stock Ward Migration - ${item.name} in ${store.name}`,
              costCenter: store.cost_center || undefined
            });
          }
        }
      }

      // ==========================================
      // B. Migrate LabReagentInventory
      // ==========================================
      const labReagents = await prisma.labReagentInventory.findMany({
        where: { organizationId }
      });

      console.log(`Found ${labReagents.length} LabReagentInventory records to migrate.`);

      for (const lr of labReagents) {
        // Get or create LAB store
        let store = await prisma.store.findFirst({
          where: { store_type: 'LAB', organizationId }
        });
        if (!store) {
          store = await prisma.store.create({
            data: {
              store_code: 'LAB-STORE',
              name: 'Laboratory Reagents Store',
              store_type: 'LAB',
              organizationId,
              cost_center: 'CC-LAB',
              is_active: true
            }
          });
        }

        // Check if ItemCategory for Reagents exists
        let category = await prisma.itemCategory.findFirst({
          where: { name: 'Reagents', organizationId }
        });
        if (!category) {
          category = await prisma.itemCategory.create({
            data: {
              name: 'Reagents',
              code: 'REA',
              organizationId,
              gl_inventory_account_id: '1170'
            }
          });
        }

        // Get or create ItemMaster for reagent
        let item = await prisma.itemMaster.findFirst({
          where: { name: lr.reagent_name, organizationId }
        });
        if (!item) {
          item = await prisma.itemMaster.create({
            data: {
              name: lr.reagent_name,
              item_code: `REA-${lr.id}`,
              category_id: category.id,
              item_type: 'REAGENT',
              base_uom: lr.unit || 'Units',
              purchase_uom: lr.unit || 'Units',
              status: 'Active',
              organizationId
            }
          });
        }

        // Create ItemBatch if expiry date exists
        let batchId: number | null = null;
        if (lr.expiry_date) {
          const batchNo = `MIG-REA-${lr.id}`;
          let batch = await prisma.itemBatch.findFirst({
            where: { item_id: item.id, batch_no: batchNo, organizationId }
          });
          if (!batch) {
            batch = await prisma.itemBatch.create({
              data: {
                item_id: item.id,
                batch_no: batchNo,
                expiry_date: lr.expiry_date,
                organizationId
              }
            });
          }
          batchId = batch.id;
        }

        // Create or update StoreStock
        let stock = await prisma.storeStock.findFirst({
          where: { store_id: store.id, item_id: item.id, batch_id: batchId, organizationId }
        });

        if (stock) {
          await prisma.storeStock.update({
            where: { id: stock.id },
            data: { quantity_on_hand: stock.quantity_on_hand + lr.current_stock }
          });
        } else {
          stock = await prisma.storeStock.create({
            data: {
              store_id: store.id,
              item_id: item.id,
              batch_id: batchId,
              quantity_on_hand: lr.current_stock,
              organizationId
            }
          });
        }

        // Record Inventory Movement
        const movement = await prisma.inventoryMovement.create({
          data: {
            organizationId,
            store_id: store.id,
            item_id: item.id,
            batch_id: batchId,
            movement_type: 'OPENING',
            quantity_in: lr.current_stock,
            balance_after: lr.current_stock + (stock ? stock.quantity_on_hand : 0),
            source_type: 'ADJUSTMENT',
            reason: 'Legacy LabReagent Migration'
          }
        });

        movementIdsToUpdate.push(movement.id);
      }

      // ==========================================
      // C. Post Consolidated GL Entry
      // ==========================================
      const totalDebit = glLinesToPost.reduce((sum, line) => sum + line.debit, 0);
      if (totalDebit > 0 && equityAccount) {
        console.log(`Posting consolidated opening balance GL entry of value: ${totalDebit}`);

        const journalNumber = `JV-OP-MIG-${Date.now()}`;
        const journal = await prisma.gL_JournalEntry.create({
          data: {
            organizationId,
            journal_number: journalNumber,
            entry_date: new Date(),
            period_id: activePeriod?.id || null,
            entry_type: 'Opening',
            reference_type: 'OpeningStock',
            narration: 'Consolidated Opening Stock legacy migration',
            total_debit: new Prisma.Decimal(totalDebit),
            total_credit: new Prisma.Decimal(totalDebit),
            status: 'Posted',
            lines: {
              create: [
                ...glLinesToPost.map((line, idx) => ({
                  organizationId,
                  line_number: idx + 1,
                  account_id: line.accountId,
                  debit_amount: new Prisma.Decimal(line.debit),
                  credit_amount: new Prisma.Decimal(0),
                  description: line.description,
                  cost_center: line.costCenter
                })),
                {
                  organizationId,
                  line_number: glLinesToPost.length + 1,
                  account_id: equityAccount.id,
                  debit_amount: new Prisma.Decimal(0),
                  credit_amount: new Prisma.Decimal(totalDebit),
                  description: 'Migrated Opening Stock Equity offset'
                }
              ]
            }
          }
        });

        // Link the journal entry to the created inventory movements
        if (movementIdsToUpdate.length > 0) {
          await prisma.inventoryMovement.updateMany({
            where: { id: { in: movementIdsToUpdate } },
            data: { gl_journal_id: journal.id }
          });
        }

        console.log(`GL Journal Entry created successfully: ${journal.journal_number}`);
      } else {
        console.log('No financial GL lines to post (either zero stock value or no equity account configured).');
      }
    }

    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
