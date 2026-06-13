import { getMyRegularizations, getAttendancePolicy } from '@/app/actions/attendance-actions';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/backend/db';
import { redirect } from 'next/navigation';
import { RegularizationsClientView } from './RegularizationsClientView';

export const dynamic = 'force-dynamic';

export default async function ESSRegularizationsPage() {
    const session = await getSession();
    if (!session) redirect('/login');

    const employee = await prisma.employee.findFirst({
        where: { user_id: session.id, organizationId: session.organization_id }
    });
    if (!employee) redirect('/ess');

    // Fetch employee's regularization requests
    const regularizations = await getMyRegularizations(employee.id);

    // Fetch policy
    const policy = await getAttendancePolicy(session.organization_id);

    return (
        <RegularizationsClientView 
            regularizations={regularizations} 
            employee={employee}
            policy={policy}
            organizationId={session.organization_id}
        />
    );
}
