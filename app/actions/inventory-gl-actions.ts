'use server';
import { prisma } from '@/backend/db';
import { createJournalEntry } from '@/app/actions/gl-actions';

const INV_ACCOUNT_CODE = '1170';
const GRN_CLEARING_CODE = '3170';
const VENDOR_AP_CODE = '3110';
const EXPENSE_CODE = '7200';
const SHRINKAGE_CODE = '8000';
const PHARMACY_INV_CODE = '1160';

// CGSTSGSTIGST/TDS default account codes
const CGST_ACCOUNT_CODE = '3120';
const SGST_ACCOUNT_CODE = '3121';
const IGST_ACCOUNT_CODE = '3122';
const TDS_ACCOUNT_CODE = '3130';

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

/**
 * Resolves GL accounts dynamically at the item category level, falling back to defaults.
 */
async function resolveAccountsForItem(organizationId: string, itemId?: number | null, medicineId?: number | null) {
  let invAccountId = null;
  let expenseAccountId = null;
  let cogsAccountId = null;

  if (itemId) {
    const item = await prisma.itemMaster.findUnique({
      where: { id: itemId },
      include: { category: true }
    });
    if (item?.category) {
      invAccountId = item.category.gl_inventory_account_id;
      expenseAccountId = item.category.gl_expense_account_id;
      cogsAccountId = item.category.gl_cogs_account_id;
    }
  }

  // Fallbacks if null
  if (!invAccountId) {
    invAccountId = (await getGLAccount(organizationId, itemId ? INV_ACCOUNT_CODE : PHARMACY_INV_CODE))?.id;
  }
  if (!expenseAccountId) {
    expenseAccountId = (await getGLAccount(organizationId, EXPENSE_CODE))?.id;
  }
  if (!cogsAccountId) {
    cogsAccountId = (await getGLAccount(organizationId, SHRINKAGE_CODE))?.id;
  }

  return { invAccountId, expenseAccountId, cogsAccountId };
}

// ========================================
// Post GRN to GL
// Dr Inventory / Cr GRN Clearing
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
    const periodId = await getOpenPeriodId(orgId);

    // Group items by category to resolve correct accounts dynamically
    let totalDebitValue = 0;
    const journalLines = [];
    let lineNumber = 1;

    for (const line of grn.items) {
      const lineValue = round2(line.quantity_accepted * line.unit_price);
      if (lineValue <= 0) continue;

      const { invAccountId } = await resolveAccountsForItem(orgId, line.item_id, null);
      if (!invAccountId) return { success: false, error: `GL Inventory account not configured for item ${line.item_id}` };

      journalLines.push({
        line_number: lineNumber++,
        account_id: invAccountId,
        debit_amount: lineValue,
        credit_amount: 0,
        description: `Inventory - item ${line.item_id} - GRN ${grn.grn_number}`,
        organizationId: orgId
      });
      totalDebitValue += lineValue;
    }

    if (totalDebitValue <= 0) return { success: true, message: 'Zero-value GRN — no GL entry needed' };

    const clearingAccount = await getGLAccount(orgId, GRN_CLEARING_CODE) ?? await getGLAccount(orgId, VENDOR_AP_CODE);
    if (!clearingAccount) return { success: false, error: 'GL Clearing account (3170) not configured' };

    journalLines.push({
      line_number: lineNumber,
      account_id: clearingAccount.id,
      debit_amount: 0,
      credit_amount: round2(totalDebitValue),
      description: `GRN Clearing - GRN ${grn.grn_number}`,
      organizationId: orgId
    });

    const res = await createJournalEntry({
      organizationId: orgId,
      entry_date: new Date(),
      entry_type: 'GRN',
      narration: `GRN Receipt: ${grn.grn_number}`,
      reference_type: 'GRN',
      reference_id: grnId.toString(),
      period_id: periodId || undefined,
      lines: journalLines
    });

    if (!res.success) throw new Error(res.error);

    const journalId = (res as any).journal?.id;

    await prisma.inventoryMovement.updateMany({
      where: { source_type: 'GRN', source_id: grnId.toString(), organizationId: orgId, gl_journal_id: null },
      data: { gl_journal_id: journalId },
    });

    return { success: true, journalId };
  } catch (e: any) {
    console.error('postGrnToGL error:', e);
    return { success: false, error: e.message };
  }
}

