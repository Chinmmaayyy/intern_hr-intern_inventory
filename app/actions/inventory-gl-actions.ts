'use server';
import { prisma } from '@/backend/db';

const INV_ACCOUNT_CODE = '1170';
const GRN_CLEARING_CODE = '3170';
const VENDOR_AP_CODE = '3110';
const EXPENSE_CODE = '7200';
const SHRINKAGE_CODE = '8000';
const PHARMACY_INV_CODE = '1160';

function round2(n: number) { return Math.round(n * 100) / 100; }

async function getGLAccount(organizationId: string, code: string) {
  return prisma.gL_Account.findFirst({
    where: { organizationId, account_code: code, is_active: true },
  });
}

async function getOpenPeriodId(organizationId: string): Promise<number | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      financial_periods: {
        where: { status: 'Open' },
        orderBy: { start_date: 'desc' },
        take: 1,
        select: { id: true },
      },
    },
  });
  return (org?.financial_periods as Array<{ id: number }>)?.[0]?.id ?? null;
}

// ========================================
// Post GRN to GL
// Dr Inventory 1170 / Cr GRN Clearing 3170
// ========================================
export async function postGrnToGL(grnId: number) {
  try {
    const grn = await prisma.goodsReceiptNote.findUnique({
      where: { id: grnId },
      include: { items: true },
    });
    if (!grn) return { success: false, error: 'GRN not found' };

    const existing = await prisma.gL_JournalEntry.findFirst({
      where: { reference_type: 'GRN', reference_id: grnId.toString(), status: { not: 'Reversed' } },
    });
    if (existing) return { success: true, message: 'Already posted' };

    const orgId = grn.organizationId;
    const invAccount = await getGLAccount(orgId, INV_ACCOUNT_CODE) ?? await getGLAccount(orgId, PHARMACY_INV_CODE);
    const clearingAccount = await getGLAccount(orgId, GRN_CLEARING_CODE) ?? await getGLAccount(orgId, VENDOR_AP_CODE);
    if (!invAccount || !clearingAccount) return { success: false, error: 'GL accounts not found (1170/3170)' };

    const totalValue = (grn.items as Array<{ quantity_accepted: number; unit_price: number }>)
      .reduce((s, i) => s + i.quantity_accepted * i.unit_price, 0);
    if (totalValue <= 0) return { success: true, message: 'Zero-value GRN — no GL entry needed' };

    const journalNumber = `JE-GRN-${grnId}-${Date.now()}`;
    const periodId = await getOpenPeriodId(orgId);

    await prisma.gL_JournalEntry.create({
      data: {
        journal_number: journalNumber,
        organizationId: orgId,
        entry_type: 'GRN',
        entry_date: new Date(),
        period_id: periodId,
        narration: `GRN Receipt: ${grn.grn_number}`,
        reference_type: 'GRN',
        reference_id: grnId.toString(),
        status: 'Posted',
        total_debit: round2(totalValue),
        total_credit: round2(totalValue),
        lines: {
          create: [
            { line_number: 1, account_id: invAccount.id, debit_amount: round2(totalValue), credit_amount: 0, description: `Inventory - ${grn.grn_number}`, organizationId: orgId },
            { line_number: 2, account_id: clearingAccount.id, debit_amount: 0, credit_amount: round2(totalValue), description: `GRN Clearing - ${grn.grn_number}`, organizationId: orgId },
          ],
        },
      },
    });
    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
    console.error('postGrnToGL error:', err);
    return { success: false, error: err.message };
  }
}

// ========================================
// Post Purchase Invoice to GL
// Dr GRN Clearing 3170 / Cr Vendor AP 3110
// ========================================
export async function postPurchaseInvoiceToGL(invoiceId: number) {
  try {
    const invoice = await prisma.pharmacyPurchaseInvoice.findUnique({
      where: { id: invoiceId },
      include: { line_items: true },
    });
    if (!invoice) return { success: false, error: 'Invoice not found' };

    const existing = await prisma.gL_JournalEntry.findFirst({
      where: { reference_type: 'PurchaseInvoice', reference_id: invoiceId.toString(), status: { not: 'Reversed' } },
    });
    if (existing) return { success: true, message: 'Already posted' };

    const orgId = invoice.organizationId;
    const clearingAccount = await getGLAccount(orgId, GRN_CLEARING_CODE) ?? await getGLAccount(orgId, VENDOR_AP_CODE);
    const apAccount = await getGLAccount(orgId, VENDOR_AP_CODE);
    if (!clearingAccount || !apAccount) return { success: false, error: 'Required GL accounts not found' };

    const totalValue = round2(Number(invoice.total_amount));
    const journalNumber = `JE-PINV-${invoiceId}-${Date.now()}`;
    const periodId = await getOpenPeriodId(orgId);

    await prisma.gL_JournalEntry.create({
      data: {
        journal_number: journalNumber,
        organizationId: orgId,
        entry_type: 'PurchaseInvoice',
        entry_date: new Date(),
        period_id: periodId,
        narration: `Purchase Invoice: ${invoice.invoice_number}`,
        reference_type: 'PurchaseInvoice',
        reference_id: invoiceId.toString(),
        status: 'Posted',
        total_debit: totalValue,
        total_credit: totalValue,
        lines: {
          create: [
            { line_number: 1, account_id: clearingAccount.id, debit_amount: totalValue, credit_amount: 0, description: `GRN Clearing settle - ${invoice.invoice_number}`, organizationId: orgId },
            { line_number: 2, account_id: apAccount.id, debit_amount: 0, credit_amount: totalValue, description: `AP - ${invoice.invoice_number}`, organizationId: orgId },
          ],
        },
      },
    });
    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
    console.error('postPurchaseInvoiceToGL error:', err);
    return { success: false, error: err.message };
  }
}

