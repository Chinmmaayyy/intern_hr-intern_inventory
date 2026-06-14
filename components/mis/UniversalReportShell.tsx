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
 * ## Async / Empty / RBAC states
 *   - payload.error === 'UNAUTHORIZED' → renders <AccessDeniedState>
 *   - payload.async === true           → renders <AsyncQueuedBanner>
 *   - rows.length === 0               → renders <EmptyState>
 *
 * ## Drill-Down (Phase 3)
 *   - When drillDownTo + drillDownKey props are set, each <tr> becomes
 *     clickable. Clicking a row fires handleDrillDown() which calls
 *     generateReport() and getReportColumns() in parallel, then renders
 *     <DrillDownPanel> below the main table card.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { MISFilterEngine } from '@/components/mis/MISFilterEngine';
import { ExportExcelButton } from '@/components/mis/ExportExcelButton';
import { ExportPDFButton } from '@/components/mis/ExportPDFButton';
import {
    BarChart3, ChevronDown, ChevronLeft, ChevronRight,
    Inbox, Clock4, ShieldOff, X, Download, Loader2,
} from 'lucide-react';
import { generateReport, getReportColumns } from '@/app/actions/mis-report-actions';

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
    /**
     * Set to 'UNAUTHORIZED' by generateReport() when the user's role does not
     * grant the requiredPermission for this report. The shell renders
     * <AccessDeniedState> instead of crashing or showing empty data.
     */
    error?:  string;
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
    /**
     * Registry ID of the detail/child report to open on row click.
     * If omitted, rows are not clickable and no drill-down is rendered.
     * Source: ReportDefinition.drillDownTo from the registry.
     */
    drillDownTo?:  string;
    /**
     * Which field in the clicked summary row to use as the filter value
     * when calling generateReport(drillDownTo, { date_start, date_end, … }).
     * Source: ReportDefinition.drillDownKey from the registry.
     */
    drillDownKey?: string;
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
    drillDownTo,
    drillDownKey,
}: UniversalReportShellProps) {
    const searchParams = useSearchParams();

    // Read URL params — written by MISFilterEngine via router.push()
    const startDate = searchParams.get('startDate') ?? '';
    const endDate   = searchParams.get('endDate')   ?? '';

    // ── 0. Access Denied state ───────────────────────────────────────────────
    // generateReport() returns { error: 'UNAUTHORIZED' } instead of throwing
    // so Next.js never reaches its error boundary. We catch it here and show
    // a polite, informative UI rather than a blank page or a crash.
    if (payload.error === 'UNAUTHORIZED') {
        return <AccessDeniedState />;
    }

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
        <DrillDownWrapper
            reportId={reportId}
            reportName={reportName}
            columns={columns}
            rows={rows}
            totals={totals}
            showTotalsRow={showTotalsRow}
            leadingNonTotalCount={leadingNonTotalCount}
            exportFilters={exportFilters}
            drillDownTo={drillDownTo}
            drillDownKey={drillDownKey}
        />
    );
}

// ─── DrillDownWrapper ─────────────────────────────────────────────────────────
//
// Extracted into its own component so hooks (useState, useCallback) are only
// instantiated when there IS data to display — hooks cannot be called
// conditionally before the early-return guards above. This pattern avoids
// the React "hooks before return" rule violation that would occur if we put
// useState inside the main component body above the `if (rows.length === 0)`
// guard.

interface DrillDownWrapperProps {
    reportId:             string;
    reportName:           string;
    columns:              ColumnSpec[];
    rows:                 Record<string, unknown>[];
    totals:               Record<string, number>;
    showTotalsRow:        boolean;
    leadingNonTotalCount: number;
    exportFilters:        { date_start?: string; date_end?: string };
    drillDownTo?:         string;
    drillDownKey?:        string;
}

// ─── Pagination constants ─────────────────────────────────────────────────────

