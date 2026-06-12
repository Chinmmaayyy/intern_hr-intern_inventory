import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminPage } from '@/app/admin/components/AdminPage';
import { TrendingUp } from 'lucide-react';
import { DailyRevenueShell } from '@/components/mis/DailyRevenueShell';
import type { RevenuePayload } from '@/components/mis/RevenueTable';

export const metadata: Metadata = {
    title: 'Daily Revenue Report — MIS | HospitalOS',
    description: 'Management Information System — granular daily revenue breakdown by doctor, department, and payer.',
};

// ─── Mock Payload ──────────────────────────────────────────────────────────────
// Mirrors the exact shape returned by:
//   generateReport('billing-revenue-daily', filters)
//
// PRODUCTION SWAP: Replace this constant with the real Server Action call:
//
//   import { generateReport } from '@/app/actions/mis-actions';
//   const payload = await generateReport('billing-revenue-daily', {
//       startDate: searchParams.startDate,
//       endDate:   searchParams.endDate,
//       doctor:    searchParams.doctor,
//   });
//
// The downstream components (Shell → Table) require zero changes.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_PAYLOAD: RevenuePayload = {
    async: false,
    rows: [
        { date: '2026-06-12', department: 'Cardiology',       doctor_name: 'Dr. Smith',   payer_type: 'Insurance',  billed_amount: 5500,  collected_amount: 5000,  invoice_count: 3 },
        { date: '2026-06-12', department: 'Neurology',        doctor_name: 'Dr. Jones',   payer_type: 'Cash',       billed_amount: 3500,  collected_amount: 3200,  invoice_count: 2 },
        { date: '2026-06-11', department: 'Orthopedics',      doctor_name: 'Dr. Patel',   payer_type: 'Corporate',  billed_amount: 9000,  collected_amount: 7800,  invoice_count: 5 },
        { date: '2026-06-11', department: 'Cardiology',       doctor_name: 'Dr. Smith',   payer_type: 'Insurance',  billed_amount: 4800,  collected_amount: 4200,  invoice_count: 3 },
        { date: '2026-06-10', department: 'Dermatology',      doctor_name: 'Dr. Mehta',   payer_type: 'Cash',       billed_amount: 2200,  collected_amount: 1950,  invoice_count: 4 },
        { date: '2026-06-10', department: 'Gastroenterology', doctor_name: 'Dr. Kapoor',  payer_type: 'Government', billed_amount: 7200,  collected_amount: 6100,  invoice_count: 6 },
        { date: '2026-06-09', department: 'Neurology',        doctor_name: 'Dr. Jones',   payer_type: 'Insurance',  billed_amount: 3000,  collected_amount: 2750,  invoice_count: 2 },
        { date: '2026-06-09', department: 'Pulmonology',      doctor_name: 'Dr. Sharma',  payer_type: 'Corporate',  billed_amount: 4500,  collected_amount: 3900,  invoice_count: 3 },
        { date: '2026-06-08', department: 'Orthopedics',      doctor_name: 'Dr. Patel',   payer_type: 'Insurance',  billed_amount: 9500,  collected_amount: 8500,  invoice_count: 7 },
        { date: '2026-06-08', department: 'Dermatology',      doctor_name: 'Dr. Mehta',   payer_type: 'Cash',       billed_amount: 2500,  collected_amount: 2200,  invoice_count: 4 },
    ],
    // Server-computed totals — the table's <tfoot> reads these directly.
    // Values are the sum of the rows above; in production Prisma computes these.
    totals: {
        billed_amount:    51700,
        collected_amount: 45600,
        invoice_count:    39,
    },
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DailyRevenuePage() {
    return (
        <AdminPage
            pageTitle="MIS — Daily Revenue Report"
            pageIcon={<TrendingUp className="h-5 w-5" />}
        >
            {/*
             * Suspense boundary is required because DailyRevenueShell calls
             * useSearchParams() inside the Client Component subtree.
             * Without this, Next.js 14 will throw during SSR.
             */}
            <Suspense fallback={<RevenuePageSkeleton />}>
                <DailyRevenueShell payload={MOCK_PAYLOAD} />
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
