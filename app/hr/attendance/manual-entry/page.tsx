import { AppShell } from '@/app/components/layout/AppShell';
import { Calendar } from 'lucide-react';
import { getEmployeeList } from '@/app/actions/hr-actions';
import { getAttendancePolicy } from '@/app/actions/attendance-actions';
import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { ManualEntryForm } from './ManualEntryForm';

export const dynamic = 'force-dynamic';

export default async function HRManualEntryPage() {
    const session = await getSession();
    if (!session || (session.role !== 'hr' && session.role !== 'admin')) {
        redirect('/unauthorized');
    }

    const employeesRes = await getEmployeeList({ isActive: true, limit: 1000 });
    const employees = employeesRes.success ? (employeesRes.data || []) : [];
    const policy = await getAttendancePolicy(session.organization_id);

    return (
        <AppShell pageTitle="Manual Attendance Entry" pageIcon={<Calendar className="h-5 w-5" />}>
            <ManualEntryForm 
                employees={employees} 
                policy={policy} 
                organizationId={session.organization_id} 
                enteredBy={session.id} 
            />
        </AppShell>
    );
}
