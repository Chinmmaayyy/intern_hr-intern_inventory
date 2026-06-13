-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_receivingStoreId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_order_items" DROP CONSTRAINT "purchase_order_items_itemId_fkey";

-- DropForeignKey
ALTER TABLE "goods_receipt_notes" DROP CONSTRAINT "goods_receipt_notes_storeId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeeDocument" DROP CONSTRAINT "EmployeeDocument_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "pharmacy_purchase_invoice_lines" DROP CONSTRAINT "pharmacy_purchase_invoice_lines_medicine_id_fkey";

-- DropForeignKey
ALTER TABLE "indent_items" DROP CONSTRAINT "indent_items_indentId_fkey";

-- DropForeignKey
ALTER TABLE "indent_items" DROP CONSTRAINT "indent_items_itemId_fkey";

-- DropForeignKey
ALTER TABLE "indents" DROP CONSTRAINT "indents_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "indents" DROP CONSTRAINT "indents_fromStoreId_fkey";

-- DropForeignKey
ALTER TABLE "indents" DROP CONSTRAINT "indents_toStoreId_fkey";

-- DropForeignKey
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_batchId_fkey";

-- DropForeignKey
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_itemId_fkey";

-- DropForeignKey
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_storeId_fkey";

-- DropForeignKey
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_userId_fkey";

-- DropForeignKey
ALTER TABLE "item_batches" DROP CONSTRAINT "item_batches_itemId_fkey";

-- DropForeignKey
ALTER TABLE "item_batches" DROP CONSTRAINT "item_batches_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "item_categories" DROP CONSTRAINT "item_categories_parentId_fkey";

-- DropForeignKey
ALTER TABLE "item_master" DROP CONSTRAINT "item_master_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "item_vendors" DROP CONSTRAINT "item_vendors_itemId_fkey";

-- DropForeignKey
ALTER TABLE "item_vendors" DROP CONSTRAINT "item_vendors_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_requisition_items" DROP CONSTRAINT "purchase_requisition_items_itemId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_requisition_items" DROP CONSTRAINT "purchase_requisition_items_prId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_requisitions" DROP CONSTRAINT "purchase_requisitions_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "purchase_requisitions" DROP CONSTRAINT "purchase_requisitions_requestingStoreId_fkey";

-- DropForeignKey
ALTER TABLE "stock_adjustments" DROP CONSTRAINT "stock_adjustments_countSessionId_fkey";

-- DropForeignKey
ALTER TABLE "stock_adjustments" DROP CONSTRAINT "stock_adjustments_storeId_fkey";

-- DropForeignKey
ALTER TABLE "stock_count_lines" DROP CONSTRAINT "stock_count_lines_batchId_fkey";

-- DropForeignKey
ALTER TABLE "stock_count_lines" DROP CONSTRAINT "stock_count_lines_itemId_fkey";

-- DropForeignKey
ALTER TABLE "stock_count_lines" DROP CONSTRAINT "stock_count_lines_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "stock_count_sessions" DROP CONSTRAINT "stock_count_sessions_storeId_fkey";

-- DropForeignKey
ALTER TABLE "stock_issue_items" DROP CONSTRAINT "stock_issue_items_batchId_fkey";

-- DropForeignKey
ALTER TABLE "stock_issue_items" DROP CONSTRAINT "stock_issue_items_issueId_fkey";

-- DropForeignKey
ALTER TABLE "stock_issue_items" DROP CONSTRAINT "stock_issue_items_itemId_fkey";

-- DropForeignKey
ALTER TABLE "stock_issues" DROP CONSTRAINT "stock_issues_fromStoreId_fkey";

-- DropForeignKey
ALTER TABLE "stock_issues" DROP CONSTRAINT "stock_issues_indentId_fkey";

-- DropForeignKey
ALTER TABLE "stock_issues" DROP CONSTRAINT "stock_issues_issuedById_fkey";

-- DropForeignKey
ALTER TABLE "stock_transfer_items" DROP CONSTRAINT "stock_transfer_items_batchId_fkey";

-- DropForeignKey
ALTER TABLE "stock_transfer_items" DROP CONSTRAINT "stock_transfer_items_itemId_fkey";

-- DropForeignKey
ALTER TABLE "stock_transfer_items" DROP CONSTRAINT "stock_transfer_items_transferId_fkey";

