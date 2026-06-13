-- DropIndex
DROP INDEX "lab_test_inventory_test_name_key";

-- DropIndex
DROP INDEX "pharmacy_medicine_master_brand_name_key";

-- AlterTable
ALTER TABLE "tally_ledger_mapping" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tally_voucher_mapping" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "report_jobs" (
    "id" TEXT NOT NULL,
    "job_number" SERIAL NOT NULL,
    "report_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "filters_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "row_count" INTEGER,
    "file_key" TEXT,
    "format" TEXT NOT NULL,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_presets" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters_json" JSONB NOT NULL,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "preset_id" TEXT NOT NULL,
    "cron_spec" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "recipients_json" JSONB NOT NULL,
    "channel" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "last_status" TEXT,
    "owner_user_id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_access_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "filters_json" JSONB NOT NULL,
    "row_count" INTEGER,
    "format" TEXT,
    "action" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_jobs_organizationId_idx" ON "report_jobs"("organizationId");

-- CreateIndex
CREATE INDEX "report_jobs_requested_by_idx" ON "report_jobs"("requested_by");

-- CreateIndex
CREATE INDEX "report_presets_organizationId_idx" ON "report_presets"("organizationId");

-- CreateIndex
CREATE INDEX "report_presets_user_id_idx" ON "report_presets"("user_id");

-- CreateIndex
CREATE INDEX "report_schedules_organizationId_idx" ON "report_schedules"("organizationId");

-- CreateIndex
CREATE INDEX "report_access_logs_organizationId_idx" ON "report_access_logs"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "lab_test_inventory_test_name_organizationId_key" ON "lab_test_inventory"("test_name", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_medicine_master_brand_name_organizationId_key" ON "pharmacy_medicine_master"("brand_name", "organizationId");

-- AddForeignKey
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_presets" ADD CONSTRAINT "report_presets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_presets" ADD CONSTRAINT "report_presets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "report_presets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_access_logs" ADD CONSTRAINT "report_access_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_access_logs" ADD CONSTRAINT "report_access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "tally_ledger_mapping_org_account_key" RENAME TO "tally_ledger_mapping_organizationId_gl_account_id_key";

-- RenameIndex
ALTER INDEX "tally_ledger_mapping_org_idx" RENAME TO "tally_ledger_mapping_organizationId_idx";

-- RenameIndex
ALTER INDEX "tally_ledger_mapping_status_idx" RENAME TO "tally_ledger_mapping_sync_status_idx";

-- RenameIndex
ALTER INDEX "tally_sync_logs_created_idx" RENAME TO "tally_sync_logs_created_at_idx";

-- RenameIndex
ALTER INDEX "tally_sync_logs_entity_idx" RENAME TO "tally_sync_logs_entity_type_idx";

-- RenameIndex
ALTER INDEX "tally_sync_logs_org_idx" RENAME TO "tally_sync_logs_organizationId_idx";

-- RenameIndex
ALTER INDEX "tally_voucher_mapping_org_entry_key" RENAME TO "tally_voucher_mapping_organizationId_gl_journal_entry_id_key";

-- RenameIndex
ALTER INDEX "tally_voucher_mapping_org_idx" RENAME TO "tally_voucher_mapping_organizationId_idx";

-- RenameIndex
ALTER INDEX "tally_voucher_mapping_status_idx" RENAME TO "tally_voucher_mapping_sync_status_idx";

