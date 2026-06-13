import { AppShell } from '@/app/components/layout/AppShell';
import { Settings } from 'lucide-react';
import { getAttendanceDevicesAction } from '@/app/actions/attendance-actions';
import { prisma } from '@/backend/db';
import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { DeviceManager } from './DeviceManager';

export const dynamic = 'force-dynamic';

export default async function HRDevicesPage() {
    const session = await getSession();
    if (!session || (session.role !== 'hr' && session.role !== 'admin')) {
        redirect('/unauthorized');
    }

    const devicesRes = await getAttendanceDevicesAction();
    const devices = devicesRes.success ? (devicesRes.data || []) : [];

    const branches = await prisma.branch.findMany({
        where: { organizationId: session.organization_id }
    });

    return (
        <AppShell pageTitle="Biometric Devices" pageIcon={<Settings className="h-5 w-5" />}>
            <DeviceManager 
                initialDevices={devices} 
                branches={branches} 
                organizationId={session.organization_id} 
            />
        </AppShell>
    );
}