// ========================================
// Post Consumption to GL
// Dr Expense 7200 / Cr Inventory 1170
// ========================================
export async function postConsumptionToGL({
  organizationId, item_id, quantity, unit_cost, store_id, source_id, description,
}: {
  organizationId: string; item_id: number; quantity: number; unit_cost: number;
  store_id: number; source_id: string; description?: string;
}) {
  try {
    const existing = await prisma.gL_JournalEntry.findFirst({
      where: { reference_type: 'Consumption', reference_id: source_id, status: { not: 'Reversed' } },
    });
    if (existing) return { success: true, message: 'Already posted' };

    const expenseAccount = await getGLAccount(organizationId, EXPENSE_CODE) ?? await getGLAccount(organizationId, SHRINKAGE_CODE);
    const invAccount = await getGLAccount(organizationId, INV_ACCOUNT_CODE) ?? await getGLAccount(organizationId, PHARMACY_INV_CODE);
    if (!expenseAccount || !invAccount) return { success: false, error: 'GL accounts not found for consumption' };

    const value = round2(quantity * unit_cost);
    const journalNumber = `JE-CONS-${source_id}-${Date.now()}`;
    const periodId = await getOpenPeriodId(organizationId);

    const entry = await prisma.gL_JournalEntry.create({
      data: {
        journal_number: journalNumber,
        organizationId,
        entry_type: 'Consumption',
        entry_date: new Date(),
        period_id: periodId,
        narration: description ?? `Consumption: item ${item_id}`,
        reference_type: 'Consumption',
        reference_id: source_id,
        status: 'Posted',
        total_debit: value,
        total_credit: value,
        lines: {
          create: [
            { line_number: 1, account_id: expenseAccount.id, debit_amount: value, credit_amount: 0, description: `Dept Expense - item ${item_id}`, organizationId },
            { line_number: 2, account_id: invAccount.id, debit_amount: 0, credit_amount: value, description: `Inventory reduction - item ${item_id}`, organizationId },
          ],
        },
      },
    });
    return { success: true, journalId: entry.id };
  } catch (e: unknown) {
    const err = e as Error;
    console.error('postConsumptionToGL error:', err);
    return { success: false, error: err.message };
  }
}

// ========================================
// Post Adjustment to GL
// Surplus: Dr Inventory 1170 / Cr Shrinkage 8000
// Shortage: Dr Shrinkage 8000 / Cr Inventory 1170
// ========================================
export async function postAdjustmentToGL({
  organizationId, item_id, quantity_delta, unit_cost, source_id, reason,
}: {
  organizationId: string; item_id: number; quantity_delta: number; unit_cost: number;
  store_id: number; source_id: string; reason?: string;
}) {
  try {
    const invAccount = await getGLAccount(organizationId, INV_ACCOUNT_CODE) ?? await getGLAccount(organizationId, PHARMACY_INV_CODE);
    const counterAccount = await getGLAccount(organizationId, SHRINKAGE_CODE);
    if (!invAccount || !counterAccount) return { success: false, error: 'GL accounts not found for adjustment' };

    const value = round2(Math.abs(quantity_delta) * unit_cost);
    const journalNumber = `JE-ADJ-${source_id}-${Date.now()}`;
    const periodId = await getOpenPeriodId(organizationId);
    const isPlus = quantity_delta > 0;

    await prisma.gL_JournalEntry.create({
      data: {
        journal_number: journalNumber,
        organizationId,
        entry_type: 'Adjustment',
        entry_date: new Date(),
        period_id: periodId,
        narration: reason ?? `Stock Adjustment - item ${item_id}`,
        reference_type: 'Adjustment',
        reference_id: source_id,
        status: 'Posted',
        total_debit: value,
        total_credit: value,
        lines: {
          create: isPlus
            ? [
                { line_number: 1, account_id: invAccount.id, debit_amount: value, credit_amount: 0, description: 'Inventory surplus', organizationId },
                { line_number: 2, account_id: counterAccount.id, debit_amount: 0, credit_amount: value, description: 'Surplus gain', organizationId },
              ]
            : [
                { line_number: 1, account_id: counterAccount.id, debit_amount: value, credit_amount: 0, description: 'Shrinkage/shortage loss', organizationId },
                { line_number: 2, account_id: invAccount.id, debit_amount: 0, credit_amount: value, description: 'Inventory shrinkage', organizationId },
              ],
        },
      },
    });
    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
    console.error('postAdjustmentToGL error:', err);
    return { success: false, error: err.message };
  }
}