// ========================================
// Post Purchase Invoice to GL
// Settle clearing, split CGST/SGST/IGST and TDS
// Dr GRN Clearing / Dr GST Tax input / Cr TDS / Cr AP
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
    const periodId = await getOpenPeriodId(orgId);

    const clearingAccount = await getGLAccount(orgId, GRN_CLEARING_CODE) ?? await getGLAccount(orgId, VENDOR_AP_CODE);
    const apAccount = await getGLAccount(orgId, VENDOR_AP_CODE);
    const cgstAccount = await getGLAccount(orgId, CGST_ACCOUNT_CODE);
    const sgstAccount = await getGLAccount(orgId, SGST_ACCOUNT_CODE);
    const igstAccount = await getGLAccount(orgId, IGST_ACCOUNT_CODE);
    const tdsAccount = await getGLAccount(orgId, TDS_ACCOUNT_CODE);

    if (!clearingAccount || !apAccount) return { success: false, error: 'Required GL AP/Clearing accounts not found' };

    const subtotal = round2(invoice.subtotal);
    const cgst = round2(invoice.cgst_amount || 0);
    const sgst = round2(invoice.sgst_amount || 0);
    const igst = round2(invoice.igst_amount || 0);
    const tds = round2(invoice.tds_amount || 0);
    const totalAmount = round2(invoice.total_amount);
    const apAmount = round2(totalAmount - tds);

    const lines = [];
    let lineNum = 1;

    // Dr GRN Clearing (subtotal amount)
    lines.push({
      account_id: clearingAccount.id,
      debit_amount: subtotal,
      credit_amount: 0,
      description: `GRN Clearing settle - Invoice ${invoice.invoice_number}`,
      organizationId: orgId
    });

    // Dr CGST / SGST / IGST Input Tax
    if (cgst > 0 && cgstAccount) {
      lines.push({
        account_id: cgstAccount.id,
        debit_amount: cgst,
        credit_amount: 0,
        description: `CGST Input Tax Credit - Invoice ${invoice.invoice_number}`,
        organizationId: orgId
      });
    }
    if (sgst > 0 && sgstAccount) {
      lines.push({
        account_id: sgstAccount.id,
        debit_amount: sgst,
        credit_amount: 0,
        description: `SGST Input Tax Credit - Invoice ${invoice.invoice_number}`,
        organizationId: orgId
      });
    }
    if (igst > 0 && igstAccount) {
      lines.push({
        account_id: igstAccount.id,
        debit_amount: igst,
        credit_amount: 0,
        description: `IGST Input Tax Credit - Invoice ${invoice.invoice_number}`,
        organizationId: orgId
      });
    }

    // Cr TDS Payable
    if (tds > 0 && tdsAccount) {
      lines.push({
        account_id: tdsAccount.id,
        debit_amount: 0,
        credit_amount: tds,
        description: `TDS Payable - Invoice ${invoice.invoice_number}`,
        organizationId: orgId
      });
    }

    // Cr Accounts Payable
    lines.push({
      account_id: apAccount.id,
      debit_amount: 0,
      credit_amount: apAmount,
      description: `Vendor AP - Invoice ${invoice.invoice_number}`,
      organizationId: orgId
    });

    const res = await createJournalEntry({
      organizationId: orgId,
      entry_date: new Date(),
      entry_type: 'PurchaseInvoice',
      narration: `Purchase Invoice: ${invoice.invoice_number}`,
      reference_type: 'PurchaseInvoice',
      reference_id: invoiceId.toString(),
      period_id: periodId || undefined,
      lines
    });

    if (!res.success) throw new Error(res.error);

    await prisma.pharmacyPurchaseInvoice.update({
      where: { id: invoiceId },
      data: { gl_posted: true }
    });

    return { success: true };
  } catch (e: any) {
    console.error('postPurchaseInvoiceToGL error:', e);
    return { success: false, error: e.message };
  }
}

