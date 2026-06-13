'use client';

/**
 * UniversalReportShell
 * --------------------
 * Generic Client Component that renders ANY MIS report whose definition lives
 * in the registry. It is driven entirely by the `ColumnSpec[]` array produced
 * by `reportDef.columns` — no knowledge of individual column semantics is
 * hard-coded here.
 *
 * ## Rendering pipeline
 *   columns: ColumnSpec[]  (from registry, passed by Server Component page)
 *       ↓
 *   <thead>  — maps each ColumnSpec to a <th>, aligns by col.align / col.type
 *   <tbody>  — for each row, renders formatCell(row[col.key], col.type)
 *   <tfoot>  — shown when ≥1 ColumnSpec has total:'sum'; reads from payload.totals
 *
 * ## Cell formatters (renderCell)
 *   currency → ₹ INR with 2dp, tabular-nums, stone-900 bold
 *   number   → en-IN locale, tabular-nums, stone-900 bold
 *   percent  → toFixed(1)%, tabular-nums
 *   date     → safe local-timezone parse → "12 Jun 2026" (en-IN)
 *   string   → rendered as-is, stone-700
 *
 * ## Filter strategy
 *   - Date range is managed via URL params by <MISFilterEngine showDoctorFilter={false}>.
 *   - The doctor dropdown is suppressed — it is billing-specific and not a
 *     registry-level Zod filter key for generic reports.
 *   - ExportExcelButton re-maps URL param keys (startDate/endDate) to the Zod
 *     filter keys (date_start/date_end) before passing to the Server Action.
 *
 * ## Async / Empty states
 *   - payload.async === true  → renders <AsyncQueuedBanner>
 *   - rows.length === 0       → renders <EmptyState>
 */