-- DropForeignKey
ALTER TABLE "stock_transfers" DROP CONSTRAINT "stock_transfers_fromStoreId_fkey";

-- DropForeignKey
ALTER TABLE "stock_transfers" DROP CONSTRAINT "stock_transfers_toStoreId_fkey";

-- DropForeignKey
ALTER TABLE "store_item_settings" DROP CONSTRAINT "store_item_settings_itemId_fkey";

-- DropForeignKey
ALTER TABLE "store_item_settings" DROP CONSTRAINT "store_item_settings_storeId_fkey";

-- DropForeignKey
ALTER TABLE "store_stock" DROP CONSTRAINT "store_stock_batchId_fkey";

-- DropForeignKey
ALTER TABLE "store_stock" DROP CONSTRAINT "store_stock_itemId_fkey";

-- DropForeignKey
ALTER TABLE "store_stock" DROP CONSTRAINT "store_stock_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "store_stock" DROP CONSTRAINT "store_stock_storeId_fkey";

-- DropForeignKey
ALTER TABLE "stores" DROP CONSTRAINT "stores_branchId_fkey";

-- DropForeignKey
ALTER TABLE "stores" DROP CONSTRAINT "stores_inchargeUserId_fkey";

-- DropForeignKey
ALTER TABLE "stores" DROP CONSTRAINT "stores_parentStoreId_fkey";

-- DropIndex
DROP INDEX "indents_indentNumber_key";

-- DropIndex
DROP INDEX "indents_organizationId_status_idx";

-- DropIndex
DROP INDEX "inventory_movements_glJournalId_idx";

-- DropIndex
DROP INDEX "inventory_movements_storeId_itemId_createdAt_idx";

-- DropIndex
DROP INDEX "item_batches_expiryDate_idx";

-- DropIndex
DROP INDEX "item_batches_itemId_batchNo_key";

-- DropIndex
DROP INDEX "item_master_status_organizationId_idx";

-- DropIndex
DROP INDEX "item_master_itemCode_organizationId_key";

-- DropIndex
DROP INDEX "purchase_requisitions_prNumber_key";

-- DropIndex
DROP INDEX "purchase_requisitions_organizationId_status_idx";

-- DropIndex
DROP INDEX "stock_adjustments_adjustmentNumber_key";

-- DropIndex
DROP INDEX "stock_count_sessions_sessionRef_key";

-- DropIndex
DROP INDEX "stock_issues_issueNumber_key";

-- DropIndex
DROP INDEX "stock_transfers_transferNumber_key";

-- DropIndex
DROP INDEX "store_item_settings_storeId_itemId_key";

-- DropIndex
DROP INDEX "stores_storeCode_organizationId_key";

-- AlterTable
ALTER TABLE "purchase_orders" DROP COLUMN "prId",
DROP COLUMN "receivingStoreId",
ADD COLUMN     "pr_id" INTEGER,
ADD COLUMN     "receiving_store_id" INTEGER,
ALTER COLUMN "supplier_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "purchase_order_items" DROP COLUMN "conversionToBase",
DROP COLUMN "itemId",
ADD COLUMN     "conversion_to_base" DOUBLE PRECISION DEFAULT 1.0,
ADD COLUMN     "item_id" INTEGER,
ALTER COLUMN "medicine_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "goods_receipt_notes" DROP COLUMN "storeId",
ADD COLUMN     "store_id" INTEGER;

-- AlterTable
ALTER TABLE "pharmacy_returns" ADD COLUMN     "item_id" INTEGER,
ADD COLUMN     "store_id" INTEGER,
ALTER COLUMN "medicine_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "surgery_consumables" ADD COLUMN     "item_id" INTEGER,
ADD COLUMN     "movement_id" INTEGER,
ADD COLUMN     "store_id" INTEGER;

