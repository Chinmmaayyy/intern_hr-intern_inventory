import { AppShell } from '@/app/components/layout/AppShell';
import { Settings } from 'lucide-react';
import { getAttendancePolicy } from '@/app/actions/attendance-actions';
import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { PolicyForm } from './PolicyForm';

export const dynamic = 'force-dynamic';

export default async function HRPolicyPage() {
    const session = await getSession();
    if (!session || (session.role !== 'hr' && session.role !== 'admin')) {
        redirect('/unauthorized');
    }

    const policy = await getAttendancePolicy(session.organization_id);

    return (
        <AppShell pageTitle="Attendance Policy" pageIcon={<Settings className="h-5 w-5" />}>
            <PolicyForm initialPolicy={policy} organizationId={session.organization_id} />
        </AppShell>
    );
}
