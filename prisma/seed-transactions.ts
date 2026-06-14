import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const ORG_ID = 'org-avani-default';
// Generating 5000 transactions across core tables to stress-test the MIS Reports
const TRANSACTIONS_COUNT = 5000;
// We'll generate 1000 patients to attach the transactions to.
const PATIENT_COUNT = 1000;
const DOCTOR_ID = crypto.randomUUID();

function getRandomDateWithinLast6Months(): Date {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 6);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function main() {
  console.log(`Starting to seed ${TRANSACTIONS_COUNT} records for organization: ${ORG_ID}`);

  // 1. Ensure the Organization exists
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: {
      id: ORG_ID,
      name: 'Avani Default Organization',
      slug: 'avani-default',
      code: 'AVN-DEF',
    },
  });
  console.log('✅ Organization ensured');

  // 2. Generate OPD_REG (Patients)
  console.log(`Generating ${PATIENT_COUNT} patients...`);
  const patients = Array.from({ length: PATIENT_COUNT }).map((_, i) => ({
    patient_id: `PAT-${ORG_ID}-${crypto.randomUUID().substring(0, 8)}`,
    full_name: `Test Patient ${i}`,
    organizationId: ORG_ID,
    patient_type: 'cash',
    created_at: getRandomDateWithinLast6Months(),
  }));
  
  // We use createMany for bulk insertion
  await prisma.oPD_REG.createMany({
    data: patients,
    skipDuplicates: true,
  });
  console.log('✅ Patients seeded');

  const patientIds = patients.map((p) => p.patient_id);

  // 3. Generate Appointments
  console.log(`Generating ${TRANSACTIONS_COUNT} appointments...`);
  const appointments = Array.from({ length: TRANSACTIONS_COUNT }).map(() => ({
    appointment_id: `APT-${crypto.randomUUID().substring(0, 8)}`,
    patient_id: patientIds[Math.floor(Math.random() * PATIENT_COUNT)],
    doctor_id: DOCTOR_ID,
    status: ['Pending', 'Completed', 'Cancelled'][Math.floor(Math.random() * 3)],
    organizationId: ORG_ID,
    appointment_date: getRandomDateWithinLast6Months(),
    payment_mode: 'ONLINE',
    appointment_type: 'NEW_OPD',
    payment_status: 'PAID',
  }));

  await prisma.appointments.createMany({
    data: appointments,
    skipDuplicates: true,
  });
  console.log('✅ Appointments seeded');

  // 4. Generate Lab Orders
  console.log(`Generating ${TRANSACTIONS_COUNT} lab orders...`);
  const labOrders = Array.from({ length: TRANSACTIONS_COUNT }).map(() => ({
    barcode: `LAB-${crypto.randomUUID().substring(0, 8)}`,
    patient_id: patientIds[Math.floor(Math.random() * PATIENT_COUNT)],
    doctor_id: DOCTOR_ID,
    test_type: 'Blood Test',
    status: ['Pending', 'Completed'][Math.floor(Math.random() * 2)],
    organizationId: ORG_ID,
    created_at: getRandomDateWithinLast6Months(),
  }));

  await prisma.lab_orders.createMany({
    data: labOrders,
    skipDuplicates: true,
  });
  console.log('✅ Lab Orders seeded');

  // 5. Generate Pharmacy Orders
  console.log(`Generating ${TRANSACTIONS_COUNT} pharmacy orders...`);
  const pharmacyOrders = Array.from({ length: TRANSACTIONS_COUNT }).map(() => ({
    patient_id: patientIds[Math.floor(Math.random() * PATIENT_COUNT)],
    doctor_id: DOCTOR_ID,
    total_amount: Math.floor(Math.random() * 5000),
    status: ['Pending', 'Completed', 'Dispensed'][Math.floor(Math.random() * 3)],
    organizationId: ORG_ID,
    created_at: getRandomDateWithinLast6Months(),
  }));

  await prisma.pharmacy_orders.createMany({
    data: pharmacyOrders,
    skipDuplicates: true,
  });
  console.log('✅ Pharmacy Orders seeded');

  // 6. Generate Invoices
  console.log(`Generating ${TRANSACTIONS_COUNT} invoices...`);
  const invoicesData = Array.from({ length: TRANSACTIONS_COUNT }).map(() => {
    const amount = Math.floor(Math.random() * 10000) + 500;
    return {
      invoice_number: `INV-${crypto.randomUUID().substring(0, 8)}`,
      patient_id: patientIds[Math.floor(Math.random() * PATIENT_COUNT)],
      invoice_type: 'OPD',
      total_amount: amount,
      net_amount: amount,
      paid_amount: amount,
      balance_due: 0,
      status: 'Paid',
      organizationId: ORG_ID,
      created_at: getRandomDateWithinLast6Months(),
      updated_at: new Date(),
    };
  });

  await prisma.invoices.createMany({
    data: invoicesData,
    skipDuplicates: true,
  });
  console.log('✅ Invoices seeded');

  // 7. Generate Payments attached to the invoices
  console.log(`Fetching invoices to generate payments...`);
  // Note: We fetch the invoices to get their autoincrement integer IDs
  const createdInvoices = await prisma.invoices.findMany({
    where: { organizationId: ORG_ID },
    select: { id: true, net_amount: true, created_at: true },
    take: TRANSACTIONS_COUNT,
    orderBy: { id: 'desc' },
  });

  console.log(`Generating ${createdInvoices.length} payments...`);
  const payments = createdInvoices.map((inv) => ({
    receipt_number: `RCPT-${crypto.randomUUID().substring(0, 8)}`,
    invoice_id: inv.id,
    amount: inv.net_amount,
    payment_method: ['UPI', 'CREDIT_CARD', 'CASH'][Math.floor(Math.random() * 3)],
    payment_type: 'FULL',
    status: 'Completed',
    organizationId: ORG_ID,
    created_at: inv.created_at, // Aligned with invoice creation time for realistic reporting
  }));

  // Chunking payments in case of limit (Prisma normally handles bulk inserts well, but good practice)
  const chunkSize = 1000;
  for (let i = 0; i < payments.length; i += chunkSize) {
    const chunk = payments.slice(i, i + chunkSize);
    await prisma.payments.createMany({
      data: chunk,
      skipDuplicates: true,
    });
  }
  console.log('✅ Payments seeded');

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
