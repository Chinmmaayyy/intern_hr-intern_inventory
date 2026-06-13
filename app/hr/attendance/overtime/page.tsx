import { AppShell } from '@/app/components/layout/AppShell';
import { Activity } from 'lucide-react';
import { getPendingOTApprovals } from '@/app/actions/attendance-actions';
import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { OvertimeManager } from './OvertimeManager';

export const dynamic = 'force-dynamic';

export default async function HROvertimePage() {
    const session = await getSession();
    if (!session || (session.role !== 'hr' && session.role !== 'admin')) {
        redirect('/unauthorized');
    }

    const pendingOT = await getPendingOTApprovals(session.organization_id);

    return (
        <AppShell pageTitle="Overtime Approvals" pageIcon={<Activity className="h-5 w-5" />}>
            <OvertimeManager 
                initialPending={pendingOT} 
                approverId={session.id} 
                organizationId={session.organization_id} 
            />
        </AppShell>
    );
}
