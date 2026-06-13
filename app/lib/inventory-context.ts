import { requireRoleAndTenant } from '@/backend/tenant';
import { assertInventoryModuleEnabled } from '@/app/lib/inventory-roles';

/** Org-scoped inventory action context with module gate. */
export async function requireInventoryContext(allowedRoles: string[]) {
  const ctx = await requireRoleAndTenant(allowedRoles);
  await assertInventoryModuleEnabled(ctx.db, ctx.organizationId);
  return ctx;
}
