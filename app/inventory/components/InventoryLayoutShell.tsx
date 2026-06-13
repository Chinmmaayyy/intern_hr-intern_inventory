'use client';

import React from 'react';
import InventorySidebar from './InventorySidebar';
import Topbar from '@/app/admin/components/Topbar';
import { AdminPortalContext } from '@/app/admin/components/AdminPortalContext';

interface InventoryLayoutShellProps {
    children: React.ReactNode;
    userName?: string;
    userRole?: string;
}

export default function InventoryLayoutShell({ children, userName, userRole }: InventoryLayoutShellProps) {
    return (
        <AdminPortalContext.Provider value={true}>
            <div className="flex h-screen relative" style={{ backgroundColor: 'var(--admin-bg)' }}>
                {/* Global Ambient Background */}
                <div className="blob b1" />
                <div className="blob b2" />
                <div className="blob b3" />
                <div className="grid-bg" />

                <InventorySidebar userRole={userRole} />
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative z-10">
                    <Topbar userName={userName} userRole={userRole} />
                    <main className="flex-1 overflow-y-auto">
                        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10 py-8">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </AdminPortalContext.Provider>
    );
}
