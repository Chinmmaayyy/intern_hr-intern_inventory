'use client';

/**
 * DailyRevenueShell
 * -----------------
 * Bridge component that wraps MISFilterEngine + RevenueTable inside a single
 * client boundary. The parent page.tsx remains a Server Component and passes
 * the raw Server Action payload down as a prop.
 *
 * Filtering strategy — MOCK phase vs PRODUCTION phase:
 *
 *   MOCK (current):  Rows are filtered client-side from the full payload.
 *                    Totals are derived from filtered rows so the tfoot stays
 *                    accurate during visual testing.
 *
 *   PRODUCTION:      The page re-fetches via Server Action when URL params
 *                    change, receiving a pre-filtered payload with server-
 *                    computed totals. Client-side filtering becomes a no-op
 *                    (all rows pass) and totals come straight from payload.totals.
 *
 * The <RevenueTable> contract is identical in both phases.
 */

import React, { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { MISFilterEngine } from '@/components/mis/MISFilterEngine';
import { RevenueTable, type RevenuePayload, type RevenueRow } from '@/components/mis/RevenueTable';
import { BarChart3, TrendingDown } from 'lucide-react';

interface DailyRevenueShellProps {
    /** Full payload from generateReport('billing-revenue-daily', filters). */
    payload: RevenuePayload;
}

export function DailyRevenueShell({ payload }: DailyRevenueShellProps) {
    const searchParams = useSearchParams();

    const startDate = searchParams.get('startDate') ?? '';
    const endDate   = searchParams.get('endDate')   ?? '';
    const doctor    = searchParams.get('doctor')    ?? '';

    const allRows = payload.rows ?? [];

    // ── Derive unique doctor list for the filter dropdown ──────────────────
    const doctorOptions = useMemo(
        () => Array.from(new Set(allRows.map((r) => r.doctor_name))).sort(),
        [allRows]
    );

    // ── Client-side filter (mock phase only — see jsdoc above) ────────────
    const filteredRows = useMemo<RevenueRow[]>(
        () =>
            allRows.filter((row) => {
                if (startDate && row.date < startDate)           return false;
                if (endDate   && row.date > endDate)             return false;
                if (doctor    && row.doctor_name !== doctor)     return false;
                return true;
            }),
        [allRows, startDate, endDate, doctor]
    );

    // ── Derive totals from filtered rows (mock phase) ─────────────────────
    // In production the payload already carries server-computed totals that
    // reflect the applied filters; this derivation becomes redundant.
    const derivedTotals = useMemo(() => ({
        billed_amount:    filteredRows.reduce((s, r) => s + r.billed_amount,    0),
        collected_amount: filteredRows.reduce((s, r) => s + r.collected_amount, 0),
        invoice_count:    filteredRows.reduce((s, r) => s + r.invoice_count,    0),
    }), [filteredRows]);

    // ── Build the payload slice that RevenueTable actually renders ─────────
    const filteredPayload: RevenuePayload = {
        ...payload,
        rows:   filteredRows,
        totals: derivedTotals,
    };

    // ── KPI aggregates ────────────────────────────────────────────────────
    const { billed_amount: totalBilled, collected_amount: totalCollected, invoice_count: totalInvoices } = derivedTotals;

    const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

    const topRow = filteredRows.reduce<RevenueRow | null>(
        (top, r) => (!top || r.collected_amount > top.collected_amount ? r : top),
        null
    );

    const formatINR = (n: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

    return (
        <div className="space-y-5 animate-in">
            {/* ── Filter Engine ─────────────────────────────────────────────── */}
            <MISFilterEngine doctorOptions={doctorOptions} />

            {/* ── KPI Summary Strip ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    label="Total Billed"
                    value={formatINR(totalBilled)}
                    sub={`${totalInvoices} invoice${totalInvoices !== 1 ? 's' : ''}`}
                    accent="indigo"
                />
                <KPICard
                    label="Total Collected"
                    value={formatINR(totalCollected)}
                    sub="realised cash"
                    accent="emerald"
                />
                <KPICard
                    label="Collection Rate"
                    value={`${collectionRate.toFixed(1)}%`}
                    sub={collectionRate >= 90 ? '✓ Target met' : `${formatINR(totalBilled - totalCollected)} outstanding`}
                    accent={collectionRate >= 90 ? 'emerald' : 'amber'}
                />
                <KPICard
                    label="Top Collector"
                    value={topRow?.doctor_name ?? '—'}
                    sub={topRow ? `${topRow.department} · ${formatINR(topRow.collected_amount)}` : 'No data'}
                    accent="teal"
                />
            </div>

            {/* ── Data Table ────────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-2.5">
                        <BarChart3 className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-bold text-stone-900">Revenue Transactions</span>
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                        {filteredRows.length} row{filteredRows.length !== 1 ? 's' : ''}
                    </span>
                </div>

                <RevenueTable payload={filteredPayload} />
            </div>
        </div>
    );
}

// ─── Internal KPI card ────────────────────────────────────────────────────────
type Accent = 'emerald' | 'indigo' | 'amber' | 'teal';

const ACCENT_MAP: Record<Accent, { border: string; bg: string; dot: string; text: string }> = {
    emerald: { border: 'border-emerald-200', bg: 'bg-emerald-50',  dot: 'bg-emerald-500', text: 'text-emerald-700' },
    indigo:  { border: 'border-indigo-200',  bg: 'bg-indigo-50',   dot: 'bg-indigo-500',  text: 'text-indigo-700'  },
    amber:   { border: 'border-amber-200',   bg: 'bg-amber-50',    dot: 'bg-amber-500',   text: 'text-amber-700'   },
    teal:    { border: 'border-teal-200',    bg: 'bg-teal-50',     dot: 'bg-teal-500',    text: 'text-teal-700'    },
};

function KPICard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: Accent }) {
    const styles = ACCENT_MAP[accent];
    return (
        <div className={`rounded-2xl border ${styles.border} ${styles.bg} px-5 py-4 space-y-1`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                {label}
            </p>
            <p className={`text-xl font-black ${styles.text} leading-tight truncate`}>{value}</p>
            <p className="text-[11px] text-gray-400 font-medium">{sub}</p>
        </div>
    );
}
