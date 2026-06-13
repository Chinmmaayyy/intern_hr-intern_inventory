import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== USERS ===');
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, name: true }
  });
  console.log(users);

  console.log('=== EMPLOYEES ===');
  const employees = await prisma.employee.findMany({
    select: { id: true, user_id: true, employee_code: true, name: true, designation: true }
  });
  console.log(employees);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
