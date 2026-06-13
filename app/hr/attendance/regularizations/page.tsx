import { AppShell } from '@/app/components/layout/AppShell';
import { Clock } from 'lucide-react';
import { getPendingRegularizations, getRegularizationHistory } from '@/app/actions/attendance-actions';
import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { RegularizationManager } from './RegularizationManager';

export const dynamic = 'force-dynamic';

export default async function HRRegularizationsPage() {
    const session = await getSession();
    if (!session || (session.role !== 'hr' && session.role !== 'admin')) {
        redirect('/unauthorized');
    }

    const pending = await getPendingRegularizations(session.organization_id);
    const history = await getRegularizationHistory(session.organization_id, { status: 'ALL' });

    return (
        <AppShell pageTitle="Attendance Regularizations" pageIcon={<Clock className="h-5 w-5" />}>
            <RegularizationManager 
                initialPending={pending} 
                initialHistory={history} 
                reviewerId={session.id} 
                organizationId={session.organization_id} 
            />
        </AppShell>
    );
}
