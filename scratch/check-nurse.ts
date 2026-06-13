import { prisma } from '../backend/db';

async function main() {
  const users = await prisma.user.findMany({
    where: { role: 'nurse' }
  });
  console.log('--- NURSE USERS ---');
  console.log(users);
}

main().catch(err => console.error(err));
