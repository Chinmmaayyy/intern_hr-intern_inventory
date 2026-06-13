'use client';

import React, { useState } from 'react';
import { approveOvertime } from '@/app/actions/attendance-actions';
import { Loader2, CheckCircle2, XCircle, Search, ClipboardList } from 'lucide-react';

interface OvertimeManagerProps {
    initialPending: any[];
    approverId: string;
    organizationId: string;
}

export function OvertimeManager({
    initialPending,
    approverId,
    organizationId
}: OvertimeManagerProps) {
    const [pendingList, setPendingList] = useState<any[]>(initialPending);
    const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const calculateOTPay = (item: any) => {
        const minutes = item.overtime_minutes || 0;
        const hours = minutes / 60;
        const basicSalary = item.employee?.salary_basic || 0;
        const grade = item.employee?.grade_band || '';
        
        // Standard assumption: 240 working hours/month (30 days * 8 hours)
        const hourlyRate = basicSalary / 240;

        const date = new Date(item.date);
        const dayOfWeek = date.getUTCDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        let multiplier = 1.0;
        let ruleName = '1.0x (Default)';

        if (isWeekend) {
            multiplier = 2.0;
            ruleName = '2.0x (Weekend)';
        } else if (grade === 'A') {
            multiplier = 1.5;
            ruleName = '1.5x (Grade A)';
        } else if (grade === 'B') {
            multiplier = 1.25;
            ruleName = '1.25x (Grade B)';
        }

        const pay = hours * hourlyRate * multiplier;
        return {
            hourlyRate,
            multiplier,
            ruleName,
            pay: Math.round(pay * 100) / 100
        };
    };

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    const handleApprove = async (attendanceId: number, employeeName: string) => {
        setActionLoadingId(attendanceId);
        try {
            const res = await approveOvertime(attendanceId, approverId, organizationId);
            if (res.success) {
                showToast('success', `OT approved for ${employeeName}`);
                setPendingList(prev => prev.filter(item => item.id !== attendanceId));
            } else {
                showToast('error', res.error || 'Failed to approve overtime.');
            }
        } catch (e: any) {
            showToast('error', e.message || 'An error occurred.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const formatOT = (minutes: number | null) => {
        if (!minutes) return '0h 0m';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h ${m}m`;
    };

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return '--:--';
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    };

    return (
        <div className="space-y-6">
            {/* Toast Feedback */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border transition-all text-sm font-semibold ${
                    toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Title Summary Card */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-bold text-amber-800">
                    {pendingList.length} overtime claims are pending review
                </span>
            </div>

            {pendingList.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                    <p className="text-gray-900 font-bold text-lg">All caught up!</p>
                    <p className="text-gray-400 text-xs mt-1">No pending overtime approvals found.</p>
                </div>
            ) : (
                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Employee</th>
                                    <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                                    <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Timesheet</th>
                                    <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Overtime Hours</th>
                                    <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">OT Rate Rule</th>
                                    <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Estimated OT Pay</th>
                                    <th className="text-right px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {pendingList.map((item) => {
                                    const isLoading = actionLoadingId === item.id;
                                    const { hourlyRate, ruleName, pay } = calculateOTPay(item);
                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <p className="font-bold text-gray-900">{item.employee.name}</p>
                                                <p className="text-[10px] text-gray-400">
                                                    {item.employee.employee_code} {item.employee.grade_band ? `[Grade ${item.employee.grade_band}]` : ''}
                                                </p>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap font-semibold text-gray-700">
                                                {formatDate(item.date)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-gray-600 font-medium">
                                                {formatTime(item.check_in)} - {formatTime(item.check_out)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap font-bold text-orange-600">
                                                {formatOT(item.overtime_minutes)} <span className="text-[10px] text-gray-400 font-normal">({item.total_hours ? `${item.total_hours} hrs` : '--'})</span>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-gray-600 font-semibold text-xs">
                                                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-full">{ruleName}</span>
                                                <p className="text-[9px] text-gray-400 mt-0.5">Basic: ₹{Math.round(hourlyRate)}/hr</p>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap font-extrabold text-emerald-600">
                                                ₹{pay.toLocaleString()}
                                            </td>
                                            <td className="px-5 py-4 text-right whitespace-nowrap">
                                                <button
                                                    disabled={isLoading}
                                                    onClick={() => handleApprove(item.id, item.employee.name)}
                                                    className="px-4 py-1.5 text-xs font-bold text-white rounded-lg transition-all flex items-center gap-1 hover:shadow-md ml-auto"
                                                    style={{ background: 'linear-gradient(to right, #f97316, #16a34a)' }}
                                                >
                                                    {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                                    Approve
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
