import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminPage } from '@/app/admin/components/AdminPage';
import { TrendingUp } from 'lucide-react';
import { generateReport } from '@/app/actions/mis-report-actions';
import { DailyRevenueShell } from '@/components/mis/DailyRevenueShell';
import type { RevenuePayload, RevenueRow, RevenueTotals } from '@/components/mis/RevenueTable';

export const metadata: Metadata = {
    title: 'Daily Revenue Report — MIS | HospitalOS',
    description: 'Management Information System — daily revenue breakdown by doctor, department, and payer.',
};

// ─── Next.js 14: searchParams is a Promise in Server Components ───────────────
// With strict:true the prop type MUST be Promise<...>, and it must be awaited.
// Passing it directly (without await) to child components is a type error.
//
// Next.js 14 searchParams shape:
//   { [key: string]: string | string[] | undefined }
//
// We normalise to `string | undefined` by always taking the first element
// when the value is an array (e.g. ?startDate=X&startDate=Y → "X").
type PageSearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// ─── URL param → Zod filter key mapping ──────────────────────────────────────
//
// MISFilterEngine writes to the URL using the keys:
//   startDate, endDate, doctor
//
// The Zod schema in lib/mis/registry/billing.ts expects:
//   date_start (required), date_end (required), branch_id?, department_id?
//
// This mapping layer is the single source of truth for that translation.
// If the backend schema changes its key names, only this object needs updating.
//
// Note: `doctor` is NOT a supported filter key in the current Zod schema
// (filtering by doctor_name is not a Prisma-level filter; it is a client-side
// concern handled inside DailyRevenueShell). Only date_start / date_end are
// forwarded to the Server Action.

function buildFilters(sp: Awaited<PageSearchParams>): {
    date_start: string;
    date_end: string;
    branch_id?: string;
    department_id?: string;
} {
    // Coerce string | string[] | undefined → string | undefined
    const raw = (key: string): string | undefined => {
        const v = sp[key];
        if (Array.isArray(v)) return v[0];
        return v;
    };

    // Provide stable defaults when the user lands with no filters set.
    // Default window: last 30 days, matching the existing Reports Hub behaviour.
    const today      = new Date();
    const thirtyAgo  = new Date(today);
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const iso = (d: Date) => d.toISOString().split('T')[0];

    return {
        date_start:    raw('startDate')   ?? iso(thirtyAgo),
        date_end:      raw('endDate')     ?? iso(today),
        branch_id:     raw('branch_id'),    // reserved for future multi-branch filter
        department_id: raw('department_id'), // reserved for future department filter
    };
}

// ─── Page ────────────────────────────────────────────────────────────────────

interface DailyRevenuePageProps {
    searchParams: PageSearchParams;
}

export default async function DailyRevenuePage({ searchParams }: DailyRevenuePageProps) {
    // 1. Await the searchParams Promise (Next.js 14 requirement)
    const resolvedParams = await searchParams;

    // 2. Map URL keys → Zod-validated filter keys
    const filters = buildFilters(resolvedParams);

    // 3. Call the Server Action
    //    generateReport accepts `filters: unknown` and validates internally
    //    via the Zod schema in lib/mis/registry/billing.ts.
    //    It returns GenerateReportResponse from lib/mis/action-types.ts.
    const response = await generateReport('billing-revenue-daily', filters);

    // 4. Narrow GenerateReportResponse → RevenuePayload
    //    GenerateReportResponse uses the generic `Record<string, unknown>[]` for rows
    //    and `Record<string, number>` for totals. We cast to our typed frontend
    //    interface here, at the boundary, so every downstream component is fully typed.
    //    The column keys (date, department, doctor_name, payer_type, billed_amount,
    //    collected_amount, invoice_count) are guaranteed by the queryFn in billing.ts.
    const payload: RevenuePayload = {
        async:  response.async,
        jobId:  response.jobId,
        rows:   response.rows   as RevenueRow[]     | undefined,
        totals: response.totals as RevenueTotals    | undefined,
    };

    return (
        <AdminPage
            pageTitle="MIS — Daily Revenue Report"
            pageIcon={<TrendingUp className="h-5 w-5" />}
        >
            {/*
             * Suspense boundary is mandatory here.
             * DailyRevenueShell calls useSearchParams() for client-side filter
             * state, which suspends during SSR without this boundary.
             */}
            <Suspense fallback={<RevenuePageSkeleton />}>
                <DailyRevenueShell payload={payload} />
            </Suspense>
        </AdminPage>
    );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function RevenuePageSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            <div className="h-16 bg-gray-100 rounded-2xl" />
            <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-20 bg-gray-100 rounded-2xl" />
                ))}
            </div>
            <div className="h-[420px] bg-gray-100 rounded-2xl" />
        </div>
    );
}