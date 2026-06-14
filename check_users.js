const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      organizationId: true
    }
  });
  const stores = await prisma.store.findMany({ select: { id: true, name: true, store_type: true } });
  console.log('STORES:', JSON.stringify(stores, null, 2));

  const admissions = await prisma.admissions.findMany({ take: 3, select: { admission_id: true, patient_id: true, patient: { select: { full_name: true } } } });
  console.log('ADMISSIONS:', JSON.stringify(admissions, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
