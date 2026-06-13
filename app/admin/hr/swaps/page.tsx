'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Repeat, Loader2, Check, X, Clock } from 'lucide-react';
import { getSwapRequestsAdmin, adminApproveSwap, adminRejectSwap } from '@/app/actions/shift-roster-actions';

export default function AdminShiftSwaps() {
    const [swaps, setSwaps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        const res = await getSwapRequestsAdmin();
        if (res.success) setSwaps(res.data);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleApprove = async (id: number) => {
        if (!confirm('Approve this swap? This will swap the actual assignments.')) return;
        // In real app we would pass the actual admin user ID
        const res = await adminApproveSwap(id, 'AdminUser');
        if (res.success) loadData();
    };

    const handleReject = async (id: number) => {
        const reason = prompt('Reason for rejection (optional)?');
        if (reason === null) return; // User cancelled prompt
        const res = await adminRejectSwap(id, reason);
        if (res.success) loadData();
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Shift Swaps</h1>
                    <p className="text-sm text-gray-500 font-medium">Review and approve employee shift swap requests</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                            <tr>
                                <th className="p-4">Requester (Giving)</th>
                                <th className="p-4 flex justify-center"><Repeat className="h-4 w-4 text-gray-400" /></th>
                                <th className="p-4">Target (Taking)</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {swaps.map((swap: any) => (
                                <tr key={swap.id} className="hover:bg-gray-50">
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900">{swap.requesterAssignment?.employee?.name || `Emp #${swap.requester_employee_id}`}</div>
                                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                            <Clock className="h-3 w-3" />
                                            {swap.requesterAssignment?.shift_pattern?.name} ({new Date(swap.requesterAssignment?.date).toLocaleDateString()})
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                                            <Repeat className="h-4 w-4 text-gray-400" />
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900">{swap.targetAssignment?.employee?.name || `Emp #${swap.target_employee_id}`}</div>
                                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                            <Clock className="h-3 w-3" />
                                            {swap.targetAssignment?.shift_pattern?.name} ({new Date(swap.targetAssignment?.date).toLocaleDateString()})
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                                            swap.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 
                                            swap.status === 'ADMIN_APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                                        }`}>
                                            {swap.status}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {swap.status === 'PENDING' && (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleApprove(swap.id)} className="p-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg">
                                                    <Check className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => handleReject(swap.id)} className="p-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg">
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {swaps.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">No pending swap requests</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