-- AlterTable
ALTER TABLE "pharmacy_purchase_invoice_lines" ADD COLUMN     "item_id" INTEGER,
ALTER COLUMN "medicine_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "indent_items" DROP COLUMN "indentId",
DROP COLUMN "itemId",
DROP COLUMN "qtyApproved",
DROP COLUMN "qtyIssued",
DROP COLUMN "qtyReceived",
DROP COLUMN "qtyRequested",
ADD COLUMN     "indent_id" INTEGER NOT NULL,
ADD COLUMN     "item_id" INTEGER NOT NULL,
ADD COLUMN     "qty_approved" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "qty_issued" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "qty_received" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "qty_requested" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "indents" DROP COLUMN "admissionId",
DROP COLUMN "approvedById",
DROP COLUMN "costCenter",
DROP COLUMN "createdAt",
DROP COLUMN "fromStoreId",
DROP COLUMN "indentNumber",
DROP COLUMN "patientId",
DROP COLUMN "toStoreId",
DROP COLUMN "updatedAt",
ADD COLUMN     "admission_id" TEXT,
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by" TEXT,
ADD COLUMN     "cost_center" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "from_store_id" INTEGER NOT NULL,
ADD COLUMN     "indent_number" TEXT NOT NULL,
ADD COLUMN     "patient_id" TEXT,
ADD COLUMN     "to_store_id" INTEGER NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'Draft';

-- AlterTable
ALTER TABLE "inventory_movements" DROP COLUMN "admissionId",
DROP COLUMN "balanceAfter",
DROP COLUMN "batchId",
DROP COLUMN "costCenter",
DROP COLUMN "createdAt",
DROP COLUMN "glJournalId",
DROP COLUMN "itemId",
DROP COLUMN "movementType",
DROP COLUMN "patientId",
DROP COLUMN "quantityIn",
DROP COLUMN "quantityOut",
DROP COLUMN "sourceId",
DROP COLUMN "sourceType",
DROP COLUMN "storeId",
DROP COLUMN "unitCost",
DROP COLUMN "userId",
ADD COLUMN     "admission_id" TEXT,
ADD COLUMN     "balance_after" INTEGER NOT NULL,
ADD COLUMN     "batch_id" INTEGER,
ADD COLUMN     "cost_center" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "gl_journal_id" TEXT,
ADD COLUMN     "item_id" INTEGER NOT NULL,
ADD COLUMN     "movement_type" TEXT NOT NULL,
ADD COLUMN     "patient_id" TEXT,
ADD COLUMN     "quantity_in" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quantity_out" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "source_id" TEXT,
ADD COLUMN     "source_type" TEXT,
ADD COLUMN     "store_id" INTEGER NOT NULL,
ADD COLUMN     "unit_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "user_id" TEXT,
ALTER COLUMN "value" SET DEFAULT 0,
ALTER COLUMN "value" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "item_batches" DROP COLUMN "batchNo",
DROP COLUMN "costPrice",
DROP COLUMN "createdAt",
DROP COLUMN "expiryDate",
DROP COLUMN "grnId",
DROP COLUMN "isQuarantined",
DROP COLUMN "itemId",
DROP COLUMN "mfgDate",
DROP COLUMN "vendorId",
ADD COLUMN     "batch_no" TEXT NOT NULL,
ADD COLUMN     "cost_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expiry_date" TIMESTAMP(3),
ADD COLUMN     "grn_id" INTEGER,
ADD COLUMN     "is_quarantined" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "item_id" INTEGER NOT NULL,
ADD COLUMN     "mfg_date" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "vendor_id" INTEGER,
ALTER COLUMN "mrp" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "item_categories" DROP COLUMN "createdAt",
DROP COLUMN "defaultGstRate",
DROP COLUMN "glCogsAccountId",
DROP COLUMN "glExpenseAccountId",
DROP COLUMN "glInventoryAccountId",
DROP COLUMN "itemType",
DROP COLUMN "parentId",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "default_gst_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "gl_cogs_account_id" TEXT,
ADD COLUMN     "gl_expense_account_id" TEXT,
ADD COLUMN     "gl_inventory_account_id" TEXT,
ADD COLUMN     "item_type" TEXT NOT NULL,
ADD COLUMN     "parent_id" INTEGER,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "item_master" DROP COLUMN "abcClass",
DROP COLUMN "baseUom",
DROP COLUMN "categoryId",
DROP COLUMN "chargeCatalogId",
DROP COLUMN "createdAt",
DROP COLUMN "gstRate",
DROP COLUMN "hsnSacCode",
DROP COLUMN "isBatchTracked",
DROP COLUMN "isColdChain",
DROP COLUMN "isExpiryTracked",
DROP COLUMN "isPatientChargeable",
DROP COLUMN "isReturnable",
DROP COLUMN "itemCode",
DROP COLUMN "itemType",
DROP COLUMN "leadTimeDays",
DROP COLUMN "maxLevel",
DROP COLUMN "minLevel",
DROP COLUMN "purchaseUom",
DROP COLUMN "reorderPoint",
DROP COLUMN "sellingPrice",
DROP COLUMN "specAttachmentUrl",
DROP COLUMN "stdPurchasePrice",
DROP COLUMN "uomConversion",
DROP COLUMN "updatedAt",
DROP COLUMN "vedClass",
ADD COLUMN     "abc_class" TEXT,
ADD COLUMN     "base_uom" TEXT NOT NULL,
ADD COLUMN     "category_id" INTEGER NOT NULL,
ADD COLUMN     "charge_catalog_id" INTEGER,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "double_check_rop" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gst_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "hsn_sac_code" TEXT,
ADD COLUMN     "is_batch_tracked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_cold_chain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_expiry_tracked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_patient_chargeable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_returnable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "item_code" TEXT NOT NULL,
ADD COLUMN     "item_type" TEXT NOT NULL,
ADD COLUMN     "lead_time_days" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "max_level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "min_level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "purchase_uom" TEXT NOT NULL,
ADD COLUMN     "reorder_point" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "selling_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "std_purchase_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "uom_conversion" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "ved_class" TEXT,
ALTER COLUMN "mrp" SET NOT NULL,
ALTER COLUMN "mrp" SET DEFAULT 0,
ALTER COLUMN "mrp" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "status" SET DEFAULT 'Active';