import React, { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { MISFilterEngine } from '@/components/mis/MISFilterEngine';
import { ExportExcelButton } from '@/components/mis/ExportExcelButton';
import { BarChart3, Inbox, Clock4 } from 'lucide-react';

// `import type` is critical here: ColumnSpec lives in a file that also imports
// `z` from zod. Using `import type` guarantees zero runtime Zod bundling.
import type { ColumnSpec } from '@/lib/mis/types';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Safe, serialisable payload — no ZodSchema, no functions. */
export interface UniversalPayload {
    async:   boolean;
    jobId?:  string;
    rows?:   Record<string, unknown>[];
    totals?: Record<string, number>;
}

export interface UniversalReportShellProps {
    /** Registry key — forwarded to ExportExcelButton. */
    reportId:   string;
    /** Human-readable report name — shown in the table card header. */
    reportName: string;
    /** Column definitions from reportDef.columns — drives all table rendering. */
    columns:    ColumnSpec[];
    /** Response from generateReport() — rows, totals, and async state. */
    payload:    UniversalPayload;
}

// ─── Cell formatters ──────────────────────────────────────────────────────────

const INR = new Intl.NumberFormat('en-IN', {
    style:                 'currency',
    currency:              'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/**
 * Formats a raw row value according to the column's declared type.
 *
 * Returns '—' for null / undefined / empty string so the table never
 * shows raw "undefined" or blank cells.
 *
 * Date handling mirrors the existing `formatDate` in RevenueTable.tsx:
 *  - ISO strings "YYYY-MM-DD" are parsed via the local-timezone constructor
 *    `new Date(y, m-1, d)` to prevent UTC-midnight off-by-one-day display
 *    bugs on IST (+05:30) servers.
 *  - JS Date objects (returned by Prisma from DATE() columns) are used as-is.
 */
function formatCell(value: unknown, type: ColumnSpec['type']): string {
    if (value === null || value === undefined || value === '') return '—';

    switch (type) {
        case 'currency':
            return INR.format(Number(value));

        case 'number':
            return Number(value).toLocaleString('en-IN');

        case 'percent':
            return `${Number(value).toFixed(1)}%`;

        case 'date': {
            const d: Date =
                value instanceof Date
                    ? value
                    : (() => {
                          const s = String(value);
                          // Safe local-timezone parse for YYYY-MM-DD strings
                          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                              const [y, m, day] = s.split('-').map(Number);
                              return new Date(y, m - 1, day);
                          }
                          // Fallback for datetime strings (e.g. ISO-8601 from Prisma)
                          return new Date(s);
                      })();
            return d.toLocaleDateString('en-IN', {
                day:   '2-digit',
                month: 'short',
                year:  'numeric',
            });
        }

        default: // 'string'
            return String(value);
    }
}

// ─── Alignment helpers ────────────────────────────────────────────────────────

/**
 * Resolves the effective text alignment for a column.
 * Numeric types default to right-aligned; text/date default to left.
 * An explicit `col.align` value always wins.
 */
function effectiveAlign(col: ColumnSpec): 'left' | 'center' | 'right' {
    if (col.align) return col.align;
    return col.type === 'currency' || col.type === 'number' || col.type === 'percent'
        ? 'right'
        : 'left';
}

const ALIGN_CLASS: Record<'left' | 'center' | 'right', string> = {
    left:   'text-left',
    center: 'text-center',
    right:  'text-right',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function UniversalReportShell({
    reportId,
    reportName,
    columns,
    payload,
}: UniversalReportShellProps) {
    const searchParams = useSearchParams();

    // Read URL params — written by MISFilterEngine via router.push()
    const startDate = searchParams.get('startDate') ?? '';
    const endDate   = searchParams.get('endDate')   ?? '';

    // ── 1. Async/queued state ────────────────────────────────────────────────
    if (payload.async) {
        return <AsyncQueuedBanner jobId={payload.jobId} />;
    }

    const rows   = payload.rows   ?? [];
    const totals = payload.totals ?? {};

    // ── 2. Compute tfoot visibility ──────────────────────────────────────────
    // Show the totals row only if at least one column declares total:'sum' or
    // total:'avg' AND the server actually sent back a totals object.
    const hasSumColumns = columns.some((c) => c.total);
    const showTotalsRow = hasSumColumns && Object.keys(totals).length > 0;

    // ── 3. Compute leading non-total span for the Grand Total label ──────────
    // We find how many consecutive leading columns have no total definition.
    // Those columns are merged into a single colSpan cell that carries the
    // "Grand Total (N rows)" label, matching the pattern in RevenueTable.tsx.
    //
    // Edge case: if the very first column has a total (unusual but possible),
    // we use colSpan=1 and show the label in that first cell.
    const leadingNonTotalCount = useMemo(() => {
        let count = 0;
        for (const col of columns) {
            if (col.total) break;
            count++;
        }
        return Math.max(count, 1); // Always at least 1
    }, [columns]);

    // ── 4. Export filters — re-map URL keys to Zod filter keys ──────────────
    // MISFilterEngine writes startDate/endDate to the URL.
    // exportReportToExcel → runner → reportDef.filters.safeParse expects
    // date_start/date_end (the Zod schema keys). We remap here.
    const exportFilters = {
        date_start: startDate || undefined,
        date_end:   endDate   || undefined,
    };

    // ── 5. Empty state ───────────────────────────────────────────────────────
    if (rows.length === 0) {
        return (
            <div className="space-y-5">
                <MISFilterEngine doctorOptions={[]} showDoctorFilter={false} />
                <EmptyState />
            </div>
        );
    }

    return (
        <div className="space-y-5">

            {/* ── Filter Engine (date-only; doctor select suppressed) ────────── */}
            <MISFilterEngine doctorOptions={[]} showDoctorFilter={false} />

            {/* ── Data Table Card ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

                {/* Card header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-2.5">
                        <BarChart3 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                        <span className="text-sm font-bold text-stone-900 truncate">
                            {reportName}
                        </span>
                    </div>

                    {/* Right controls: row count pill + export button */}
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                            {rows.length} {rows.length === 1 ? 'row' : 'rows'}
                        </span>
                        <ExportExcelButton
                            reportId={reportId}
                            filters={exportFilters}
                        />
                    </div>
                </div>

                {/* Scrollable table container */}
                <div className="overflow-x-auto" role="region" aria-label={`${reportName} data table`}>
                    <table className="w-full text-sm border-collapse" style={{ minWidth: `${Math.max(columns.length * 140, 700)}px` }}>

                        {/* ── thead ──────────────────────────────────────────── */}
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        scope="col"
                                        className={`
                                            px-5 py-3
                                            text-[10px] font-bold uppercase tracking-widest
                                            text-gray-500 whitespace-nowrap select-none
                                            ${ALIGN_CLASS[effectiveAlign(col)]}
                                        `}
                                    >
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        {/* ── tbody ──────────────────────────────────────────── */}
                        <tbody>
                            {rows.map((row, rowIdx) => {
                                const isEven = rowIdx % 2 === 0;
                                return (
                                    <tr
                                        key={rowIdx}
                                        className={`
                                            border-b border-gray-50
                                            transition-colors duration-100
                                            hover:bg-emerald-50/40
                                            ${isEven ? 'bg-white' : 'bg-gray-50/30'}
                                        `}
                                    >
                                        {columns.map((col) => {
                                            const value    = row[col.key];
                                            const align    = effectiveAlign(col);
                                            const isNumeric =
                                                col.type === 'currency' ||
                                                col.type === 'number'   ||
                                                col.type === 'percent';

                                            return (
                                                <td
                                                    key={col.key}
                                                    className={`px-5 py-3.5 whitespace-nowrap ${ALIGN_CLASS[align]}`}
                                                >
                                                    <DataCell
                                                        value={value}
                                                        type={col.type}
                                                        isNumeric={isNumeric}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>

                        {/* ── tfoot — server-authoritative totals ────────────── */}
                        {showTotalsRow && (
                            <tfoot>
                                <tr className="bg-gray-50 border-t-2 border-gray-200">

                                    {/* Leading non-total columns: merged colSpan with label */}
                                    <td
                                        colSpan={leadingNonTotalCount}
                                        className="px-5 py-4"
                                    >
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                            Grand Total
                                            <span className="ml-2 text-gray-400 font-medium normal-case tracking-normal">
                                                ({rows.length} {rows.length === 1 ? 'row' : 'rows'})
                                            </span>
                                        </span>
                                    </td>

                                    {/* One <td> per remaining (totalled) column */}
                                    {columns.slice(leadingNonTotalCount).map((col) => {
                                        const align      = effectiveAlign(col);
                                        const totalValue = col.total && totals[col.key] !== undefined
                                            ? totals[col.key]
                                            : undefined;

                                        return (
                                            <td
                                                key={col.key}
                                                className={`px-5 py-4 whitespace-nowrap ${ALIGN_CLASS[align]}`}
                                            >
                                                {totalValue !== undefined ? (
                                                    <span className="font-black text-[14px] text-stone-900 tabular-nums">
                                                        {formatCell(totalValue, col.type)}
                                                    </span>
                                                ) : null}
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}

// ─── DataCell ─────────────────────────────────────────────────────────────────
// Isolated sub-component so the type→style mapping stays readable.

interface DataCellProps {
    value:     unknown;
    type:      ColumnSpec['type'];
    isNumeric: boolean;
}

function DataCell({ value, type, isNumeric }: DataCellProps) {
    const formatted = formatCell(value, type);
    const isEmpty   = formatted === '—';

    if (isEmpty) {
        return <span className="text-gray-300 select-none">—</span>;
    }

    // Numeric types: bold, tabular-nums, stone-900
    if (isNumeric) {
        return (
            <span className="font-bold text-[13px] text-stone-900 tabular-nums">
                {formatted}
            </span>
        );
    }

    // Date: slightly emphasised
    if (type === 'date') {
        return (
            <span className="font-semibold text-[13px] text-stone-900">
                {formatted}
            </span>
        );
    }

    // String: muted, normal weight
    return (
        <span className="text-[13px] text-stone-700">
            {formatted}
        </span>
    );
}

// ─── AsyncQueuedBanner ────────────────────────────────────────────────────────

/**
 * Shown when the report exceeds `rowLimitSync` and has been dispatched as
 * a background job. Mirrors the design language of RevenueTable's async state.
 */
function AsyncQueuedBanner({ jobId }: { jobId?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="relative mb-5">
                <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
                <div className="relative p-4 bg-amber-50 border border-amber-200 rounded-2xl inline-flex">
                    <Clock4 className="h-8 w-8 text-amber-500" />
                </div>
            </div>

            <h3 className="font-black text-stone-900 text-base mb-1">
                Report Queued
            </h3>
            <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
                This report spans a large dataset and is being generated in the
                background. You can safely navigate away — we'll notify you when
                it's ready.
            </p>

            {jobId && (
                <div className="mt-4 inline-flex items-center gap-2 bg-gray-100 border border-gray-200 text-gray-500 text-[11px] font-mono font-bold px-3 py-1.5 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                    Job ID: {jobId}
                </div>
            )}
        </div>
    );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-200 shadow-sm py-20 px-6 text-center">
            <div className="p-4 bg-gray-100 rounded-2xl mb-4 inline-flex">
                <Inbox className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="font-bold text-stone-900 mb-1">No data found</h3>
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                Your current filter combination returned zero results. Try widening
                the date range.
            </p>
        </div>
    );
}
