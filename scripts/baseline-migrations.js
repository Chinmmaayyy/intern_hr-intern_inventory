/**
 * Baseline an existing non-empty database for Prisma Migrate.
 * Marks all local migrations as applied without running SQL.
 * Use once when P3005 occurs on a DB that already has the schema.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
const migrations = fs
  .readdirSync(migrationsDir)
  .filter((name) => fs.statSync(path.join(migrationsDir, name)).isDirectory())
  .sort();

console.log(`Baselining ${migrations.length} migrations...`);

for (const migration of migrations) {
  try {
    execSync(`npx prisma migrate resolve --applied ${migration}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log(`✓ ${migration}`);
  } catch (err) {
    console.warn(`⚠ ${migration} (may already be applied)`);
  }
}

console.log('Baseline complete. Run: npm run db:migrate:prod');
