import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const usersToTest = [
  'admin',
  'doc1',
  'doc2',
  'doc3',
  'doc4',
  'doc5',
  'doc6',
  'doc7',
  'doc8',
  'recep1',
  'lab1',
  'pharm1',
  'finance1',
  'ipd1'
];

async function main() {
  console.log('Testing password verification for seeded users...');

  let successCount = 0;

  for (const username of usersToTest) {
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      console.error(`[-] User not found: ${username}`);
      continue;
    }

    const matches = await bcrypt.compare('password123', user.password);
    if (matches) {
      console.log(`[+] ${username} (${user.role}): Password verification succeeded.`);
      successCount++;
    } else {
      console.error(`[-] ${username} (${user.role}): Password verification failed!`);
    }
  }

  console.log(`\nVerification complete: ${successCount}/${usersToTest.length} users successfully verified.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
