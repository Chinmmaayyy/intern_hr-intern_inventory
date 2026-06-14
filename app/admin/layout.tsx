import type { Metadata } from 'next';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/backend/db';
import AdminLayoutShell from './components/AdminLayoutShell';
import ThemeProvider from './components/ThemeProvider';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
    title: 'Admin Panel — Hospital OS',
    description: 'Organization administration dashboard',
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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession();
    const branding = session?.organization_id
        ? await getBrandingForOrg(session.organization_id)
        : null;

    return (
        <ThemeProvider branding={branding}>
            <AdminLayoutShell userName={session?.name} userRole={session?.role}>
                {children}
            </AdminLayoutShell>
            {/*
             * Gap #8 fix: mount the react-hot-toast Toaster at the admin layout
             * level so notifications fired from any MIS page (or any other admin
             * page in future) persist across navigation and are rendered outside
             * the Suspense boundary of individual report pages.
             *
             * react-hot-toast ships its own 'use client' directive internally,
             * so it mounts correctly inside this Server Component layout.
             *
             * position: top-right keeps toasts clear of the left nav sidebar.
             * gutter: 12 gives comfortable separation from the edge.
             * toastOptions.duration: 6000 gives users time to read and click the
             * download link before the toast dismisses itself.
             */}
            <Toaster
                position="top-right"
                gutter={12}
                toastOptions={{
                    duration: 6000,
                    style: {
                        borderRadius: '12px',
                        fontSize:     '13px',
                        fontWeight:   '600',
                        maxWidth:     '380px',
                        boxShadow:    '0 4px 24px rgba(0,0,0,0.10)',
                    },
                    success: {
                        style: {
                            background: '#f0fdf4',
                            color:      '#166534',
                            border:     '1px solid #bbf7d0',
                        },
                        iconTheme: { primary: '#16a34a', secondary: '#f0fdf4' },
                    },
                    error: {
                        style: {
                            background: '#fff1f2',
                            color:      '#9f1239',
                            border:     '1px solid #fecdd3',
                        },
                        iconTheme: { primary: '#e11d48', secondary: '#fff1f2' },
                    },
                }}
            />
        </ThemeProvider>
    );
}

