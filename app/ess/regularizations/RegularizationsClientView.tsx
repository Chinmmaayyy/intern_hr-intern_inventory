'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitRegularization } from '@/app/actions/attendance-actions';
import { ClipboardList, Plus, FileText, CheckCircle2, XCircle, AlertTriangle, Clock, Loader2, Calendar } from 'lucide-react';

interface RegularizationsClientViewProps {
    regularizations: any[];
    employee: any;
    policy: any;
    organizationId: string;
}

export function RegularizationsClientView({
    regularizations,
    employee,
    policy,
    organizationId
}: RegularizationsClientViewProps) {
    const router = useRouter();

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalDate, setModalDate] = useState('');
    const [modalType, setModalType] = useState<'MISSED_PUNCH' | 'ON_DUTY' | 'WFH'>('MISSED_PUNCH');
    const [requestedCheckIn, setRequestedCheckIn] = useState('09:00');
    const [requestedCheckOut, setRequestedCheckOut] = useState('17:00');
    const [reason, setReason] = useState('');
    const [modalLoading, setModalLoading] = useState(false);
    const [modalError, setModalError] = useState('');

    // Feedback toast
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 5000);
    };

    // Calculate count of regularizations submitted this calendar month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyCount = regularizations.filter(r => {
        const d = new Date(r.created_at || r.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear && (r.status === 'PENDING' || r.status === 'APPROVED');
    }).length;

    const maxLimit = policy?.max_regularizations_month ?? 3;
    const isLimitReached = monthlyCount >= maxLimit;

    const handleOpenModal = () => {
        setModalDate(new Date().toISOString().split('T')[0]);
        setModalType('MISSED_PUNCH');
        setReason('');
        setModalError('');
        setShowModal(true);
    };

    const handleModalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (reason.length < 20) {
            setModalError('Reason must be at least 20 characters long.');
            return;
        }

        setModalLoading(true);
        setModalError('');

        try {
            const checkInDate = modalType === 'MISSED_PUNCH' ? new Date(`${modalDate}T${requestedCheckIn}:00`) : undefined;
            const checkOutDate = modalType === 'MISSED_PUNCH' ? new Date(`${modalDate}T${requestedCheckOut}:00`) : undefined;

            if (checkInDate && checkOutDate && checkOutDate < checkInDate) {
                checkOutDate.setDate(checkOutDate.getDate() + 1);
            }

            const res = await submitRegularization({
                employeeId: employee.id,
                date: new Date(modalDate),
                type: modalType,
                reason,
                requestedCheckIn: checkInDate,
                requestedCheckOut: checkOutDate,
                organizationId
            });

            if (res.success) {
                showToast('success', 'Regularization request submitted successfully.');
                setShowModal(false);
                router.refresh();
            } else {
                setModalError(res.error || 'Failed to submit regularization request.');
            }
        } catch (error: any) {
            setModalError(error.message || 'An error occurred.');
        } finally {
            setModalLoading(false);
        }
    };

    // Formatter helpers
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    };

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return '--:--';
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'PENDING': return 'bg-yellow-100 text-yellow-700';
            case 'APPROVED': return 'bg-green-100 text-green-700';
            case 'REJECTED': return 'bg-red-100 text-red-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'MISSED_PUNCH': return 'Missed Punch';
            case 'ON_DUTY': return 'On Duty';
            case 'WFH': return 'Work From Home';
            default: return type;
        }
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

            {/* Header section */}
            <div className="bg-[#1e2a4a] text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 rounded-xl text-orange-400">
                        <ClipboardList className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight text-white">Attendance Regularization</h1>
                        <p className="text-xs text-slate-300 mt-1">Submit corrections for missed punches, on-duty visits, or WFH logs.</p>
                    </div>
                </div>
                <button
                    onClick={handleOpenModal}
                    className="px-4 py-2.5 text-xs font-bold text-white rounded-xl hover:shadow-md transition-all flex items-center gap-1.5 shrink-0"
                    style={{ background: 'linear-gradient(to right, #f97316, #16a34a)' }}
                >
                    <Plus className="h-4 w-4" />
                    New Request
                </button>
            </div>

            {/* Limit Banner */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isLimitReached ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'}`}>
                        {isLimitReached ? <AlertTriangle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Monthly Limit Usage</p>
                        <p className="text-sm font-black text-gray-800 mt-0.5">
                            {monthlyCount} of {maxLimit} Requests Used <span className="text-gray-400 font-normal">({now.toLocaleString('default', { month: 'long' })})</span>
                        </p>
                    </div>
                </div>
                {isLimitReached && (
                    <div className="text-[11px] font-black text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1">
                        Cap of {maxLimit} monthly requests reached
                    </div>
                )}
            </div>

            {/* Regularization History Table */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="font-extrabold text-sm text-gray-800 uppercase tracking-wider">Request History</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Requested Date</th>
                                <th className="text-left px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type</th>
                                <th className="text-left px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Details</th>
                                <th className="text-left px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reason</th>
                                <th className="text-center px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="text-left px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Remarks / Actioned At</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {regularizations.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                        No regularization requests submitted yet.
                                    </td>
                                </tr>
                            ) : (
                                regularizations.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-800">
                                            {formatDate(item.date)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide bg-slate-100 text-slate-700">
                                                {getTypeLabel(item.type)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 font-medium">
                                            {item.type === 'MISSED_PUNCH' ? (
                                                <div className="flex flex-col">
                                                    <span>In: <strong className="text-gray-800">{formatTime(item.requested_check_in)}</strong></span>
                                                    <span>Out: <strong className="text-gray-800">{formatTime(item.requested_check_out)}</strong></span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">Full Day</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-gray-600 max-w-xs truncate" title={item.reason}>
                                            {item.reason}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide ${getStatusBadgeClass(item.status)}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-gray-500">
                                            {item.status === 'REJECTED' && item.rejection_reason && (
                                                <div className="text-red-600 font-medium">
                                                    Reason: {item.rejection_reason}
                                                </div>
                                            )}
                                            {item.status === 'APPROVED' && (
                                                <div className="text-green-600 font-medium">
                                                    Processed on {new Date(item.approved_at).toLocaleDateString()}
                                                </div>
                                            )}
                                            {item.status === 'PENDING' && (
                                                <span className="text-gray-400">Awaiting HR Review</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-gray-100 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wide">Submit Regularization</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-sm">✕</button>
                        </div>
                        <form onSubmit={handleModalSubmit} className="p-6 space-y-4">
                            {isLimitReached && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-bold">Cap Limit Reached:</span> You have already used all {maxLimit} regularization requests allowed for this month. Further submissions will fail.
                                    </div>
                                </div>
                            )}

                            {modalError && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                                    <XCircle className="h-4 w-4 shrink-0" />
                                    <span>{modalError}</span>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Date</label>
                                <input
                                    type="date"
                                    value={modalDate}
                                    max={new Date().toISOString().split('T')[0]}
                                    onChange={e => setModalDate(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Regularization Type</label>
                                <select
                                    value={modalType}
                                    onChange={e => setModalType(e.target.value as any)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                                >
                                    <option value="MISSED_PUNCH">Missed Punch</option>
                                    <option value="ON_DUTY">On Duty (External Work)</option>
                                    <option value="WFH">Work From Home</option>
                                </select>
                            </div>

                            {modalType === 'MISSED_PUNCH' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Requested Check-In</label>
                                        <input
                                            type="time"
                                            value={requestedCheckIn}
                                            onChange={e => setRequestedCheckIn(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Requested Check-Out</label>
                                        <input
                                            type="time"
                                            value={requestedCheckOut}
                                            onChange={e => setRequestedCheckOut(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Reason (Min 20 characters)</label>
                                <textarea
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    placeholder="Explain the reason for this regularization request..."
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 h-24"
                                    required
                                />
                                <span className="text-[9px] text-gray-400 font-bold block">
                                    Characters: {reason.length} / Min 20
                                </span>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={modalLoading || isLimitReached}
                                    className="px-4 py-2 text-white text-xs font-bold rounded-xl hover:shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ background: 'linear-gradient(to right, #f97316, #16a34a)' }}
                                >
                                    {modalLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    Submit Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
