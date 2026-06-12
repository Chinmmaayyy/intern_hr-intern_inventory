'use client';

/**
 * MISFilterEngine
 * ---------------
 * Filter bar for the MIS Daily Revenue Report.
 *
 * STATE CONTRACT:
 *   All filter values are stored exclusively in URL Search Parameters.
 *   No local useState is used for filter state. This makes the view fully
 *   bookmarkable, shareable, and SSR-compatible.
 *
 *   URL shape:  ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&doctor=Dr.+Smith
 *
 * Implementation:
 *   - Reads current values via useSearchParams()
 *   - Writes new values via router.push() with a merged URLSearchParams object
 *   - Each input change triggers a URL update — no "Apply" button required
 *   - "Clear Filters" resets all params to empty string (removes keys)
 */

import React, { useCallback, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { CalendarRange, UserSearch, X, SlidersHorizontal } from 'lucide-react';

interface MISFilterEngineProps {
    /** Unique, sorted list of doctor names derived from the dataset. */
    doctorOptions: string[];
}

export function MISFilterEngine({ doctorOptions }: MISFilterEngineProps) {
    const router      = useRouter();
    const pathname    = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    // ── Current filter values read from URL ────────────────────────────────
    const startDate = searchParams.get('startDate') ?? '';
    const endDate   = searchParams.get('endDate')   ?? '';
    const doctor    = searchParams.get('doctor')    ?? '';

    const hasActiveFilters = Boolean(startDate || endDate || doctor);

    // ── Helper: push a merged param update to the URL ──────────────────────
    const pushParam = useCallback(
        (key: string, value: string) => {
            const params = new URLSearchParams(searchParams.toString());
            if (value) {
                params.set(key, value);
            } else {
                params.delete(key);
            }
            startTransition(() => {
                router.push(`${pathname}?${params.toString()}`, { scroll: false });
            });
        },
        [router, pathname, searchParams]
    );

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleStartDate = (e: React.ChangeEvent<HTMLInputElement>) =>
        pushParam('startDate', e.target.value);

    const handleEndDate = (e: React.ChangeEvent<HTMLInputElement>) =>
        pushParam('endDate', e.target.value);

    const handleDoctor = (e: React.ChangeEvent<HTMLSelectElement>) =>
        pushParam('doctor', e.target.value);

    const handleClear = () => {
        startTransition(() => {
            router.push(pathname, { scroll: false });
        });
    };

    return (
        <div
            className={`
                bg-white rounded-2xl border border-gray-200 shadow-sm
                px-5 py-4 transition-opacity duration-200
                ${isPending ? 'opacity-60 pointer-events-none' : 'opacity-100'}
            `}
            role="search"
            aria-label="Revenue report filters"
        >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* ── Label ───────────────────────────────────────────────── */}
                <div className="flex items-center gap-2 shrink-0 pr-2 sm:border-r sm:border-gray-100">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">
                        Filter By
                    </span>
                </div>

                {/* ── Date Range ──────────────────────────────────────────── */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <CalendarRange className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <div className="flex items-center gap-2 flex-1">
                        <div className="flex-1 min-w-0">
                            <label htmlFor="mis-start-date" className="sr-only">Start date</label>
                            <input
                                id="mis-start-date"
                                type="date"
                                value={startDate}
                                onChange={handleStartDate}
                                max={endDate || undefined}
                                className="
                                    w-full text-sm font-semibold text-stone-900
                                    bg-gray-50 border border-gray-200 rounded-xl
                                    px-3 py-2 outline-none
                                    focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400
                                    transition-all duration-150
                                    placeholder:text-gray-400
                                "
                                aria-label="Start date"
                            />
                        </div>

                        <span className="text-xs text-gray-400 font-medium shrink-0">to</span>

                        <div className="flex-1 min-w-0">
                            <label htmlFor="mis-end-date" className="sr-only">End date</label>
                            <input
                                id="mis-end-date"
                                type="date"
                                value={endDate}
                                onChange={handleEndDate}
                                min={startDate || undefined}
                                className="
                                    w-full text-sm font-semibold text-stone-900
                                    bg-gray-50 border border-gray-200 rounded-xl
                                    px-3 py-2 outline-none
                                    focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400
                                    transition-all duration-150
                                "
                                aria-label="End date"
                            />
                        </div>
                    </div>
                </div>

                {/* ── Doctor Select ────────────────────────────────────────── */}
                <div className="flex items-center gap-2 sm:w-56 shrink-0">
                    <UserSearch className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <div className="flex-1">
                        <label htmlFor="mis-doctor-select" className="sr-only">Filter by doctor</label>
                        <select
                            id="mis-doctor-select"
                            value={doctor}
                            onChange={handleDoctor}
                            className="
                                w-full text-sm font-semibold text-stone-900
                                bg-gray-50 border border-gray-200 rounded-xl
                                px-3 py-2 outline-none appearance-none
                                focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400
                                transition-all duration-150 cursor-pointer
                                bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22><path stroke=%22%236b7280%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22M6 8l4 4 4-4%22/></svg>')]
                                bg-no-repeat bg-[right_10px_center] bg-[length:16px]
                                pr-8
                            "
                            aria-label="Filter by doctor"
                        >
                            <option value="">All Doctors</option>
                            {doctorOptions.map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* ── Clear Button ─────────────────────────────────────────── */}
                {hasActiveFilters && (
                    <button
                        onClick={handleClear}
                        className="
                            flex items-center gap-1.5 text-xs font-bold
                            text-gray-500 hover:text-rose-600
                            bg-gray-100 hover:bg-rose-50
                            border border-gray-200 hover:border-rose-200
                            px-3 py-2 rounded-xl
                            transition-all duration-150 whitespace-nowrap shrink-0
                        "
                        aria-label="Clear all filters"
                    >
                        <X className="h-3 w-3" />
                        Clear
                    </button>
                )}
            </div>

            {/* ── Active filter pill summary ─────────────────────────────── */}
            {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                    {startDate && (
                        <FilterPill label="From" value={formatDisplayDate(startDate)} onRemove={() => pushParam('startDate', '')} />
                    )}
                    {endDate && (
                        <FilterPill label="To" value={formatDisplayDate(endDate)} onRemove={() => pushParam('endDate', '')} />
                    )}
                    {doctor && (
                        <FilterPill label="Doctor" value={doctor} onRemove={() => pushParam('doctor', '')} />
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Filter Pill ──────────────────────────────────────────────────────────────
function FilterPill({
    label,
    value,
    onRemove,
}: {
    label: string;
    value: string;
    onRemove: () => void;
}) {
    return (
        <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full">
            <span className="text-emerald-500">{label}:</span>
            {value}
            <button
                onClick={onRemove}
                className="ml-0.5 text-emerald-400 hover:text-emerald-700 transition-colors"
                aria-label={`Remove ${label} filter`}
            >
                <X className="h-2.5 w-2.5" />
            </button>
        </span>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDisplayDate(iso: string): string {
    if (!iso) return '';
    // Parse as UTC to avoid timezone-shift display bugs
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}