// ========================================
// Post Write-Off to GL (expiry / damage)
// Dr Shrinkage 8000 / Cr Inventory 1170
// ========================================
export async function postWriteOffToGL({
  organizationId, item_id, quantity, unit_cost, source_id, reason,
}: {
  organizationId: string; item_id: number; quantity: number; unit_cost: number;
  source_id: string; reason?: string;
}) {
  try {
    const invAccount = await getGLAccount(organizationId, INV_ACCOUNT_CODE) ?? await getGLAccount(organizationId, PHARMACY_INV_CODE);
    const shrinkageAccount = await getGLAccount(organizationId, SHRINKAGE_CODE);
    if (!invAccount || !shrinkageAccount) return { success: false, error: 'GL accounts not found for write-off' };

    const value = round2(quantity * unit_cost);
    if (value <= 0) return { success: true, message: 'Zero-value write-off — no GL entry needed' };

    const journalNumber = `JE-WO-${source_id}-${Date.now()}`;
    const periodId = await getOpenPeriodId(organizationId);

    const entry = await prisma.gL_JournalEntry.create({
      data: {
        journal_number: journalNumber,
        organizationId,
        entry_type: 'WriteOff',
        entry_date: new Date(),
        period_id: periodId,
        narration: reason ?? `Inventory write-off - item ${item_id}`,
        reference_type: 'WriteOff',
        reference_id: source_id,
        status: 'Posted',
        total_debit: value,
        total_credit: value,
        lines: {
          create: [
            { line_number: 1, account_id: shrinkageAccount.id, debit_amount: value, credit_amount: 0, description: 'Inventory shrinkage/expiry loss', organizationId },
            { line_number: 2, account_id: invAccount.id, debit_amount: 0, credit_amount: value, description: 'Inventory reduction', organizationId },
          ],
        },
      },
    });
    return { success: true, journalId: entry.id };
  } catch (e: unknown) {
    const err = e as Error;
    console.error('postWriteOffToGL error:', err);
    return { success: false, error: err.message };
  }
}

// ========================================
// Reconcile inventory sub-ledger to GL control accounts
// ========================================
export async function reconcileInventoryToGL(organizationId: string) {
  try {
    const stocks = await prisma.storeStock.findMany({
      where: { organizationId },
      include: { item: { include: { category: true } } },
    });

    let ledgerValue = 0;
    for (const s of stocks) {
      ledgerValue += s.quantity_on_hand * (s.avg_unit_cost || s.item.std_purchase_price || 0);
    }
    ledgerValue = round2(ledgerValue);

    const invAccounts = await prisma.gL_Account.findMany({
      where: {
        organizationId,
        is_active: true,
        OR: [
          { account_code: { in: [INV_ACCOUNT_CODE, PHARMACY_INV_CODE] } },
          { account_name: { contains: 'Inventory', mode: 'insensitive' } },
        ],
      },
    });

    let glBalance = 0;
    for (const acct of invAccounts) {
      const lines = await prisma.gL_JournalLine.findMany({
        where: { account_id: acct.id, organizationId, journal: { status: { not: 'Reversed' } } },
        select: { debit_amount: true, credit_amount: true },
      });
      for (const l of lines) {
        glBalance += Number(l.debit_amount || 0) - Number(l.credit_amount || 0);
      }
    }
    glBalance = round2(glBalance);

    const unposted = await prisma.inventoryMovement.count({
      where: { organizationId, gl_journal_id: null, movement_type: { not: 'OPENING' } },
    });

    return {
      success: true,
      data: {
        ledger_value: ledgerValue,
        gl_balance: glBalance,
        variance: round2(ledgerValue - glBalance),
        unposted_movements: unposted,
        reconciled: Math.abs(ledgerValue - glBalance) < 0.01 && unposted === 0,
      },
    };
  } catch (e: unknown) {
    const err = e as Error;
    console.error('reconcileInventoryToGL error:', err);
    return { success: false, error: err.message };
  }
}
