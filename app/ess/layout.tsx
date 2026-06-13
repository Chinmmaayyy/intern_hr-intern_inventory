import React from 'react';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/backend/db';
import { redirect } from 'next/navigation';
import { Clock, ShieldAlert } from 'lucide-react';
import { logout } from '@/app/login/actions';
import { AppShell } from '@/app/components/layout/AppShell';

export const dynamic = 'force-dynamic';

export default async function ESSLayout({
    children
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();
    if (!session) {
        redirect('/login');
    }

    // Check if user has a linked Employee profile
    let employee = await prisma.employee.findFirst({
        where: {
            user_id: session.id,
            organizationId: session.organization_id
        }
    });

    if (!employee && session.role !== 'patient') {
        // Self-healing: auto-create/link employee profile for staff users if missing
        try {
            const searchEmail = session.username + '@avanihospital.com';
            const existingUnlinked = await prisma.employee.findFirst({
                where: {
                    user_id: null,
                    organizationId: session.organization_id,
                    OR: [
                        { email: searchEmail },
                        { name: session.name }
                    ]
                }
            });

            if (existingUnlinked) {
                // Link existing employee to this user session
                employee = await prisma.employee.update({
                    where: { id: existingUnlinked.id },
                    data: { user_id: session.id }
                });
            } else {
                // Create a new employee record on the fly
                const randomCode = 'EMP-' + Math.random().toString(36).substring(2, 7).toUpperCase();
                employee = await prisma.employee.create({
                    data: {
                        user_id: session.id,
                        employee_code: randomCode,
                        name: session.name || 'Demo Staff',
                        designation: session.role.charAt(0).toUpperCase() + session.role.slice(1),
                        date_of_joining: new Date(),
                        salary_basic: 25000,
                        is_active: true,
                        email: searchEmail,
                        organizationId: session.organization_id
                    }
                });
            }
        } catch (err) {
            console.error('Failed to auto-create employee profile:', err);
        }
    }

    if (!employee) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm max-w-md w-full p-6 text-center space-y-4">
                    <div className="p-3 rounded-full bg-red-50 text-red-600 inline-block">
                        <ShieldAlert className="h-8 w-8" />
                    </div>
                    <h2 className="text-lg font-black text-gray-900">Profile Link Missing</h2>
                    <p className="text-gray-600 text-sm leading-relaxed">
                        Your user account is not linked to an employee profile. 
                        Please contact HR to associate your profile.
                    </p>
                    <form action={async () => {
                        'use server';
                        await logout();
                    }}>
                        <button type="submit" className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all">
                            Sign Out
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <AppShell pageTitle="Employee Self Service" pageIcon={<Clock className="h-5 w-5 text-orange-500" />}>
            {children}
        </AppShell>
    );
}
