import { prisma } from 'd:/Intern-task/intern_hr-intern_inventory/backend/db';

async function main() {
  const users = await prisma.user.findMany({
    where: { role: 'nurse' }
  });
  console.log('--- NURSE USERS ---');
  console.log(users);
}

main().catch(err => console.error(err));
