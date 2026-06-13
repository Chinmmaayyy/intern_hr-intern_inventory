import { getMyAttendance, getAttendancePolicy } from '@/app/actions/attendance-actions';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/backend/db';
import { redirect } from 'next/navigation';
import { AttendanceClientView } from './AttendanceClientView';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ month?: string; year?: string; regularize?: string }>;
}

export default async function ESSAttendancePage({ searchParams }: PageProps) {
    const session = await getSession();
    if (!session) redirect('/login');

    const employee = await prisma.employee.findFirst({
        where: { user_id: session.id, organizationId: session.organization_id }
    });
    if (!employee) redirect('/ess');

    const params = await searchParams;
    const now = new Date();
    const month = params.month ? parseInt(params.month, 10) : now.getUTCMonth() + 1;
    const year = params.year ? parseInt(params.year, 10) : now.getUTCFullYear();

    // Fetch employee's monthly attendance
    const attendance = await getMyAttendance(employee.id, month, year);

    // Fetch employee's regularizations to check status in the action column
    const regularizations = await prisma.attendanceRegularization.findMany({
        where: { employee_id: employee.id, organizationId: session.organization_id }
    });

    // Policy
    const policy = await getAttendancePolicy(session.organization_id);

    return (
        <AttendanceClientView 
            attendance={attendance} 
            regularizations={regularizations} 
            employee={employee}
            policy={policy}
            month={month}
            year={year}
            organizationId={session.organization_id}
            initialRegularizeDate={params.regularize}
        />
    );
}
