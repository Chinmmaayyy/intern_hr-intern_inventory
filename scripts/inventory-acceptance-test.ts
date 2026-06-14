/**
 * Triggers the dev-only acceptance test API (Steps 1–8).
 * Requires the Next.js dev server running on port 3000.
 *
 * Usage: npx tsx scripts/inventory-acceptance-test.ts
 */
async function main() {
  const base = process.env.APP_URL || 'http://localhost:3000';
  const res = await fetch(`${base}/api/dev/inventory-acceptance`, { method: 'POST' });
  const body = await res.json();
  console.log(JSON.stringify(body, null, 2));
  if (!body.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
