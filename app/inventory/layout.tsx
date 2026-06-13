import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/backend/db';
import InventoryLayoutShell from './components/InventoryLayoutShell';
import ThemeProvider from '@/app/admin/components/ThemeProvider';

export const metadata: Metadata = {
    title: 'Inventory Portal — Hospital OS',
    description: 'Hospital materials & supply chain management',
};

async function getBrandingForOrg(organizationId: string) {
    try {
        const branding = await prisma.organizationBranding.findUnique({
            where: { organizationId },
        });
        return branding;
    } catch {
        return null;
    }
}

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession();
    if (!session) redirect('/login');

    const moduleConfig = session.organization_id
        ? await prisma.moduleConfig.findFirst({
            where: { organizationId: session.organization_id, module_key: 'inventory' },
        })
        : null;

    if (moduleConfig && !moduleConfig.enabled) {
        redirect('/login?error=inventory_disabled');
    }

    const branding = session.organization_id
        ? await getBrandingForOrg(session.organization_id)
        : null;

    return (
        <ThemeProvider branding={branding}>
            <InventoryLayoutShell userName={session?.name} userRole={session?.role}>
                {children}
            </InventoryLayoutShell>
        </ThemeProvider>
    );
}