-- AlterTable
ALTER TABLE "item_vendors" DROP COLUMN "createdAt",
DROP COLUMN "itemId",
DROP COLUMN "lastPrice",
DROP COLUMN "preferenceRank",
DROP COLUMN "vendorId",
DROP COLUMN "vendorItemCode",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "item_id" INTEGER NOT NULL,
ADD COLUMN     "last_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "preference_rank" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "vendor_id" INTEGER NOT NULL,
ADD COLUMN     "vendor_item_code" TEXT;

-- AlterTable
ALTER TABLE "purchase_requisition_items" DROP COLUMN "itemId",
DROP COLUMN "prId",
DROP COLUMN "requiredBy",
DROP COLUMN "uom",
ADD COLUMN     "item_id" INTEGER NOT NULL,
ADD COLUMN     "pr_id" INTEGER NOT NULL,
ADD COLUMN     "required_by" TIMESTAMP(3),
ALTER COLUMN "quantity" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "purchase_requisitions" DROP COLUMN "approvedAt",
DROP COLUMN "approvedById",
DROP COLUMN "createdAt",
DROP COLUMN "notes",
DROP COLUMN "prNumber",
DROP COLUMN "requestingStoreId",
DROP COLUMN "updatedAt",
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "pr_number" TEXT NOT NULL,
ADD COLUMN     "requesting_store_id" INTEGER NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'Draft';

-- AlterTable
ALTER TABLE "stock_adjustments" DROP COLUMN "adjustmentNumber",
DROP COLUMN "approvedById",
DROP COLUMN "countSessionId",
DROP COLUMN "createdAt",
DROP COLUMN "glPosted",
DROP COLUMN "reasonCode",
DROP COLUMN "storeId",
ADD COLUMN     "adjustment_number" TEXT NOT NULL,
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by" TEXT,
ADD COLUMN     "count_session_id" INTEGER,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "gl_posted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reason_code" TEXT NOT NULL,
ADD COLUMN     "store_id" INTEGER NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'Pending';

-- AlterTable
ALTER TABLE "stock_count_lines" DROP COLUMN "approvedById",
DROP COLUMN "batchId",
DROP COLUMN "bookQty",
DROP COLUMN "countedQty",
DROP COLUMN "itemId",
DROP COLUMN "recountQty",
DROP COLUMN "sessionId",
DROP COLUMN "varianceValue",
ADD COLUMN     "batch_id" INTEGER,
ADD COLUMN     "book_qty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "counted_qty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "item_id" INTEGER NOT NULL,
ADD COLUMN     "recount_qty" INTEGER,
ADD COLUMN     "recount_requested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "session_id" INTEGER NOT NULL,
ADD COLUMN     "variance_value" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "stock_count_sessions" DROP COLUMN "approvedById",
DROP COLUMN "blindCount",
DROP COLUMN "createdAt",
DROP COLUMN "postedAt",
DROP COLUMN "scopeFilter",
DROP COLUMN "sessionRef",
DROP COLUMN "storeId",
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "frozen_at" TIMESTAMP(3),
ADD COLUMN     "session_number" TEXT NOT NULL,
ADD COLUMN     "store_id" INTEGER NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'Draft';

