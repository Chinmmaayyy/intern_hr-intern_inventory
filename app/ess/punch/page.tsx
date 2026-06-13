import { getSession } from '@/app/lib/session';
import { prisma } from '@/backend/db';
import { redirect } from 'next/navigation';
import { PunchClientView } from './PunchClientView';

export const dynamic = 'force-dynamic';

export default async function ESSPunchPage() {
    const session = await getSession();
    if (!session) redirect('/login');

    const employee = await prisma.employee.findFirst({
        where: { user_id: session.id, organizationId: session.organization_id },
        include: { organization: true }
    });
    if (!employee) redirect('/ess');

    let branch = null;
    if (employee.branch_id) {
        branch = await prisma.branch.findUnique({
            where: { id: employee.branch_id }
        });
    }

    // Target coordinates for geofencing. Fall back to organization coordinates.
    // If not configured, default to a standard coordinate (e.g. Bangalore center 12.9716, 77.5946)
    const targetLat = branch?.latitude ?? employee.organization.latitude ?? 12.9716;
    const targetLng = branch?.longitude ?? employee.organization.longitude ?? 77.5946;
    const locationName = branch?.branch_name ?? employee.organization.name;
    const radiusMeters = 500; // standard allowable geofence radius

    // Fetch today's attendance record
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const todayAttendance = await prisma.attendance.findFirst({
        where: {
            employee_id: employee.id,
            organizationId: session.organization_id,
            date: today
        }
    });

    return (
        <PunchClientView 
            employee={employee}
            organizationId={session.organization_id}
            targetLat={targetLat}
            targetLng={targetLng}
            locationName={locationName}
            radiusMeters={radiusMeters}
            todayAttendance={todayAttendance}
        />
    );
}
