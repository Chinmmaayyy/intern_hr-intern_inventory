import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

const ORG = 'org-avani-default';

async function main() {
  const password = await bcrypt.hash('password123', 10);

  // Create nurse1
  const existing = await prisma.user.findFirst({ where: { username: 'nurse1', organizationId: ORG } });
  if (!existing) {
    const user = await prisma.user.create({
      data: {
        username: 'nurse1',
        name: 'Nurse One',
        password,
        role: 'nurse',
        organizationId: ORG,
        is_active: true,
      }
    });
    console.log('Created nurse1:', user.id);
  } else {
    console.log('nurse1 already exists:', existing.id);
  }

  // Verify all required users exist
  const users = await prisma.user.findMany({
    where: { organizationId: ORG },
    select: { username: true, role: true, is_active: true }
  });
  console.log('All users:', users.map(u => `${u.username}(${u.role})`).join(', '));
}

main().catch(console.error).finally(() => prisma.$disconnect());