// ========================================
// Post Consumption to GL
// Dr Expense/COGS / Cr Inventory (with cost center and dynamic accounts)
// ========================================
export async function postConsumptionToGL({
  organizationId, item_id, quantity, unit_cost, store_id, source_id, description, is_patient_chargeable
}: {
  organizationId: string; item_id: number; quantity: number; unit_cost: number;
  store_id: number; source_id: string; description?: string; is_patient_chargeable?: boolean;
}) {
  try {
    const existing = await prisma.gL_JournalEntry.findFirst({
      where: { reference_type: 'Consumption', reference_id: source_id, status: { not: 'Reversed' } },
    });
    if (existing) return { success: true, message: 'Already posted', journalId: existing.id };

    const { invAccountId, expenseAccountId, cogsAccountId } = await resolveAccountsForItem(organizationId, item_id, null);
    if (!invAccountId) return { success: false, error: 'GL Inventory account not configured' };

    // Chargeable goes to COGS account, otherwise goes to normal Expense account
    const debitAccount = is_patient_chargeable ? (cogsAccountId || expenseAccountId) : expenseAccountId;
    if (!debitAccount) return { success: false, error: 'GL Debit account not configured' };

    const store = await prisma.store.findUnique({
      where: { id: store_id },
      select: { name: true }
    });
    const costCenterName = store?.name || 'Department Store';

    const value = round2(quantity * unit_cost);
    if (value <= 0) return { success: true, message: 'Zero-value consumption' };

    const journalNumber = `JE-CONS-${source_id}-${Date.now()}`;
    const periodId = await getOpenPeriodId(organizationId);

    const res = await createJournalEntry({
      organizationId,
      entry_date: new Date(),
      entry_type: 'Consumption',
      narration: description ?? `Consumption: item ${item_id} in store ${store_id}`,
      reference_type: 'Consumption',
      reference_id: source_id,
      period_id: periodId || undefined,
      lines: [
        { account_id: debitAccount, debit_amount: value, credit_amount: 0, description: `Consumption Expense - item ${item_id}`, cost_center: costCenterName },
        { account_id: invAccountId, debit_amount: 0, credit_amount: value, description: `Inventory reduction - item ${item_id}`, cost_center: costCenterName }
      ]
    });

    if (!res.success) throw new Error(res.error);

    const journalId = (res as any).journal?.id;

    await prisma.inventoryMovement.updateMany({
      where: { source_type: 'CONSUMPTION', source_id: source_id, organizationId, gl_journal_id: null },
      data: { gl_journal_id: journalId },
    });

    return { success: true, journalId };
  } catch (e: any) {
    console.error('postConsumptionToGL error:', e);
    return { success: false, error: e.message };
  }
}

