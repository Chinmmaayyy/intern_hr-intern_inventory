"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const DEFAULT_ORG_ID = 'org-avani-default';
async function main() {
    console.log('Start inventory seeding...');
    // 1. Resolve Organization
    const org = await prisma.organization.findFirst({
        where: { id: DEFAULT_ORG_ID }
    });
    const orgId = org ? org.id : (await prisma.organization.findFirst())?.id;
    if (!orgId) {
        throw new Error('No organization found. Please run main database seed first.');
    }
    console.log(`Using organization ID: ${orgId}`);
    // 2. Resolve GL Accounts
    // Find or fallback for Inventory Account
    const inventoryAccount = await prisma.gL_Account.findFirst({
        where: { organizationId: orgId, account_code: '1170' }
    }) || await prisma.gL_Account.findFirst({
        where: { organizationId: orgId, account_name: { contains: 'Inventory', mode: 'insensitive' } }
    });
    // Find or fallback for Expense Account (e.g. Consumables Expense or General Expense)
    const expenseAccount = await prisma.gL_Account.findFirst({
        where: { organizationId: orgId, account_code: { startsWith: '5' } }
    }) || await prisma.gL_Account.findFirst({
        where: { organizationId: orgId, account_type: 'Expense' }
    });
    // Find or fallback for COGS Account
    const cogsAccount = await prisma.gL_Account.findFirst({
        where: { organizationId: orgId, account_name: { contains: 'COGS', mode: 'insensitive' } }
    }) || await prisma.gL_Account.findFirst({
        where: { organizationId: orgId, account_name: { contains: 'Cost of', mode: 'insensitive' } }
    }) || expenseAccount;
    console.log(`GL Accounts resolved:
    - Inventory: ${inventoryAccount?.account_name} (${inventoryAccount?.id})
    - Expense: ${expenseAccount?.account_name} (${expenseAccount?.id})
    - COGS: ${cogsAccount?.account_name} (${cogsAccount?.id})`);
    // 3. Seed Vendors
    const vendorsData = [
        { vendor_name: 'Apex Medical Supplies Ltd', vendor_code: 'APEX-01', email: 'sales@apexmed.com', phone: '+91 99999 11111', address: 'Plot 42, Industrial Area, Phase 1, New Delhi' },
        { vendor_name: 'Medicare Distributors', vendor_code: 'MEDI-02', email: 'info@medicare.co.in', phone: '+91 99999 22222', address: 'Road No 3, Banara Hills, Hyderabad' },
        { vendor_name: 'Surgical Solutions Corp', vendor_code: 'SURG-03', email: 'orders@surgicalsolutions.com', phone: '+91 99999 33333', address: '12-B, Electronics City, Bangalore' }
    ];
    const seededVendors = [];
    for (const v of vendorsData) {
        const row = await prisma.vendor.upsert({
            where: { vendor_code_organizationId: { vendor_code: v.vendor_code, organizationId: orgId } },
            update: { is_active: true },
            create: { ...v, organizationId: orgId, is_active: true }
        });
        seededVendors.push(row);
    }
    console.log(`Seeded ${seededVendors.length} vendors`);
    // 4. Seed Item Categories
    const categoriesData = [
        { name: 'Surgical Consumables', item_type: 'CONSUMABLE', default_gst_rate: 12 },
        { name: 'IV Fluids & Glucose', item_type: 'CONSUMABLE', default_gst_rate: 12 },
        { name: 'Laboratory Reagents', item_type: 'REAGENT', default_gst_rate: 18 },
        { name: 'Implants & Prosthetics', item_type: 'IMPLANT', default_gst_rate: 18 },
        { name: 'Linen & Apparel', item_type: 'LINEN', default_gst_rate: 5 },
        { name: 'Office Stationery', item_type: 'STATIONERY', default_gst_rate: 18 }
    ];
    const seededCategories = [];
    for (const c of categoriesData) {
        const row = await prisma.itemCategory.upsert({
            where: { name_organizationId: { name: c.name, organizationId: orgId } },
            update: {
                gl_inventory_account_id: inventoryAccount?.id || null,
                gl_expense_account_id: expenseAccount?.id || null,
                gl_cogs_account_id: cogsAccount?.id || null
            },
            create: {
                name: c.name,
                item_type: c.item_type,
                default_gst_rate: c.default_gst_rate,
                gl_inventory_account_id: inventoryAccount?.id || null,
                gl_expense_account_id: expenseAccount?.id || null,
                gl_cogs_account_id: cogsAccount?.id || null,
                organizationId: orgId
            }
        });
        seededCategories.push(row);
    }
    console.log(`Seeded ${seededCategories.length} item categories`);
    // 5. Seed Stores / Locations
    // Find a branch if available
    const branch = await prisma.branch.findFirst({ where: { organizationId: orgId } });
    const branchId = branch ? branch.id : null;
    const incharge = await prisma.user.findFirst({ where: { organizationId: orgId, role: 'store_manager' } }) ||
        await prisma.user.findFirst({ where: { organizationId: orgId, role: 'admin' } });
    const storesData = [
        { store_code: 'CENTRAL', name: 'Central Warehouse & Store', store_type: 'CENTRAL', cost_center: 'CC-CENTRAL' },
        { store_code: 'OT-STORE', name: 'Operation Theatre Sub-store', store_type: 'OT', cost_center: 'CC-OT' },
        { store_code: 'LAB-STORE', name: 'Laboratory Reagents Store', store_type: 'LAB', cost_center: 'CC-LAB' },
        { store_code: 'WARD-A-STORE', name: 'Ward-A Nursing Station Stock', store_type: 'WARD', cost_center: 'CC-WARD-A' }
    ];
    const seededStores = [];
    for (const s of storesData) {
        const row = await prisma.store.upsert({
            where: { store_code_organizationId: { store_code: s.store_code, organizationId: orgId } },
            update: {
                is_active: true,
                branch_id: branchId,
                incharge_user_id: incharge?.id || null
            },
            create: {
                store_code: s.store_code,
                name: s.name,
                store_type: s.store_type,
                cost_center: s.cost_center,
                branch_id: branchId,
                incharge_user_id: incharge?.id || null,
                organizationId: orgId,
                is_active: true
            }
        });
        seededStores.push(row);
    }
    console.log(`Seeded ${seededStores.length} stores`);
    // Set replenishment parent stores
    const centralStore = seededStores.find(s => s.store_code === 'CENTRAL');
    if (centralStore) {
        for (const s of seededStores) {
            if (s.store_code !== 'CENTRAL') {
                await prisma.store.update({
                    where: { id: s.id },
                    data: { parent_store_id: centralStore.id }
                });
            }
        }
    }
    // 6. Seed Item Master
    const catSurgical = seededCategories.find(c => c.name === 'Surgical Consumables');
    const catIV = seededCategories.find(c => c.name === 'IV Fluids & Glucose');
    const catLab = seededCategories.find(c => c.name === 'Laboratory Reagents');
    const catImplant = seededCategories.find(c => c.name === 'Implants & Prosthetics');
    const catLinen = seededCategories.find(c => c.name === 'Linen & Apparel');
    const catStationery = seededCategories.find(c => c.name === 'Office Stationery');
    const itemsData = [
        {
            item_code: 'ITEM-SUT-001', name: 'Sterile Surgical Sutures 3-0', description: 'Non-absorbable surgical sutures with needle',
            category_id: catSurgical.id, item_type: 'CONSUMABLE', base_uom: 'Box', purchase_uom: 'Box', uom_conversion: 1,
            std_purchase_price: 450, selling_price: 550, mrp: 600, gst_rate: 12, is_batch_tracked: true, is_expiry_tracked: true,
            is_patient_chargeable: true, abc_class: 'B', ved_class: 'E', min_level: 10, max_level: 100, reorder_point: 25
        },
        {
            item_code: 'ITEM-GLO-002', name: 'Disposable Latex Gloves (Medium)', description: 'Powder-free examination gloves',
            category_id: catSurgical.id, item_type: 'CONSUMABLE', base_uom: 'Box', purchase_uom: 'Carton', uom_conversion: 20,
            std_purchase_price: 320, selling_price: 0, mrp: 400, gst_rate: 12, is_batch_tracked: false, is_expiry_tracked: false,
            is_patient_chargeable: false, abc_class: 'A', ved_class: 'V', min_level: 50, max_level: 500, reorder_point: 150
        },
        {
            item_code: 'ITEM-DEX-003', name: 'Dextrose 5% IV Fluid 500ml', description: '5% Dextrose injection for IV infusion',
            category_id: catIV.id, item_type: 'CONSUMABLE', base_uom: 'Bottle', purchase_uom: 'Box', uom_conversion: 24,
            std_purchase_price: 45, selling_price: 85, mrp: 95, gst_rate: 12, is_batch_tracked: true, is_expiry_tracked: true,
            is_patient_chargeable: true, abc_class: 'A', ved_class: 'V', min_level: 100, max_level: 1000, reorder_point: 300
        },
        {
            item_code: 'ITEM-REAG-004', name: 'HEMOGLOBIN REAGENT KIT 100T', description: 'Reagent kit for automated hematology analyzer',
            category_id: catLab.id, item_type: 'REAGENT', base_uom: 'Kit', purchase_uom: 'Kit', uom_conversion: 1,
            std_purchase_price: 2400, selling_price: 3500, mrp: 3800, gst_rate: 18, is_batch_tracked: true, is_expiry_tracked: true,
            is_patient_chargeable: false, abc_class: 'A', ved_class: 'E', min_level: 5, max_level: 50, reorder_point: 12
        },
        {
            item_code: 'ITEM-IMP-005', name: 'Titanium Orthopedic Bone Screw 4.0mm', description: 'Medical grade titanium alloy locking screw',
            category_id: catImplant.id, item_type: 'IMPLANT', base_uom: 'Piece', purchase_uom: 'Piece', uom_conversion: 1,
            std_purchase_price: 1200, selling_price: 2500, mrp: 2800, gst_rate: 18, is_batch_tracked: true, is_expiry_tracked: false,
            is_patient_chargeable: true, abc_class: 'B', ved_class: 'E', min_level: 20, max_level: 200, reorder_point: 50
        },
        {
            item_code: 'ITEM-LIN-006', name: 'Double Hospital Bed Sheet (White)', description: '100% Cotton durable bedsheet with hospital branding',
            category_id: catLinen.id, item_type: 'LINEN', base_uom: 'Piece', purchase_uom: 'Pack', uom_conversion: 10,
            std_purchase_price: 180, selling_price: 0, mrp: 250, gst_rate: 5, is_batch_tracked: false, is_expiry_tracked: false,
            is_patient_chargeable: false, abc_class: 'C', ved_class: 'D', min_level: 30, max_level: 300, reorder_point: 75
        },
        {
            item_code: 'ITEM-STA-007', name: 'A4 Copier Paper 75GSM', description: 'Premium printing and copying paper',
            category_id: catStationery.id, item_type: 'STATIONERY', base_uom: 'Ream', purchase_uom: 'Box', uom_conversion: 5,
            std_purchase_price: 220, selling_price: 0, mrp: 299, gst_rate: 18, is_batch_tracked: false, is_expiry_tracked: false,
            is_patient_chargeable: false, abc_class: 'C', ved_class: 'D', min_level: 10, max_level: 100, reorder_point: 20
        }
    ];
    const seededItems = [];
    for (const item of itemsData) {
        const row = await prisma.itemMaster.upsert({
            where: { item_code_organizationId: { item_code: item.item_code, organizationId: orgId } },
            update: {
                status: 'Active',
                std_purchase_price: item.std_purchase_price,
                selling_price: item.selling_price,
                mrp: item.mrp
            },
            create: {
                ...item,
                organizationId: orgId,
                status: 'Active'
            }
        });
        seededItems.push(row);
    }
    console.log(`Seeded ${seededItems.length} item masters`);
    // 7. Seed Item Vendors Mapping
    for (const item of seededItems) {
        const preferredVendor = seededVendors[Math.floor(Math.random() * seededVendors.length)];
        await prisma.itemVendor.upsert({
            where: { item_id_vendor_id: { item_id: item.id, vendor_id: preferredVendor.id } },
            update: {},
            create: {
                item_id: item.id,
                vendor_id: preferredVendor.id,
                vendor_item_code: `${item.item_code}-VEND`,
                last_price: item.std_purchase_price,
                preference_rank: 1,
                organizationId: orgId
            }
        });
    }
    console.log('Seeded item vendor mappings');
    // 8. Seed Batches and Stocks for Central Warehouse
    const central = seededStores.find(s => s.store_code === 'CENTRAL');
    const ot = seededStores.find(s => s.store_code === 'OT-STORE');
    const lab = seededStores.find(s => s.store_code === 'LAB-STORE');
    const ward = seededStores.find(s => s.store_code === 'WARD-A-STORE');
    // Clean out existing stock records to prevent duplicates or mismatches during pilot demos
    await prisma.storeStock.deleteMany({ where: { organizationId: orgId } });
    await prisma.inventoryMovement.deleteMany({ where: { organizationId: orgId } });
    await prisma.itemBatch.deleteMany({ where: { organizationId: orgId } });
    const defaultUser = incharge || await prisma.user.findFirst({ where: { organizationId: orgId } });
    for (const item of seededItems) {
        let batchId = null;
        if (item.is_batch_tracked) {
            // Create a batch
            const batchNo = `BAT-${item.item_code.split('-')[2]}-001`;
            const expiryDate = item.is_expiry_tracked ? new Date('2027-06-30') : null;
            const batch = await prisma.itemBatch.create({
                data: {
                    item_id: item.id,
                    batch_no: batchNo,
                    expiry_date: expiryDate,
                    cost_price: item.std_purchase_price,
                    vendor_id: seededVendors[0].id,
                    organizationId: orgId
                }
            });
            batchId = batch.id;
        }
        // Seed central stock
        const centralQty = item.abc_class === 'A' ? 200 : item.abc_class === 'B' ? 50 : 30;
        await prisma.storeStock.create({
            data: {
                store_id: central.id,
                item_id: item.id,
                batch_id: batchId,
                quantity_on_hand: centralQty,
                avg_unit_cost: item.std_purchase_price,
                bin_location: 'RACK-A-01',
                organizationId: orgId
            }
        });
        // Add opening inventory movement
        await prisma.inventoryMovement.create({
            data: {
                store_id: central.id,
                item_id: item.id,
                batch_id: batchId,
                movement_type: 'OPENING',
                quantity_in: centralQty,
                quantity_out: 0,
                unit_cost: item.std_purchase_price,
                value: centralQty * item.std_purchase_price,
                balance_after: centralQty,
                source_type: 'OPENING',
                source_id: 'opening-stock',
                user_id: defaultUser.id,
                organizationId: orgId
            }
        });
        // Seed sub-store stocks for relevant departments
        if (item.category_id === catSurgical.id || item.category_id === catIV.id) {
            const otQty = 15;
            await prisma.storeStock.create({
                data: {
                    store_id: ot.id,
                    item_id: item.id,
                    batch_id: batchId,
                    quantity_on_hand: otQty,
                    avg_unit_cost: item.std_purchase_price,
                    bin_location: 'OT-RACK-01',
                    organizationId: orgId
                }
            });
            await prisma.inventoryMovement.create({
                data: {
                    store_id: ot.id,
                    item_id: item.id,
                    batch_id: batchId,
                    movement_type: 'OPENING',
                    quantity_in: otQty,
                    quantity_out: 0,
                    unit_cost: item.std_purchase_price,
                    value: otQty * item.std_purchase_price,
                    balance_after: otQty,
                    source_type: 'OPENING',
                    source_id: 'opening-stock',
                    user_id: defaultUser.id,
                    organizationId: orgId
                }
            });
            const wardQty = 10;
            await prisma.storeStock.create({
                data: {
                    store_id: ward.id,
                    item_id: item.id,
                    batch_id: batchId,
                    quantity_on_hand: wardQty,
                    avg_unit_cost: item.std_purchase_price,
                    bin_location: 'WARD-SHELF-2',
                    organizationId: orgId
                }
            });
            await prisma.inventoryMovement.create({
                data: {
                    store_id: ward.id,
                    item_id: item.id,
                    batch_id: batchId,
                    movement_type: 'OPENING',
                    quantity_in: wardQty,
                    quantity_out: 0,
                    unit_cost: item.std_purchase_price,
                    value: wardQty * item.std_purchase_price,
                    balance_after: wardQty,
                    source_type: 'OPENING',
                    source_id: 'opening-stock',
                    user_id: defaultUser.id,
                    organizationId: orgId
                }
            });
        }
        else if (item.category_id === catLab.id) {
            const labQty = 8;
            await prisma.storeStock.create({
                data: {
                    store_id: lab.id,
                    item_id: item.id,
                    batch_id: batchId,
                    quantity_on_hand: labQty,
                    avg_unit_cost: item.std_purchase_price,
                    bin_location: 'LAB-FRIDGE-1',
                    organizationId: orgId
                }
            });
            await prisma.inventoryMovement.create({
                data: {
                    store_id: lab.id,
                    item_id: item.id,
                    batch_id: batchId,
                    movement_type: 'OPENING',
                    quantity_in: labQty,
                    quantity_out: 0,
                    unit_cost: item.std_purchase_price,
                    value: labQty * item.std_purchase_price,
                    balance_after: labQty,
                    source_type: 'OPENING',
                    source_id: 'opening-stock',
                    user_id: defaultUser.id,
                    organizationId: orgId
                }
            });
        }
    }
    console.log('Seeded batch stock levels and opening movements for stores');
    // 9. Seed Store-Item Settings
    for (const store of seededStores) {
        for (const item of seededItems) {
            await prisma.storeItemSetting.create({
                data: {
                    store_id: store.id,
                    item_id: item.id,
                    par_level: item.max_level || 50,
                    reorder_point: item.reorder_point || 10,
                    max_level: item.max_level || 100,
                    auto_indent: true,
                    organizationId: orgId
                }
            });
        }
    }
    console.log('Seeded store item par and reorder level settings');
    // 10. Seed Sample Requisitions
    const requisition = await prisma.purchaseRequisition.create({
        data: {
            pr_number: 'PR-2026-0001',
            requesting_store_id: central.id,
            status: 'Submitted',
            priority: 'NORMAL',
            organizationId: orgId,
            items: {
                create: [
                    { item_id: seededItems[0].id, quantity: 50 },
                    { item_id: seededItems[2].id, quantity: 100 }
                ]
            }
        }
    });
    console.log(`Seeded sample purchase requisition: ${requisition.pr_number}`);
    // 11. Seed Sample Indents
    const indent = await prisma.indent.create({
        data: {
            indent_number: 'IND-2026-0001',
            from_store_id: ward.id,
            to_store_id: central.id,
            cost_center: ward.cost_center || 'CC-WARD-A',
            priority: 'NORMAL',
            status: 'Submitted',
            organizationId: orgId,
            items: {
                create: [
                    { item_id: seededItems[0].id, qty_requested: 5, qty_approved: 5 },
                    { item_id: seededItems[2].id, qty_requested: 10, qty_approved: 10 }
                ]
            }
        }
    });
    console.log(`Seeded sample internal indent: ${indent.indent_number}`);
    console.log('Inventory Seeding Complete!');
}
main()
    .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