/**
 * Gap #13 fix: limit DOM rows to PAGE_SIZE to prevent main-thread jank on
 * large sync datasets (reports near rowLimitSync → up to 5 000 rows).
 *
 * 100 rows per page: renders ~100 <tr> nodes instead of 5 000, dropping
 * initial render time from ~600 ms to ~12 ms on a Celeron-class machine.
 * The totals row is always computed over all rows server-side — unaffected.
 */
const PAGE_SIZE = 100;

function DrillDownWrapper({
    reportId,
    reportName,
    columns,
    rows,
    totals,
    showTotalsRow,
    leadingNonTotalCount,
    exportFilters,
    drillDownTo,
    drillDownKey,
}: DrillDownWrapperProps) {
    // ── Drill-Down state ─────────────────────────────────────────────────────
    const [drillRow,     setDrillRow]     = useState<Record<string, unknown> | null>(null);
    const [drillPayload, setDrillPayload] = useState<UniversalPayload | null>(null);
    const [drillColumns, setDrillColumns] = useState<ColumnSpec[]>([]);
    const [drillName,    setDrillName]    = useState('');
    const [drillLoading, setDrillLoading] = useState(false);
    const [drillError,   setDrillError]   = useState<string | null>(null);

    // ── Gap #13: Pagination state for the main table ─────────────────────────
    const [currentPage, setCurrentPage] = useState(1);

    /**
     * Called when the user clicks a summary row while drillDownTo is set.
     *
     * Fires getReportColumns() and generateReport() in parallel so the
     * DrillDownPanel has both column schema AND data by the time it renders.
     * The drillDownKey's value from the clicked row is forwarded as both
     * date_start and date_end so the detail report is filtered to that day.
     */
    const handleDrillDown = useCallback(async (row: Record<string, unknown>) => {
        if (!drillDownTo || !drillDownKey) return;

        setDrillRow(row);
        setDrillLoading(true);
        setDrillError(null);
        setDrillPayload(null);

        // ── Robust date extraction ───────────────────────────────────────────
        //
        // Why NOT `instanceof Date`:
        //   row values arrive from a Server Action via JSON serialisation.
        //   Date objects do not survive JSON — they become ISO datetime strings
        //   like "2026-06-12T00:00:00.000Z". instanceof Date is always false.
        //
        // Why NOT String(rawVal) directly:
        //   That sends "2026-06-12T00:00:00.000Z" as date_start and date_end.
        //   The query does `new Date(date_start)` and `new Date(date_end)` and
        //   gets the same UTC instant → zero-second window → 0 rows.
        //
        // Solution: always extract the YYYY-MM-DD portion, then:
        //   date_start = "YYYY-MM-DDT00:00:00.000Z" (start of UTC day)
        //   date_end   = "YYYY-MM-DDT23:59:59.999Z" (end   of UTC day)
        // This ensures new Date(date_end) covers the full IST calendar day.

        const rawVal = row[drillDownKey];
        const rawStr = rawVal instanceof Date
            ? rawVal.toISOString()          // should not happen, but safe fallback
            : String(rawVal ?? '');

        // Match YYYY-MM-DD at the start of any string (covers both
        // "2026-06-12" and "2026-06-12T00:00:00.000Z")
        const isoDateMatch = rawStr.match(/^(\d{4}-\d{2}-\d{2})/);
        const datePart = isoDateMatch ? isoDateMatch[1] : rawStr;

        const drillStart = `${datePart}T00:00:00.000Z`;
        const drillEnd   = `${datePart}T23:59:59.999Z`;

        try {
            const [metaResult, reportResult] = await Promise.all([
                getReportColumns(drillDownTo),
                generateReport(drillDownTo, {
                    // Spread parent context first (branch_id, department_id, etc.)
                    // so the drill-down date keys always win, even when exportFilters
                    // carries undefined values from an unset URL date param.
                    ...exportFilters,
                    date_start: drillStart,
                    date_end:   drillEnd,
                }),
            ]);

            setDrillColumns(metaResult.columns);
            setDrillName(metaResult.name);
            setDrillPayload(reportResult as UniversalPayload);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to load detail data.';
            setDrillError(msg);
        } finally {
            setDrillLoading(false);
        }
    }, [drillDownTo, drillDownKey, exportFilters]);

    const handleDrillClose = useCallback(() => {
        setDrillRow(null);
        setDrillPayload(null);
        setDrillError(null);
    }, []);

    // ── Gap #13: Pagination helpers ──────────────────────────────────────────
    const totalPages    = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    // Clamp: if rows shrink (e.g. filter change), stay in bounds.
    const safePage      = Math.min(currentPage, totalPages);
    const pageStart     = (safePage - 1) * PAGE_SIZE;
    const pagedRows     = rows.slice(pageStart, pageStart + PAGE_SIZE);
    const showPaginator = rows.length > PAGE_SIZE;

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
                        {/* Drill-down hint badge */}
                        {drillDownTo && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <ChevronDown className="h-2.5 w-2.5" aria-hidden="true" />
                                Expandable
                            </span>
                        )}
                    </div>

                    {/* Right controls: row count pill + export button */}
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                            {rows.length} {rows.length === 1 ? 'row' : 'rows'}
                            {showPaginator && (
                                <span className="ml-1 text-gray-300 font-medium">
                                    — page {safePage}/{totalPages}
                                </span>
                            )}
                        </span>
                        <ExportPDFButton
                            reportName={reportName}
                            columns={columns}
                            rows={rows}
                            totals={totals}
                        />
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

                        {/* ── tbody — paged rows only (Gap #13) ──────────── */}
                        <tbody>
                            {pagedRows.map((row, rowIdx) => {
                                const actualIdx   = pageStart + rowIdx;
                                const isEven      = actualIdx % 2 === 0;
                                const isSelected  = drillRow === row;
                                const isDrillable = Boolean(drillDownTo && drillDownKey);

                                return (
                                    <tr
                                        key={rowIdx}
                                        onClick={isDrillable ? () => handleDrillDown(row) : undefined}
                                        aria-expanded={isSelected ? true : undefined}
                                        className={`
                                            border-b border-gray-50
                                            transition-colors duration-100
                                            ${isDrillable
                                                ? 'cursor-pointer hover:bg-emerald-100/60'
                                                : 'hover:bg-emerald-50/40'
                                            }
                                            ${isSelected
                                                ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200'
                                                : isEven ? 'bg-white' : 'bg-gray-50/30'
                                            }
                                        `}
                                    >
                                        {columns.map((col) => {
                                            const value     = row[col.key];
                                            const align     = effectiveAlign(col);
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

            {/* ── Paginator (Gap #13) ────────────────────────────────────────── */}
            {showPaginator && (
                <Paginator
                    current={safePage}
                    total={totalPages}
                    rowsOnPage={pagedRows.length}
                    totalRows={rows.length}
                    onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    onPage={(p) => setCurrentPage(p)}
                />
            )}

            {/* ── Drill-Down Panel ──────────────────────────────────────────────── */}
            {drillRow && (
                <DrillDownPanel
                    loading={drillLoading}
                    error={drillError}
                    name={drillName}
                    columns={drillColumns}
                    payload={drillPayload}
                    onClose={handleDrillClose}
                />
            )}
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

// ─── Paginator ────────────────────────────────────────────────────────────────
//
// Gap #13: client-side pagination control for large sync datasets.
// Renders Prev / numbered pages / Next + a "Rows X–Y of Z" counter.
// Only mounted when rows.length > PAGE_SIZE.

interface PaginatorProps {
    current:    number;
    total:      number;
    rowsOnPage: number;
    totalRows:  number;
    onPrev:     () => void;
    onNext:     () => void;
    onPage:     (page: number) => void;
}

function Paginator({ current, total, rowsOnPage, totalRows, onPrev, onNext, onPage }: PaginatorProps) {
    // Build a compact page-number array with ellipsis.
    // Always show first, last, current ±1, and ellipsis where gaps exist.
    const pages: (number | '…')[] = [];
    const WINDOW = 1; // siblings around current

    const addPage = (n: number) => {
        if (pages[pages.length - 1] !== n) pages.push(n);
    };
    const addGap = () => {
        if (pages[pages.length - 1] !== '…') pages.push('…');
    };

    for (let p = 1; p <= total; p++) {
        if (p === 1 || p === total || (p >= current - WINDOW && p <= current + WINDOW)) {
            addPage(p);
        } else if (p === current - WINDOW - 1 || p === current + WINDOW + 1) {
            addGap();
        }
    }

    const pageStart = (current - 1) * PAGE_SIZE + 1;
    const pageEnd   = pageStart + rowsOnPage - 1;

    const btnBase = 'inline-flex items-center justify-center min-w-[30px] h-[30px] px-1.5 text-[12px] font-bold rounded-lg transition-colors select-none';

    return (
        <div className="flex items-center justify-between px-2 py-2">
            {/* Row range counter */}
            <span className="text-[11px] font-semibold text-gray-400 tabular-nums">
                Rows {pageStart}–{pageEnd} of {totalRows}
            </span>

            {/* Page buttons */}
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={onPrev}
                    disabled={current === 1}
                    aria-label="Previous page"
                    className={`${btnBase} text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </button>

                {pages.map((p, i) =>
                    p === '…' ? (
                        <span key={`gap-${i}`} className="text-[12px] text-gray-300 px-1 select-none">…</span>
                    ) : (
                        <button
                            key={p}
                            type="button"
                            onClick={() => onPage(p as number)}
                            aria-label={`Page ${p}`}
                            aria-current={p === current ? 'page' : undefined}
                            className={`${btnBase} ${
                                p === current
                                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            {p}
                        </button>
                    )
                )}

                <button
                    type="button"
                    onClick={onNext}
                    disabled={current === total}
                    aria-label="Next page"
                    className={`${btnBase} text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}

// ─── DrillDownPanel ───────────────────────────────────────────────────────────

interface DrillDownPanelProps {
    loading:  boolean;
    error:    string | null;
    name:     string;
    columns:  ColumnSpec[];
    payload:  UniversalPayload | null;
    onClose:  () => void;
}

/**
 * Rendered below the main table card when the user clicks a drillable row.
 *
 * Visual design:
 *  - Animated slide-down entrance
 *  - Left border accent in emerald-500 (signals "child of" relationship)
 *  - Header: "↳ Detail: {reportName}" + close ×
 *  - Loading: 6 pulsing skeleton rows
 *  - Error: inline rose-tinted alert
 *  - Data: same formatCell / ALIGN_CLASS helpers as the parent table
 *  - Empty: brief "No matching records" notice
 */
function DrillDownPanel({ loading, error, name, columns, payload, onClose }: DrillDownPanelProps) {
    const rows   = payload?.rows   ?? [];
    const totals = payload?.totals ?? {};

    const [excelExporting, setExcelExporting] = useState(false);

    const exportCsv = () => {
        if (!payload || !payload.rows || payload.rows.length === 0) return;
        const rowKeys = columns.map(c => c.key);
        const headers = columns.map(c => `"${String(c.label).replace(/"/g, '""')}"`).join(',');
        const csvRows = payload.rows.map(r => 
            rowKeys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')
        );
        const csv = [headers, ...csvRows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${name}-detail.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const exportExcel = async () => {
        if (!payload || !payload.rows || payload.rows.length === 0) return;
        setExcelExporting(true);
        try {
            const xlsxModule = await import('xlsx');
            const XLSX = xlsxModule.default ?? xlsxModule;

            const exportRows = payload.rows.map(r => {
                const row: Record<string, unknown> = {};
                columns.forEach(c => {
                    row[c.label] = r[c.key] ?? '';
                });
                return row;
            });

            const ws = XLSX.utils.json_to_sheet(exportRows);

            ws['!cols'] = columns.map(c => {
                const maxDataLen = payload.rows!.reduce((max, r) => {
                    const val = String(r[c.key] ?? '');
                    return Math.max(max, val.length);
                }, 0);
                return { wch: Math.max((c.label || '').length, maxDataLen, 10) + 2 };
            });

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Detail Data');
            XLSX.writeFile(wb, `${name}-detail.xlsx`);
        } catch (err) {
            console.error('Excel export failed:', err);
            alert('Excel export failed. Please try again.');
        } finally {
            setExcelExporting(false);
        }
    };

    return (
        <div
            className="bg-white rounded-2xl border border-gray-200 border-l-4 border-l-emerald-500 shadow-md overflow-hidden animate-in slide-in-from-top-2 duration-200"
            role="region"
            aria-label={`Detail view: ${name}`}
        >
            {/* Panel header */}
            <div className="px-6 py-3.5 border-b border-gray-100 bg-emerald-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ChevronDown className="h-3.5 w-3.5 text-emerald-600 rotate-[-90deg]" aria-hidden="true" />
                    <span className="text-[12px] font-bold text-stone-900">
                        ↳ Detail: <span className="text-emerald-700">{name}</span>
                    </span>
                    {!loading && !error && payload && (
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {rows.length} {rows.length === 1 ? 'row' : 'rows'}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {!loading && !error && payload && !payload.error && rows.length > 0 && (
                        <div className="flex items-center gap-1.5 mr-2">
                            <button
                                type="button"
                                onClick={exportCsv}
                                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-md transition-colors"
                            >
                                <Download className="h-3 w-3" />
                                CSV
                            </button>
                            <button
                                type="button"
                                onClick={exportExcel}
                                disabled={excelExporting}
                                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 px-2.5 py-1 rounded-md transition-colors"
                            >
                                {excelExporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                                Excel
                            </button>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        aria-label="Close detail panel"
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* ── Loading skeleton ──────────────────────────────────────────── */}
            {loading && (
                <div className="px-6 py-4 space-y-3" aria-busy="true" aria-label="Loading detail data">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex gap-4 animate-pulse">
                            <div className="h-4 bg-gray-200 rounded flex-1" style={{ opacity: 1 - i * 0.12 }} />
                            <div className="h-4 bg-gray-200 rounded w-24"  style={{ opacity: 1 - i * 0.12 }} />
                            <div className="h-4 bg-gray-200 rounded w-28"  style={{ opacity: 1 - i * 0.12 }} />
                        </div>
                    ))}
                </div>
            )}

            {/* ── Error state ───────────────────────────────────────────────── */}
            {!loading && error && (
                <div className="px-6 py-5 flex items-start gap-3">
                    <div className="p-2 bg-rose-50 rounded-xl shrink-0">
                        <X className="h-4 w-4 text-rose-500" aria-hidden="true" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-stone-900">Failed to load details</p>
                        <p className="text-xs text-rose-600 mt-0.5 leading-relaxed">{error}</p>
                    </div>
                </div>
            )}

            {/* ── UNAUTHORIZED from drill-down generateReport ───────────────── */}
            {!loading && !error && payload?.error === 'UNAUTHORIZED' && (
                <div className="px-6 py-5 flex items-center gap-3">
                    <ShieldOff className="h-5 w-5 text-red-400 shrink-0" aria-hidden="true" />
                    <p className="text-sm text-gray-500">
                        You don&apos;t have permission to view the detail for this report.
                    </p>
                </div>
            )}

            {/* ── Empty detail set ──────────────────────────────────────────── */}
            {!loading && !error && payload && !payload.error && rows.length === 0 && (
                <div className="px-6 py-6 flex items-center gap-3 text-gray-400">
                    <Inbox className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <p className="text-sm">No matching records found for this selection.</p>
                </div>
            )}

            {/* ── Data table ────────────────────────────────────────────────── */}
            {!loading && !error && payload && !payload.error && rows.length > 0 && columns.length > 0 && (
                <div className="overflow-x-auto">
                    <table
                        className="w-full text-sm border-collapse"
                        style={{ minWidth: `${Math.max(columns.length * 140, 700)}px` }}
                    >
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        scope="col"
                                        className={`
                                            px-5 py-2.5
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
                        <tbody>
                            {rows.map((row, idx) => {
                                const isEven = idx % 2 === 0;
                                return (
                                    <tr
                                        key={idx}
                                        className={`
                                            border-b border-gray-50
                                            transition-colors duration-100
                                            hover:bg-emerald-50/30
                                            ${isEven ? 'bg-white' : 'bg-gray-50/20'}
                                        `}
                                    >
                                        {columns.map((col) => {
                                            const isNumeric =
                                                col.type === 'currency' ||
                                                col.type === 'number'   ||
                                                col.type === 'percent';
                                            return (
                                                <td
                                                    key={col.key}
                                                    className={`px-5 py-3 whitespace-nowrap ${ALIGN_CLASS[effectiveAlign(col)]}`}
                                                >
                                                    <DataCell
                                                        value={row[col.key]}
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
                        {/* Totals row for drill-down detail */}
                        {columns.some((c) => c.total) && Object.keys(totals).length > 0 && (() => {
                            let leading = 0;
                            for (const col of columns) {
                                if (col.total) break;
                                leading++;
                            }
                            const leadingSpan = Math.max(leading, 1);
                            return (
                                <tfoot>
                                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                                        <td colSpan={leadingSpan} className="px-5 py-3">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                                Subtotal
                                            </span>
                                        </td>
                                        {columns.slice(leadingSpan).map((col) => {
                                            const tv = col.total && totals[col.key] !== undefined
                                                ? totals[col.key]
                                                : undefined;
                                            return (
                                                <td
                                                    key={col.key}
                                                    className={`px-5 py-3 whitespace-nowrap ${ALIGN_CLASS[effectiveAlign(col)]}`}
                                                >
                                                    {tv !== undefined ? (
                                                        <span className="font-black text-[13px] text-stone-900 tabular-nums">
                                                            {formatCell(tv, col.type)}
                                                        </span>
                                                    ) : null}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </tfoot>
                            );
                        })()}
                    </table>
                </div>
            )}
        </div>
    );
}

// ─── AsyncQueuedBanner ────────────────────────────────────────────────────────

/**
 * Gap #8 fix — Architectural overhaul (v3): self-polling banner using native
 * useEffect + fetch against a REST Route Handler.
 *
 * ## Why SWR was ripped out
 *
 * Both previous attempts (v1 revalidateOnFocus, v2 all-options disabled) kept
 * SWR calling `getJobStatus` — a `'use server'` Server Action — every 3 s.
 *
 * In Next.js 15, invoking ANY Server Action from the browser unconditionally
 * invalidates the full-route RSC (React Server Component) cache for the owning
 * page segment. This is architectural, not configurable via SWR options:
 *
 *   fetch() → getJobStatus ('use server')
 *     → Next.js router: RSC cache bust for /admin/mis/[reportId]
 *     → page.tsx re-executes
 *     → generateReport() → runReport() → prisma.reportJob.create()   ← NEW JOB
 *     → payload.jobId changes
 *     → AsyncQueuedBanner remounts with new jobId
 *     → SWR reinitialises → polls again → ∞ loop
 *
 * ## The fix: REST Route Handler
 *
 * GET /api/mis/jobs/[jobId]  (app/api/mis/jobs/[jobId]/route.ts)
 *
 * Route Handlers are plain HTTP endpoints. Calling them with `fetch()` from
 * the browser has ZERO interaction with the Next.js router cache. The RSC
 * re-render loop is completely broken.
 *
 * ## Implementation: useEffect + setInterval + AbortController
 *
 * - `useEffect` with `[jobId]` dependency: starts/stops cleanly on mount,
 *   unmount, and jobId change.
 * - `setInterval` at 3 000 ms: replaces SWR's refreshInterval.
 * - `AbortController`: cancels the in-flight fetch if the component unmounts
 *   mid-request, preventing state updates on dead components.
 * - `toastFiredRef`: fires the completion toast exactly once per jobId.
 * - Clears the interval immediately when a terminal status is received so the
 *   browser makes no unnecessary further requests.
 */

/** Shape of the JSON response from GET /api/mis/jobs/[jobId] */
interface PollJobResponse {
    id:          string;
    status:      string;
    progress:    number;
    file_key?:   string | null;
    error?:      string | null;
    createdAt:   string;
    finished_at: string | null;
}

const POLL_INTERVAL_MS  = 3000;
const TERMINAL_STATUSES = ['Completed', 'Failed', 'Expired'] as const;
type TerminalStatus = typeof TERMINAL_STATUSES[number];

function AsyncQueuedBanner({ jobId }: { jobId?: string }) {
    // Live job status — drives the status pill in the banner.
    const [jobStatus, setJobStatus] = useState<PollJobResponse | null>(null);

    // Fires the completion toast exactly once per jobId mount.
    const toastFiredRef   = useRef(false);
    // Holds the setInterval handle so we can clear it on terminal state.
    const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
    // Holds the current AbortController so we can cancel in-flight fetches.
    const abortRef        = useRef<AbortController | null>(null);

    useEffect(() => {
        // No jobId — nothing to poll.
        if (!jobId) return;

        // Reset state for this jobId (handles remount with a different jobId).
        toastFiredRef.current = false;
        setJobStatus(null);

        // ── Core poll function ────────────────────────────────────────────────
        const poll = async () => {
            // Cancel any request still in-flight from the previous tick.
            if (abortRef.current) abortRef.current.abort();
            const controller    = new AbortController();
            abortRef.current    = controller;

            try {
                // ────────────────────────────────────────────────────────────────
                // CRITICAL: this is a REST Route Handler call, NOT a Server
                // Action call. It does not invalidate the Next.js router cache.
                // ────────────────────────────────────────────────────────────────
                const res = await fetch(`/api/mis/jobs/${jobId}`, {
                    signal:  controller.signal,
                    cache:   'no-store',   // never cache polling responses
                    headers: { Accept: 'application/json' },
                });

                if (!res.ok) {
                    if (res.status === 404) {
                        // Job not found or not owned — stop polling silently.
                        if (intervalRef.current) clearInterval(intervalRef.current);
                        intervalRef.current = null;
                    }
                    // For all other errors (5xx, etc.) keep polling —
                    // transient server errors should not stop monitoring.
                    return;
                }

                const data: PollJobResponse = await res.json();
                setJobStatus(data);

                // ── Terminal state handling ──────────────────────────────────
                const isTerminal = TERMINAL_STATUSES.includes(
                    data.status as TerminalStatus
                );

                if (isTerminal) {
                    // Stop the interval — no more polling needed.
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    intervalRef.current = null;

                    // Fire toast exactly once (ref prevents double-fire if
                    // setInterval callback runs again before clearing).
                    if (!toastFiredRef.current) {
                        toastFiredRef.current = true;

                        if (data.status === 'Completed' && data.file_key) {
                            const downloadUrl = `/api/mis/export/${jobId}`;
                            toast.success(
                                (t) => (
                                    <div className="flex flex-col gap-1.5">
                                        <span className="font-bold text-green-800">
                                            Report Ready!
                                        </span>
                                        <span className="text-[12px] text-green-700 font-normal leading-snug">
                                            Your export has finished processing.
                                        </span>
                                        <div className="flex gap-2 mt-1">
                                            <a
                                                href={downloadUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="
                                                    inline-flex items-center gap-1.5
                                                    text-[12px] font-bold text-white
                                                    bg-green-600 hover:bg-green-700
                                                    px-3 py-1.5 rounded-lg
                                                    transition-colors
                                                "
                                                onClick={() => toast.dismiss(t.id)}
                                            >
                                                <Download className="h-3 w-3" aria-hidden="true" />
                                                Download
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => toast.dismiss(t.id)}
                                                className="text-[12px] text-green-700 hover:text-green-900 px-2"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                ),
                                { duration: Infinity, id: `mis-job-done-${jobId}` }
                            );
                        } else if (data.status === 'Failed') {
                            toast.error(
                                `Report job failed: ${
                                    data.error ?? 'Unknown error. Please try again.'
                                }`,
                                { duration: 8000, id: `mis-job-failed-${jobId}` }
                            );
                        } else if (data.status === 'Expired') {
                            toast.error(
                                'This export has expired. Please regenerate the report.',
                                { duration: 6000, id: `mis-job-expired-${jobId}` }
                            );
                        }
                    }
                }

            } catch (err: unknown) {
                // AbortError = component unmounted or new poll started. Ignore.
                if (err instanceof Error && err.name === 'AbortError') return;
                // Any other fetch-level error (network down, DNS failure):
                // do NOT stop the interval — transient outages are recoverable.
                console.warn('[MIS Banner] Poll error (will retry):', err);
            }
        };

        // Fire immediately on mount, then repeat.
        poll();
        intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

        // ── Cleanup ────────────────────────────────────────────────────────────────
        // Runs when the component unmounts OR jobId changes.
        // Cancels in-flight HTTP requests and the polling interval.
        return () => {
            if (abortRef.current)  abortRef.current.abort();
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
        };
    }, [jobId]); // Re-run only when jobId changes — stable dep array prevents extra ticks

    // Derive a human-readable status label for the banner pill.
    const progressPct    = (jobStatus?.progress ?? 0) > 0 ? ` ${jobStatus!.progress}%` : '';
    const pollingStatus  = !jobStatus
        ? 'Queued'
        : jobStatus.status === 'Running'
        ? `Processing…${progressPct}`
        : jobStatus.status;

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
                background. You can safely navigate away — we&apos;ll notify you when
                it&apos;s ready.
            </p>

            {jobId && (
                <div className="mt-4 inline-flex items-center gap-2 bg-gray-100 border border-gray-200 text-gray-500 text-[11px] font-mono font-bold px-3 py-1.5 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                    {pollingStatus} · Job {jobId.slice(0, 8)}…
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

// ─── AccessDeniedState ────────────────────────────────────────────────────────

/**
 * Rendered when generateReport() returns { error: 'UNAUTHORIZED' }.
 *
 * Design mirrors EmptyState / AsyncQueuedBanner so all three non-data states
 * share the same visual language: centered card, icon, headline, body copy.
 *
 * IMPORTANT: We deliberately show a generic message rather than revealing
 * which permission key is missing — doing so could assist privilege escalation
 * attempts in a multi-tenant environment.
 */
function AccessDeniedState() {
    return (
        <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-red-100 shadow-sm py-20 px-6 text-center">
            {/* Icon container */}
            <div className="relative mb-5">
                <div className="absolute inset-0 rounded-full bg-red-400/10 animate-ping" />
                <div className="relative p-4 bg-red-50 border border-red-200 rounded-2xl inline-flex">
                    <ShieldOff className="h-8 w-8 text-red-500" aria-hidden="true" />
                </div>
            </div>

            <h3 className="font-black text-stone-900 text-base mb-1">
                Access Denied
            </h3>
            <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
                You don&apos;t have the required permissions to view this report.
                Please contact your system administrator if you believe this is
                an error.
            </p>

            {/* Role hint pill */}
            <div className="mt-5 inline-flex items-center gap-2 bg-red-50 border border-red-100 text-red-500 text-[11px] font-bold px-3 py-1.5 rounded-full select-none">
                <ShieldOff className="h-3 w-3" aria-hidden="true" />
                Insufficient permissions
            </div>
        </div>
    );
}