// ========================================
// Post Adjustment to GL
// Surplus: Dr Inventory / Cr Shrinkage
// Shortage: Dr Shrinkage / Cr Inventory
// ========================================
export async function postAdjustmentToGL({
  organizationId, item_id, quantity_delta, unit_cost, source_id, reason,
}: {
  organizationId: string; item_id: number; quantity_delta: number; unit_cost: number;
  store_id: number; source_id: string; reason?: string;
}) {
  try {
    const existing = await prisma.gL_JournalEntry.findFirst({
      where: { reference_type: 'Adjustment', reference_id: source_id, status: { not: 'Reversed' } }
    });
    if (existing) return { success: true, message: 'Already posted' };

    const { invAccountId, cogsAccountId } = await resolveAccountsForItem(organizationId, item_id, null);
    if (!invAccountId || !cogsAccountId) return { success: false, error: 'GL accounts not found for adjustment' };

    const value = round2(Math.abs(quantity_delta) * unit_cost);
    if (value <= 0) return { success: true, message: 'Zero-value adjustment' };

    const journalNumber = `JE-ADJ-${source_id}-${Date.now()}`;
    const periodId = await getOpenPeriodId(organizationId);
    const isPlus = quantity_delta > 0;

    const res = await createJournalEntry({
      organizationId,
      entry_date: new Date(),
      entry_type: 'Adjustment',
      narration: reason ?? `Stock Adjustment - item ${item_id}`,
      reference_type: 'Adjustment',
      reference_id: source_id,
      period_id: periodId || undefined,
      lines: isPlus
        ? [
            { account_id: invAccountId, debit_amount: value, credit_amount: 0, description: `Inventory surplus - item ${item_id}` },
            { account_id: cogsAccountId, debit_amount: 0, credit_amount: value, description: 'Surplus gain' }
          ]
        : [
            { account_id: cogsAccountId, debit_amount: value, credit_amount: 0, description: `Shrinkage/shortage loss - item ${item_id}` },
            { account_id: invAccountId, debit_amount: 0, credit_amount: value, description: 'Inventory reduction' }
          ]
    });

    if (!res.success) throw new Error(res.error);

    const journalId = (res as any).journal?.id;

    await prisma.inventoryMovement.updateMany({
      where: { source_type: 'ADJUSTMENT', source_id: source_id, organizationId, gl_journal_id: null },
      data: { gl_journal_id: journalId }
    });

    return { success: true, journalId };
  } catch (e: any) {
    console.error('postAdjustmentToGL error:', e);
    return { success: false, error: e.message };
  }
}

// ========================================
// Post Write-Off to GL
// Dr Shrinkage / Cr Inventory
// ========================================
export async function postWriteOffToGL({
  organizationId, item_id, quantity, unit_cost, source_id, reason,
}: {
  organizationId: string; item_id: number; quantity: number; unit_cost: number;
  source_id: string; reason?: string;
}) {
  try {
    const existing = await prisma.gL_JournalEntry.findFirst({
      where: { reference_type: 'WriteOff', reference_id: source_id, status: { not: 'Reversed' } }
    });
    if (existing) return { success: true, message: 'Already posted' };

    const { invAccountId, cogsAccountId } = await resolveAccountsForItem(organizationId, item_id, null);
    if (!invAccountId || !cogsAccountId) return { success: false, error: 'GL accounts not found for write-off' };

    const value = round2(quantity * unit_cost);
    if (value <= 0) return { success: true, message: 'Zero-value write-off — no GL entry needed' };

    const journalNumber = `JE-WO-${source_id}-${Date.now()}`;
    const periodId = await getOpenPeriodId(organizationId);

    const res = await createJournalEntry({
      organizationId,
      entry_date: new Date(),
      entry_type: 'WriteOff',
      narration: reason ?? `Inventory write-off - item ${item_id}`,
      reference_type: 'WriteOff',
      reference_id: source_id,
      period_id: periodId || undefined,
      lines: [
        { account_id: cogsAccountId, debit_amount: value, credit_amount: 0, description: `Inventory shrinkage loss - item ${item_id}` },
        { account_id: invAccountId, debit_amount: 0, credit_amount: value, description: 'Inventory reduction' }
      ]
    });

    if (!res.success) throw new Error(res.error);

    const journalId = (res as any).journal?.id;

    await prisma.inventoryMovement.updateMany({
      where: { source_type: 'WRITE_OFF', source_id: source_id, organizationId, gl_journal_id: null },
      data: { gl_journal_id: journalId }
    });

    return { success: true, journalId };
  } catch (e: any) {
    console.error('postWriteOffToGL error:', e);
    return { success: false, error: e.message };
  }
}