-- AlterTable
ALTER TABLE "stock_issue_items" DROP COLUMN "batchId",
DROP COLUMN "issueId",
DROP COLUMN "itemId",
DROP COLUMN "unitCost",
ADD COLUMN     "batch_id" INTEGER,
ADD COLUMN     "issue_id" INTEGER NOT NULL,
ADD COLUMN     "item_id" INTEGER NOT NULL,
ADD COLUMN     "unit_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "quantity" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "stock_issues" DROP COLUMN "costCenter",
DROP COLUMN "createdAt",
DROP COLUMN "fromStoreId",
DROP COLUMN "indentId",
DROP COLUMN "issueNumber",
DROP COLUMN "issuedById",
DROP COLUMN "status",
DROP COLUMN "toStoreId",
ADD COLUMN     "cost_center" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "from_store_id" INTEGER NOT NULL,
ADD COLUMN     "indent_id" INTEGER,
ADD COLUMN     "issue_number" TEXT NOT NULL,
ADD COLUMN     "to_store_id" INTEGER,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "stock_transfer_items" DROP COLUMN "batchId",
DROP COLUMN "itemId",
DROP COLUMN "transferId",
DROP COLUMN "unitCost",
ADD COLUMN     "batch_id" INTEGER,
ADD COLUMN     "item_id" INTEGER NOT NULL,
ADD COLUMN     "transfer_id" INTEGER NOT NULL,
ADD COLUMN     "unit_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "quantity" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "stock_transfers" DROP COLUMN "createdAt",
DROP COLUMN "dispatchedAt",
DROP COLUMN "dispatchedById",
DROP COLUMN "fromStoreId",
DROP COLUMN "receivedAt",
DROP COLUMN "receivedById",
DROP COLUMN "toStoreId",
DROP COLUMN "transferNumber",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dispatch_at" TIMESTAMP(3),
ADD COLUMN     "dispatch_user_id" TEXT,
ADD COLUMN     "from_store_id" INTEGER NOT NULL,
ADD COLUMN     "receive_user_id" TEXT,
ADD COLUMN     "received_at" TIMESTAMP(3),
ADD COLUMN     "to_store_id" INTEGER NOT NULL,
ADD COLUMN     "transfer_number" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'Draft';

-- AlterTable
ALTER TABLE "store_item_settings" DROP COLUMN "autoIndent",
DROP COLUMN "itemId",
DROP COLUMN "maxLevel",
DROP COLUMN "parLevel",
DROP COLUMN "reorderPoint",
DROP COLUMN "storeId",
ADD COLUMN     "auto_indent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "item_id" INTEGER NOT NULL,
ADD COLUMN     "max_level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "par_level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reorder_point" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "store_id" INTEGER NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "stores" DROP COLUMN "branchId",
DROP COLUMN "costCenter",
DROP COLUMN "createdAt",
DROP COLUMN "inchargeUserId",
DROP COLUMN "isActive",
DROP COLUMN "parentStoreId",
DROP COLUMN "storeCode",
DROP COLUMN "storeType",
DROP COLUMN "updatedAt",
ADD COLUMN     "branch_id" TEXT,
ADD COLUMN     "cost_center" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "incharge_user_id" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "parent_store_id" INTEGER,
ADD COLUMN     "store_code" TEXT NOT NULL,
ADD COLUMN     "store_type" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "EmployeeDocument";

