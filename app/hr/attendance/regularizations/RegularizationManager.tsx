'use client';

import React, { useState } from 'react';
import { reviewRegularization, getRegularizationHistory } from '@/app/actions/attendance-actions';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Search, Calendar } from 'lucide-react';

interface RegularizationManagerProps {
    initialPending: any[];
    initialHistory: any[];
    reviewerId: string;
    organizationId: string;
}

export function RegularizationManager({
    initialPending,
    initialHistory,
    reviewerId,
    organizationId
}: RegularizationManagerProps) {
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [pendingList, setPendingList] = useState<any[]>(initialPending);
    const [historyList, setHistoryList] = useState<any[]>(initialHistory);

    // Rejection state
    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // Actions loading states
    const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Filters state
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [monthFilter, setMonthFilter] = useState('ALL');
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

    // Feedback message
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    const handleApprove = async (id: number) => {
        setActionLoadingId(id);
        try {
            const res = await reviewRegularization({
                regularizationId: id,
                action: 'APPROVE',
                reviewerId
            });

            if (res.success) {
                showToast('success', 'Regularization request approved successfully.');
                setPendingList(prev => prev.filter(item => item.id !== id));
                // Reload history list dynamically
                await refreshHistory();
            } else {
                showToast('error', res.error || 'Failed to approve request.');
            }
        } catch (e: any) {
            showToast('error', e.message || 'An error occurred.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRejectSubmit = async (id: number) => {
        if (!rejectionReason.trim()) {
            showToast('error', 'Rejection reason is required.');
            return;
        }
        setActionLoadingId(id);
        try {
            const res = await reviewRegularization({
                regularizationId: id,
                action: 'REJECT',
                reviewerId,
                rejectionReason
            });

            if (res.success) {
                showToast('success', 'Regularization request rejected.');
                setPendingList(prev => prev.filter(item => item.id !== id));
                setRejectingId(null);
                setRejectionReason('');
                await refreshHistory();
            } else {
                showToast('error', res.error || 'Failed to reject request.');
            }
        } catch (e: any) {
            showToast('error', e.message || 'An error occurred.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const refreshHistory = async (status = statusFilter, month = monthFilter, year = yearFilter) => {
        setHistoryLoading(true);
        try {
            const filterObj: any = { status };
            if (month !== 'ALL') {
                filterObj.month = parseInt(month, 10);
                filterObj.year = parseInt(year, 10);
            }
            const data = await getRegularizationHistory(organizationId, filterObj);
            setHistoryList(data);
        } catch (e) {
            console.error(e);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleFilterChange = async (type: 'status' | 'month' | 'year', value: string) => {
        let newStatus = statusFilter;
        let newMonth = monthFilter;
        let newYear = yearFilter;

        if (type === 'status') {
            setStatusFilter(value);
            newStatus = value;
        } else if (type === 'month') {
            setMonthFilter(value);
            newMonth = value;
        } else if (type === 'year') {
            setYearFilter(value);
            newYear = value;
        }

        await refreshHistory(newStatus, newMonth, newYear);
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

    const getRelativeTime = (submittedAtStr: string) => {
        const submittedAt = new Date(submittedAtStr);
        const diffMs = Date.now() - submittedAt.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    const months = [
        { value: '1', label: 'January' },
        { value: '2', label: 'February' },
        { value: '3', label: 'March' },
        { value: '4', label: 'April' },
        { value: '5', label: 'May' },
        { value: '6', label: 'June' },
        { value: '7', label: 'July' },
        { value: '8', label: 'August' },
        { value: '9', label: 'September' },
        { value: '10', label: 'October' },
        { value: '11', label: 'November' },
        { value: '12', label: 'December' },
    ];

    const currentYear = new Date().getFullYear();
    const years = [
        { value: String(currentYear - 1), label: String(currentYear - 1) },
        { value: String(currentYear), label: String(currentYear) },
        { value: String(currentYear + 1), label: String(currentYear + 1) },
    ];

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

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <div className="flex gap-6">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                            activeTab === 'pending'
                                ? 'border-orange-500 text-orange-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Pending Requests
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                            activeTab === 'history'
                                ? 'border-orange-500 text-orange-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        History Log
                    </button>
                </div>
            </div>

            {/* TAB CONTENT: PENDING */}
            {activeTab === 'pending' && (
                <div className="space-y-4">
                    {/* Amber Summary Card */}
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <span className="text-sm font-bold text-amber-800">
                            {pendingList.length} pending regularizations require review
                        </span>
                    </div>

                    {pendingList.length === 0 ? (
                        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
                            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                            <p className="text-gray-900 font-bold text-lg">All caught up!</p>
                            <p className="text-gray-400 text-xs mt-1">No pending regularization requests found.</p>
                        </div>
                    ) : (
                        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50/50">
                                            <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Employee</th>
                                            <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Request Details</th>
                                            <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Requested Hours</th>
                                            <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reason</th>
                                            <th className="text-right px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {pendingList.map((item) => {
                                            const isActionLoading = actionLoadingId === item.id;
                                            const isRejecting = rejectingId === item.id;
                                            return (
                                                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-5 py-4 whitespace-nowrap">
                                                        <p className="font-bold text-gray-900">{item.employee.name}</p>
                                                        <p className="text-[10px] text-gray-400">{item.employee.employee_code} • {item.employee.designation}</p>
                                                    </td>
                                                    <td className="px-5 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-gray-700">{formatDate(item.date)}</span>
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                                                                item.type === 'MISSED_PUNCH' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                                                                item.type === 'ON_DUTY' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                                'bg-purple-50 text-purple-600 border border-purple-100'
                                                            }`}>{item.type.replace('_', ' ')}</span>
                                                        </div>
                                                        <span className="text-[10px] text-gray-400 mt-1 block">Submitted {getRelativeTime(item.created_at)}</span>
                                                    </td>
                                                    <td className="px-5 py-4 whitespace-nowrap text-gray-600 font-medium">
                                                        {item.type === 'MISSED_PUNCH' ? (
                                                            <span>{formatTime(item.requested_check_in)} - {formatTime(item.requested_check_out)}</span>
                                                        ) : (
                                                            <span className="text-gray-400">Full Shift</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 max-w-xs text-gray-600 truncate" title={item.reason}>
                                                        {item.reason}
                                                    </td>
                                                    <td className="px-5 py-4 text-right whitespace-nowrap">
                                                        {isRejecting ? (
                                                            <div className="inline-flex flex-col gap-2 text-left bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                                                                <label className="text-[10px] font-bold text-gray-500">REJECTION REASON</label>
                                                                <textarea
                                                                    value={rejectionReason}
                                                                    onChange={e => setRejectionReason(e.target.value)}
                                                                    className="border border-gray-200 rounded-lg p-2 text-xs w-60 h-16 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                                    placeholder="Provide a reason for rejection..."
                                                                />
                                                                <div className="flex justify-end gap-1.5 mt-1">
                                                                    <button
                                                                        onClick={() => { setRejectingId(null); setRejectionReason(''); }}
                                                                        className="px-2.5 py-1 text-[10px] font-bold bg-white text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleRejectSubmit(item.id)}
                                                                        disabled={isActionLoading}
                                                                        className="px-2.5 py-1 text-[10px] font-bold bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-1"
                                                                    >
                                                                        {isActionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                                                        Confirm Reject
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="inline-flex items-center gap-2">
                                                                <button
                                                                    disabled={isActionLoading}
                                                                    onClick={() => handleApprove(item.id)}
                                                                    className="px-3.5 py-1.5 text-xs font-bold text-white rounded-lg transition-all flex items-center gap-1 hover:shadow-md"
                                                                    style={{ background: 'linear-gradient(to right, #f97316, #16a34a)' }}
                                                                >
                                                                    {isActionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                                                    Approve
                                                                </button>
                                                                <button
                                                                    disabled={isActionLoading}
                                                                    onClick={() => setRejectingId(item.id)}
                                                                    className="px-3.5 py-1.5 text-xs font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-all"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        )}
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
            )}

            {/* TAB CONTENT: HISTORY */}
            {activeTab === 'history' && (
                <div className="space-y-4">
                    {/* Filters Bar */}
                    <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-400 uppercase">Status:</span>
                                <select
                                    value={statusFilter}
                                    onChange={e => handleFilterChange('status', e.target.value)}
                                    className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                                >
                                    <option value="ALL">All Statuses</option>
                                    <option value="APPROVED">Approved</option>
                                    <option value="REJECTED">Rejected</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-400 uppercase">Month:</span>
                                <select
                                    value={monthFilter}
                                    onChange={e => handleFilterChange('month', e.target.value)}
                                    className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                                >
                                    <option value="ALL">All Months</option>
                                    {months.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>

                            {monthFilter !== 'ALL' && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-400 uppercase">Year:</span>
                                    <select
                                        value={yearFilter}
                                        onChange={e => handleFilterChange('year', e.target.value)}
                                        className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                                    >
                                        {years.map(y => (
                                            <option key={y.value} value={y.value}>{y.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {historyLoading && (
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" />
                                <span>Filtering...</span>
                            </div>
                        )}
                    </div>

                    {/* Table */}
                    <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/50">
                                        <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Employee</th>
                                        <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date & Type</th>
                                        <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Requested Hours</th>
                                        <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reason</th>
                                        <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                        <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {historyList.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                                                <Search className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                                                <p className="font-semibold text-sm">No regularization history found</p>
                                                <p className="text-xs">Adjust your status or date filters to expand search.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        historyList.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <p className="font-bold text-gray-900">{item.employee.name}</p>
                                                    <p className="text-[10px] text-gray-400">{item.employee.employee_code}</p>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-gray-700">{formatDate(item.date)}</span>
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                                                            item.type === 'MISSED_PUNCH' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                                                            item.type === 'ON_DUTY' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                            'bg-purple-50 text-purple-600 border border-purple-100'
                                                        }`}>{item.type.replace('_', ' ')}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-gray-600 font-medium">
                                                    {item.type === 'MISSED_PUNCH' ? (
                                                        <span>{formatTime(item.requested_check_in)} - {formatTime(item.requested_check_out)}</span>
                                                    ) : (
                                                        <span className="text-gray-400">Full Shift</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 max-w-xs text-gray-600 truncate" title={item.reason}>
                                                    {item.reason}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                                        item.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                        item.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                        'bg-yellow-100 text-yellow-700'
                                                    }`}>{item.status}</span>
                                                </td>
                                                <td className="px-5 py-4 text-gray-500 max-w-xs truncate">
                                                    {item.status === 'REJECTED' && item.rejection_reason && (
                                                        <span className="text-red-600" title={item.rejection_reason}>
                                                            Reason: {item.rejection_reason}
                                                        </span>
                                                    )}
                                                    {item.status === 'APPROVED' && (
                                                        <span>Approved by HR</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