// ========================================
// Post Opening Stock to GL
// Dr Inventory / Cr Opening Balance Equity
// ========================================
export async function postOpeningStockToGL({
  organizationId, item_id, quantity, unit_cost, store_id, source_id
}: {
  organizationId: string; item_id: number; quantity: number; unit_cost: number;
  store_id: number; source_id: string;
}) {
  try {
    const existing = await prisma.gL_JournalEntry.findFirst({
      where: { reference_type: 'OpeningStock', reference_id: source_id, status: { not: 'Reversed' } }
    });
    if (existing) return { success: true, message: 'Already posted' };

    const { invAccountId } = await resolveAccountsForItem(organizationId, item_id, null);
    const equityAccount = await getGLAccount(organizationId, '3900') ?? await getGLAccount(organizationId, '3000');
    if (!invAccountId || !equityAccount) return { success: false, error: 'GL accounts not configured for opening stock (1170/3900)' };

    const value = round2(quantity * unit_cost);
    if (value <= 0) return { success: true, message: 'Zero-value opening stock' };

    const journalNumber = `JE-OP-${source_id}-${Date.now()}`;
    const periodId = await getOpenPeriodId(organizationId);

    const res = await createJournalEntry({
      organizationId,
      entry_date: new Date(),
      entry_type: 'OpeningStock',
      narration: `Opening Stock: item ${item_id} in store ${store_id}`,
      reference_type: 'OpeningStock',
      reference_id: source_id,
      period_id: periodId || undefined,
      lines: [
        { account_id: invAccountId, debit_amount: value, credit_amount: 0, description: `Opening Stock Inventory Dr - item ${item_id}` },
        { account_id: equityAccount.id, debit_amount: 0, credit_amount: value, description: `Opening Balance Equity Cr - item ${item_id}` }
      ]
    });

    if (!res.success) throw new Error(res.error);

    const journalId = (res as any).journal?.id;

    await prisma.inventoryMovement.updateMany({
      where: { source_type: 'OPENING', source_id: source_id, organizationId, gl_journal_id: null },
      data: { gl_journal_id: journalId }
    });

    return { success: true, journalId };
  } catch (e: any) {
    console.error('postOpeningStockToGL error:', e);
    return { success: false, error: e.message };
  }
}

// ========================================
// Post Vendor Return to GL
// Dr Vendor AP / Cr Inventory
// ========================================
export async function postVendorReturnToGL(returnId: number) {
  try {
    const ret = await prisma.pharmacyReturn.findUnique({
      where: { id: returnId }
    });
    if (!ret) return { success: false, error: 'Return not found' };

    const existing = await prisma.gL_JournalEntry.findFirst({
      where: { reference_type: 'VendorReturn', reference_id: returnId.toString(), status: { not: 'Reversed' } }
    });
    if (existing) return { success: true, message: 'Already posted' };

    const orgId = ret.organizationId;
    const periodId = await getOpenPeriodId(orgId);

    const { invAccountId } = await resolveAccountsForItem(orgId, ret.item_id, ret.medicine_id);
    const apAccount = await getGLAccount(orgId, VENDOR_AP_CODE);
    if (!invAccountId || !apAccount) return { success: false, error: 'GL accounts not found for vendor return (1170/3110)' };

    const value = round2(ret.quantity * (ret.unit_cost || 0));
    if (value <= 0) return { success: true, message: 'Zero-value return' };

    const res = await createJournalEntry({
      organizationId: orgId,
      entry_date: new Date(),
      entry_type: 'VendorReturn',
      narration: `Vendor Return: Return ID ${ret.id}`,
      reference_type: 'VendorReturn',
      reference_id: returnId.toString(),
      period_id: periodId || undefined,
      lines: [
        { account_id: apAccount.id, debit_amount: value, credit_amount: 0, description: `Vendor AP debit - Return ID ${ret.id}` },
        { account_id: invAccountId, debit_amount: 0, credit_amount: value, description: `Inventory reduction - Return ID ${ret.id}` }
      ]
    });

    if (!res.success) throw new Error(res.error);

    await prisma.pharmacyReturn.update({
      where: { id: returnId },
      data: { gl_posted: true }
    });

    return { success: true, journalId: (res as any).data?.id };
  } catch (e: any) {
    console.error('postVendorReturnToGL error:', e);
    return { success: false, error: e.message };
  }
}

// ========================================
// Reconcile sub-ledger to GL control accounts
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
  } catch (e: any) {
    console.error('reconcileInventoryToGL error:', e);
    return { success: false, error: e.message };
  }
}
