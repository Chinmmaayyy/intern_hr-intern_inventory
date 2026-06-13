// Centralized role and access control utilities for the Inventory module.

export const INVENTORY_READ_ROLES = [
  'admin',
  'store_manager',
  'procurement_officer',
  'finance',
  'pharmacist',
  'lab_technician',
  'ipd_manager',
  'doctor',
  'receptionist',
  'nurse',
  'opd_manager'
];

export const INVENTORY_ADMIN_ROLES = ['admin'];
export const INVENTORY_CATEGORY_ROLES = ['admin', 'finance'];

export const ITEM_CREATE_ROLES = ['admin', 'store_manager'];
export const ITEM_APPROVE_ROLES = ['admin'];

export const GRN_WRITE_ROLES = ['admin', 'store_manager', 'pharmacist'];
export const GRN_READ_ROLES = ['admin', 'store_manager', 'procurement_officer', 'finance', 'pharmacist'];

export const PO_CREATE_ROLES = ['admin', 'procurement_officer', 'store_manager'];
export const PO_APPROVE_ROLES = ['admin', 'finance', 'store_manager'];

export const INDENT_CREATE_ROLES = [
  'admin',
  'pharmacist',
  'lab_technician',
  'ipd_manager',
  'doctor',
  'receptionist',
  'nurse',
  'opd_manager'
];
export const INDENT_APPROVE_ROLES = ['admin', 'store_manager'];
export const INDENT_ISSUE_ROLES = ['admin', 'store_manager', 'pharmacist'];
export const INDENT_READ_ROLES = [
  'admin',
  'finance',
  'store_manager',
  'pharmacist',
  'lab_technician',
  'ipd_manager',
  'doctor',
  'receptionist',
  'nurse',
  'opd_manager'
];

export const CONSUMPTION_ROLES = [
  'admin',
  'nurse',
  'lab_technician',
  'ipd_manager',
  'opd_manager',
  'doctor',
  'receptionist',
  'pharmacist'
];

export const COUNT_APPROVE_ROLES = ['admin', 'finance', 'store_manager'];
export const ADJUSTMENT_WRITE_ROLES = ['admin', 'finance', 'store_manager'];
export const WRITE_OFF_APPROVE_ROLES = ['admin', 'finance'];

export const REPORTS_ROLES = ['admin', 'finance', 'store_manager', 'procurement_officer'];

/**
 * Asserts that the current user has access to operate on a specific store.
 * - Admin always has access.
 * - Store Manager has access only if they are the designated incharge_user_id.
 * - Others have access as long as the store exists.
 */
export async function assertStoreAccess(
  db: any,
  storeId: number,
  session: { id: string; role: string },
  organizationId: string
): Promise<void> {
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: { incharge_user_id: true, name: true, organizationId: true, is_active: true }
  });

  if (!store || store.organizationId !== organizationId) {
    throw new Error('Store not found or unauthorized organization context');
  }

  if (!store.is_active) {
    throw new Error(`Store '${store.name}' is inactive`);
  }

  if (session.role === 'admin') {
    return;
  }

  if (session.role === 'store_manager') {
    if (store.incharge_user_id !== session.id) {
      throw new Error(`Access Denied: You are not the incharge for store '${store.name}'`);
    }
  }
}

/**
 * Asserts that the inventory module is enabled for the organization.
 */
export async function assertInventoryModuleEnabled(db: any, organizationId: string): Promise<void> {
  const config = await db.moduleConfig.findFirst({
    where: { organizationId, module_key: 'inventory' }
  });

  if (!config || !config.enabled) {
    throw new Error('Inventory module is not enabled for this organization');
  }
}