-- DropTable
DROP TABLE "store_stock";

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT,
    "issuingAuthority" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "fileUrl" TEXT,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_stocks" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "batch_id" INTEGER,
    "quantity_on_hand" INTEGER NOT NULL DEFAULT 0,
    "quantity_reserved" INTEGER NOT NULL DEFAULT 0,
    "avg_unit_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bin_location" TEXT,
    "organizationId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_note_items" (
    "id" SERIAL NOT NULL,
    "grn_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity_accepted" INTEGER NOT NULL,
    "quantity_rejected" INTEGER NOT NULL DEFAULT 0,
    "rejection_reason" TEXT,
    "batch_no" TEXT,
    "expiry_date" TIMESTAMP(3),
    "unit_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gst_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "goods_receipt_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_documents_employeeId_idx" ON "employee_documents"("employeeId");

-- CreateIndex
CREATE INDEX "store_stocks_organizationId_idx" ON "store_stocks"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "store_stocks_store_id_item_id_batch_id_key" ON "store_stocks"("store_id", "item_id", "batch_id");

-- CreateIndex
CREATE INDEX "goods_receipt_note_items_grn_id_idx" ON "goods_receipt_note_items"("grn_id");

-- CreateIndex
CREATE INDEX "purchase_orders_receiving_store_id_idx" ON "purchase_orders"("receiving_store_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_item_id_idx" ON "purchase_order_items"("item_id");

-- CreateIndex
CREATE INDEX "goods_receipt_notes_store_id_idx" ON "goods_receipt_notes"("store_id");

-- CreateIndex
CREATE INDEX "pharmacy_returns_item_id_idx" ON "pharmacy_returns"("item_id");

-- CreateIndex
CREATE INDEX "pharmacy_returns_store_id_idx" ON "pharmacy_returns"("store_id");

-- CreateIndex
CREATE INDEX "surgery_consumables_item_id_idx" ON "surgery_consumables"("item_id");

-- CreateIndex
CREATE INDEX "surgery_consumables_store_id_idx" ON "surgery_consumables"("store_id");

-- CreateIndex
CREATE INDEX "pharmacy_purchase_invoice_lines_item_id_idx" ON "pharmacy_purchase_invoice_lines"("item_id");

-- CreateIndex
CREATE INDEX "indent_items_indent_id_idx" ON "indent_items"("indent_id");

-- CreateIndex
CREATE UNIQUE INDEX "indents_indent_number_key" ON "indents"("indent_number");

-- CreateIndex
CREATE INDEX "indents_organizationId_idx" ON "indents"("organizationId");

-- CreateIndex
CREATE INDEX "inventory_movements_store_id_idx" ON "inventory_movements"("store_id");

-- CreateIndex
CREATE INDEX "inventory_movements_item_id_idx" ON "inventory_movements"("item_id");

-- CreateIndex
CREATE INDEX "inventory_movements_batch_id_idx" ON "inventory_movements"("batch_id");

-- CreateIndex
CREATE INDEX "inventory_movements_movement_type_idx" ON "inventory_movements"("movement_type");

-- CreateIndex
CREATE INDEX "inventory_movements_created_at_idx" ON "inventory_movements"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "item_batches_item_id_batch_no_key" ON "item_batches"("item_id", "batch_no");

-- CreateIndex
CREATE UNIQUE INDEX "item_categories_name_organizationId_key" ON "item_categories"("name", "organizationId");

-- CreateIndex
CREATE INDEX "item_master_category_id_idx" ON "item_master"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_master_item_code_organizationId_key" ON "item_master"("item_code", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "item_vendors_item_id_vendor_id_key" ON "item_vendors"("item_id", "vendor_id");

-- CreateIndex
CREATE INDEX "purchase_requisition_items_pr_id_idx" ON "purchase_requisition_items"("pr_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requisitions_pr_number_key" ON "purchase_requisitions"("pr_number");

-- CreateIndex
CREATE INDEX "purchase_requisitions_organizationId_idx" ON "purchase_requisitions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_adjustment_number_key" ON "stock_adjustments"("adjustment_number");

-- CreateIndex
CREATE INDEX "stock_count_lines_session_id_idx" ON "stock_count_lines"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_count_sessions_session_number_key" ON "stock_count_sessions"("session_number");

-- CreateIndex
CREATE INDEX "stock_issue_items_issue_id_idx" ON "stock_issue_items"("issue_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_issues_issue_number_key" ON "stock_issues"("issue_number");

-- CreateIndex
CREATE INDEX "stock_transfer_items_transfer_id_idx" ON "stock_transfer_items"("transfer_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_transfer_number_key" ON "stock_transfers"("transfer_number");

-- CreateIndex
CREATE INDEX "store_item_settings_organizationId_idx" ON "store_item_settings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "store_item_settings_store_id_item_id_key" ON "store_item_settings"("store_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "stores_store_code_organizationId_key" ON "stores"("store_code", "organizationId");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "pharmacy_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_receiving_store_id_fkey" FOREIGN KEY ("receiving_store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_pr_id_fkey" FOREIGN KEY ("pr_id") REFERENCES "purchase_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_returns" ADD CONSTRAINT "pharmacy_returns_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_returns" ADD CONSTRAINT "pharmacy_returns_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surgery_consumables" ADD CONSTRAINT "surgery_consumables_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surgery_consumables" ADD CONSTRAINT "surgery_consumables_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_purchase_invoice_lines" ADD CONSTRAINT "pharmacy_purchase_invoice_lines_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "pharmacy_medicine_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_purchase_invoice_lines" ADD CONSTRAINT "pharmacy_purchase_invoice_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "item_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_gl_inventory_account_id_fkey" FOREIGN KEY ("gl_inventory_account_id") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_gl_expense_account_id_fkey" FOREIGN KEY ("gl_expense_account_id") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_gl_cogs_account_id_fkey" FOREIGN KEY ("gl_cogs_account_id") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_master" ADD CONSTRAINT "item_master_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "item_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_master" ADD CONSTRAINT "item_master_charge_catalog_id_fkey" FOREIGN KEY ("charge_catalog_id") REFERENCES "charge_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_vendors" ADD CONSTRAINT "item_vendors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_vendors" ADD CONSTRAINT "item_vendors_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_vendors" ADD CONSTRAINT "item_vendors_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_parent_store_id_fkey" FOREIGN KEY ("parent_store_id") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_incharge_user_id_fkey" FOREIGN KEY ("incharge_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_item_settings" ADD CONSTRAINT "store_item_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_item_settings" ADD CONSTRAINT "store_item_settings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_item_settings" ADD CONSTRAINT "store_item_settings_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_batches" ADD CONSTRAINT "item_batches_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_batches" ADD CONSTRAINT "item_batches_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "goods_receipt_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_batches" ADD CONSTRAINT "item_batches_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_stocks" ADD CONSTRAINT "store_stocks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_stocks" ADD CONSTRAINT "store_stocks_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_stocks" ADD CONSTRAINT "store_stocks_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_stocks" ADD CONSTRAINT "store_stocks_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_gl_journal_id_fkey" FOREIGN KEY ("gl_journal_id") REFERENCES "gl_journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("admission_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_requesting_store_id_fkey" FOREIGN KEY ("requesting_store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_pr_id_fkey" FOREIGN KEY ("pr_id") REFERENCES "purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indents" ADD CONSTRAINT "indents_from_store_id_fkey" FOREIGN KEY ("from_store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indents" ADD CONSTRAINT "indents_to_store_id_fkey" FOREIGN KEY ("to_store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indents" ADD CONSTRAINT "indents_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("admission_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indent_items" ADD CONSTRAINT "indent_items_indent_id_fkey" FOREIGN KEY ("indent_id") REFERENCES "indents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indent_items" ADD CONSTRAINT "indent_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_indent_id_fkey" FOREIGN KEY ("indent_id") REFERENCES "indents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_from_store_id_fkey" FOREIGN KEY ("from_store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_to_store_id_fkey" FOREIGN KEY ("to_store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_issue_items" ADD CONSTRAINT "stock_issue_items_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "stock_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_issue_items" ADD CONSTRAINT "stock_issue_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_issue_items" ADD CONSTRAINT "stock_issue_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_store_id_fkey" FOREIGN KEY ("from_store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_store_id_fkey" FOREIGN KEY ("to_store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_dispatch_user_id_fkey" FOREIGN KEY ("dispatch_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_receive_user_id_fkey" FOREIGN KEY ("receive_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_sessions" ADD CONSTRAINT "stock_count_sessions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "stock_count_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_count_session_id_fkey" FOREIGN KEY ("count_session_id") REFERENCES "stock_count_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_note_items" ADD CONSTRAINT "goods_receipt_note_items_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "goods_receipt_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_note_items" ADD CONSTRAINT "goods_receipt_note_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
