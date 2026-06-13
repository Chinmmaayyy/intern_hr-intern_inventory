const fs = require('fs');
let p = fs.readFileSync('prisma/schema.prisma', 'utf8');

const correctPurchaseOrder = `model PurchaseOrder {
  id                Int                       @id @default(autoincrement())
  po_number         String                    @unique
  supplier_id       Int
  status            String                    @default("Draft")
  total_amount      Float                     @default(0)
  ordered_at        DateTime?
  received_at       DateTime?
  organizationId    String
  created_at        DateTime                  @default(now())
  approved_at       DateTime?
  approved_by       String?
  gst_amount        Float                     @default(0)
  notes             String?
  vendor_id         Int?
  prId              Int?
  receiving_store_id  Int?
  grns              GoodsReceiptNote[]
  purchase_invoices PharmacyPurchaseInvoice[]
  items             PurchaseOrderItem[]
  organization      Organization              @relation(fields: [organizationId], references: [id])
  stores            stores?                   @relation(fields: [receiving_store_id], references: [id])
  supplier          PharmacySupplier          @relation(fields: [supplier_id], references: [id])
  vendor            Vendor?                   @relation("VendorPurchaseOrders", fields: [vendor_id], references: [id])

  @@index([organizationId])
  @@index([vendor_id])
  @@index([receiving_store_id])
  @@map("purchase_orders")
}`;
p = p.replace(/model PurchaseOrder \{[\s\S]*?@@map\("purchase_orders"\)\r?\n\}/g, correctPurchaseOrder);

const correctPharmacyReturn = `model PharmacyReturn {
  id                  Int          @id @default(autoincrement())
  return_type         String
  medicine_id         Int?
  item_id             Int?
  store_id            Int?
  batch_id            String?
  quantity            Int
  reason              String?
  processed_by        String?
  organizationId      String
  created_at          DateTime     @default(now())
  approved_by         String?
  batch_record_id     Int?
  gl_posted           Boolean      @default(false)
  invoice_id          Int?
  original_invoice_id Int?
  po_id               Int?
  status              String       @default("Pending")
  unit_cost           Float?
  vendor_id           Int?
  organization        Organization @relation(fields: [organizationId], references: [id])
  item                ItemMaster?  @relation(fields: [item_id], references: [id])
  store               Store?       @relation(fields: [store_id], references: [id])

  @@index([organizationId])
  @@index([return_type])
  @@index([vendor_id])
  @@index([item_id])
  @@index([store_id])
  @@map("pharmacy_returns")
}`;
p = p.replace(/model PharmacyReturn \{[\s\S]*?@@map\("pharmacy_returns"\)\r?\n\}/g, correctPharmacyReturn);

const correctPharmacyPurchaseInvoiceLine = `model PharmacyPurchaseInvoiceLine {
  id          Int                      @id @default(autoincrement())
  invoice_id  Int
  medicine_id Int?
  item_id     Int?
  grn_id      Int?
  po_item_id  Int?
  quantity    Int
  unit_price  Float
  gst_rate    Float                    @default(0)
  cgst_amount Float                    @default(0)
  sgst_amount Float                    @default(0)
  igst_amount Float                    @default(0)
  line_total  Float
  hsn_code    String?
  invoice     PharmacyPurchaseInvoice  @relation(fields: [invoice_id], references: [id])
  medicine    pharmacy_medicine_master? @relation(fields: [medicine_id], references: [id])
  item        ItemMaster?               @relation(fields: [item_id], references: [id])

  @@index([invoice_id])
  @@index([item_id])
  @@map("pharmacy_purchase_invoice_lines")
}`;
p = p.replace(/model PharmacyPurchaseInvoiceLine \{[\s\S]*?@@map\("pharmacy_purchase_invoice_lines"\)\r?\n\}/g, correctPharmacyPurchaseInvoiceLine);

const correctGoodsReceiptNoteItem = `model GoodsReceiptNoteItem {
  id                Int       @id @default(autoincrement())
  grn_id            Int
  item_id           Int
  quantity_accepted Int
  quantity_rejected Int       @default(0)
  rejection_reason  String?
  batch_no          String?
  expiry_date       DateTime?
  unit_price        Float     @default(0)
  gst_rate          Float     @default(0)

  grn  GoodsReceiptNote @relation(fields: [grn_id], references: [id], onDelete: Cascade)
  item ItemMaster       @relation(fields: [item_id], references: [id])

  @@index([grn_id])
  @@map("goods_receipt_note_items")
}

model ReportJob {
  id             String       @id @default(uuid())
  job_number     Int          @default(autoincrement())
  report_id      String
  requested_by   String
  filters_json   Json
  status         String       @default("Queued")
  progress       Int          @default(0)
  row_count      Int?
  file_key       String?
  format         String
  error          String?
  started_at     DateTime?
  finished_at    DateTime?
  expires_at     DateTime?
  organizationId String
  createdAt      DateTime     @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id])
  user           User         @relation("ReportJobRequestedBy", fields: [requested_by], references: [id])

  @@index([organizationId])
  @@index([requested_by])
  @@map("report_jobs")
}`;
p = p.replace(/model GoodsReceiptNoteItem \{[\s\S]*?@@map\("report_jobs"\)\r?\n\}/g, correctGoodsReceiptNoteItem);

fs.writeFileSync('prisma/schema.prisma', p);
