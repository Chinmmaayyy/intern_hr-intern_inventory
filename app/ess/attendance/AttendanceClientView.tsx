'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPunchHistory, submitRegularization } from '@/app/actions/attendance-actions';
import { ChevronLeft, ChevronRight, Clock, UserCheck, AlertCircle, FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface AttendanceClientViewProps {
    attendance: any[];
    regularizations: any[];
    employee: any;
    policy: any;
    month: number;
    year: number;
    organizationId: string;
    initialRegularizeDate?: string;
}

export function AttendanceClientView({
    attendance,
    regularizations,
    employee,
    policy,
    month,
    year,
    organizationId,
    initialRegularizeDate
}: AttendanceClientViewProps) {
    const router = useRouter();

    // Row expansion state
    const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
    const [punches, setPunches] = useState<Record<number, any[]>>({});
    const [loadingPunches, setLoadingPunches] = useState<Record<number, boolean>>({});

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

    useEffect(() => {
        if (initialRegularizeDate) {
            setModalDate(initialRegularizeDate);
            setShowModal(true);
        }
    }, [initialRegularizeDate]);

    // Navigation handlers
    const handlePrevMonth = () => {
        let m = month - 1;
        let y = year;
        if (m === 0) {
            m = 12;
            y -= 1;
        }
        router.push(`/ess/attendance?month=${m}&year=${y}`);
    };

    const handleNextMonth = () => {
        let m = month + 1;
        let y = year;
        if (m === 13) {
            m = 1;
            y += 1;
        }
        router.push(`/ess/attendance?month=${m}&year=${y}`);
    };

    // Lazy load punches
    const handleToggleExpand = async (item: any) => {
        const id = item.id;
        if (expandedRowId === id) {
            setExpandedRowId(null);
            return;
        }
        setExpandedRowId(id);
        if (!punches[id]) {
            setLoadingPunches(prev => ({ ...prev, [id]: true }));
            try {
                const res = await getPunchHistory(item.employee_id, item.date);
                setPunches(prev => ({ ...prev, [id]: res }));
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingPunches(prev => ({ ...prev, [id]: false }));
            }
        }
    };

    const handleOpenRegularizeModal = (dateStr: string) => {
        const d = new Date(dateStr);
        setModalDate(d.toISOString().split('T')[0]);
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
                showToast('success', 'Request submitted. HR will review within 1 working day.');
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

    // Stats calculations
    const presentCount = attendance.filter(a => a.status === 'Present').length;
    const absentCount = attendance.filter(a => a.status === 'Absent').length;
    const halfDayCount = attendance.filter(a => a.status === 'Half-Day').length;
    const lateMarksCount = attendance.filter(a => a.late_minutes && a.late_minutes > 0).length;

    // Helper formatter
    const getMonthName = (m: number) => {
        const d = new Date(Date.UTC(2020, m - 1, 1));
        return d.toLocaleDateString(undefined, { month: 'long', timeZone: 'UTC' });
    };

    const getWeekday = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
    };

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return '--:--';
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'Present': return 'bg-green-100 text-green-700';
            case 'Absent': return 'bg-red-100 text-red-700';
            case 'Half-Day': return 'bg-yellow-100 text-yellow-700';
            case 'Incomplete': return 'bg-orange-100 text-orange-700';
            case 'Leave': return 'bg-blue-100 text-blue-700';
            case 'Holiday': return 'bg-gray-100 text-gray-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const getSourceBadgeClass = (source: string) => {
        switch (source) {
            case 'BIOMETRIC': return 'bg-green-50 text-green-700 border border-green-100';
            case 'MOBILE': return 'bg-blue-50 text-blue-700 border border-blue-100';
            case 'MANUAL': return 'bg-orange-50 text-orange-700 border border-orange-100';
            case 'SYSTEM': return 'bg-gray-50 text-gray-700 border border-gray-100';
            default: return 'bg-slate-50 text-slate-700 border border-slate-100';
        }
    };

    // Lookup regularization status for a specific date
    const getRegularizationStatus = (dateStr: string) => {
        const d = new Date(dateStr).toISOString().split('T')[0];
        const req = regularizations.find(r => new Date(r.date).toISOString().split('T')[0] === d);
        return req ? req.status : null;
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

            {/* Month Navigator Header */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex items-center justify-between">
                <button
                    onClick={handlePrevMonth}
                    className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600 hover:text-gray-900"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-base font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    {getMonthName(month)} {year}
                </h2>
                <button
                    onClick={handleNextMonth}
                    className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600 hover:text-gray-900"
                >
                    <ChevronRight className="h-5 w-5" />
                </button>
            </div>

            {/* Monthly mini-stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Present</span>
                        <p className="text-xl font-black text-green-600 mt-0.5">{presentCount}</p>
                    </div>
                    <div className="p-2 bg-green-50 text-green-600 rounded-xl">
                        <UserCheck className="h-4 w-4" />
                    </div>
                </div>

                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Absent</span>
                        <p className="text-xl font-black text-red-600 mt-0.5">{absentCount}</p>
                    </div>
                    <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                        <AlertCircle className="h-4 w-4" />
                    </div>
                </div>

                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Half-Day</span>
                        <p className="text-xl font-black text-yellow-600 mt-0.5">{halfDayCount}</p>
                    </div>
                    <div className="p-2 bg-yellow-50 text-yellow-600 rounded-xl">
                        <FileText className="h-4 w-4" />
                    </div>
                </div>

                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Late Marks</span>
                        <p className="text-xl font-black text-orange-600 mt-0.5">{lateMarksCount}</p>
                    </div>
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                        <Clock className="h-4 w-4" />
                    </div>
                </div>
            </div>

            {/* Attendance Table */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Day</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Check In</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Check Out</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hours</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Late</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">OT</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Source</th>
                                <th className="text-right px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {attendance.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                                        No attendance entries logged for this month.
                                    </td>
                                </tr>
                            ) : (
                                attendance.map((item) => {
                                    const isExpanded = expandedRowId === item.id;
                                    const isLoadingPunches = loadingPunches[item.id];
                                    const dateString = new Date(item.date).toISOString().split('T')[0];
                                    const regStatus = getRegularizationStatus(item.date);

                                    return (
                                        <React.Fragment key={item.id}>
                                            <tr className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap font-bold text-gray-800">
                                                    {new Date(item.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', timeZone: 'UTC' })}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-500">
                                                    {getWeekday(item.date)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide ${getStatusBadgeClass(item.status)}`}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center text-gray-600 font-medium">
                                                    {formatTime(item.check_in)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center text-gray-600 font-medium">
                                                    {formatTime(item.check_out)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center text-gray-900 font-bold">
                                                    {item.total_hours ? `${item.total_hours}h` : '-'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center font-medium text-red-600">
                                                    {item.late_minutes ? `${item.late_minutes}m` : '-'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center font-medium text-green-600">
                                                    {item.overtime_minutes ? `${item.overtime_minutes}m` : '-'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                                    <span className={`px-2 py-0.5 rounded-[5px] text-[9px] font-black ${getSourceBadgeClass(item.source)}`}>
                                                        {item.source}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <button
                                                            onClick={() => handleToggleExpand(item)}
                                                            className="text-[10px] text-orange-500 hover:text-orange-700 font-bold hover:underline"
                                                        >
                                                            {isExpanded ? 'Hide Punches' : 'View Punches'}
                                                        </button>
                                                        
                                                        <div className="w-24 text-right">
                                                            {regStatus === 'PENDING' ? (
                                                                <span className="text-[10px] text-gray-400 font-bold">Pending ⏳</span>
                                                            ) : regStatus === 'APPROVED' ? (
                                                                <span className="text-[10px] text-green-600 font-bold">Regularized ✓</span>
                                                            ) : regStatus === 'REJECTED' ? (
                                                                <span className="text-[10px] text-red-600 font-bold">Rejected ❌</span>
                                                            ) : (item.status === 'Incomplete' || item.status === 'Absent') ? (
                                                                <button
                                                                    onClick={() => handleOpenRegularizeModal(item.date)}
                                                                    className="px-2.5 py-1 text-[9px] font-black text-white rounded-lg bg-orange-500 hover:bg-orange-600 transition-colors"
                                                                >
                                                                    Regularize
                                                                </button>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-300">-</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expandable sub-row showing raw punches */}
                                            {isExpanded && (
                                                <tr className="bg-slate-50/60">
                                                    <td colSpan={10} className="px-6 py-3 border-l-2 border-orange-500">
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Raw Device Punch Logs</p>
                                                            {isLoadingPunches ? (
                                                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                                    <Loader2 className="h-3 w-3 animate-spin text-orange-500" />
                                                                    <span>Loading punch logs...</span>
                                                                </div>
                                                            ) : !punches[item.id] || punches[item.id].length === 0 ? (
                                                                <p className="text-xs text-gray-400">No raw punches recorded on the logs for this day.</p>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-2 pt-1">
                                                                    {punches[item.id].map((p: any, idx: number) => (
                                                                        <div key={p.id} className="bg-white border border-gray-200 shadow-sm rounded-lg px-2.5 py-1 flex items-center gap-2 text-xs">
                                                                            <span className="text-gray-400 font-bold">#{idx + 1}</span>
                                                                            <span className="font-bold text-gray-700">{formatTime(p.punch_time)}</span>
                                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                                                                p.source === 'BIOMETRIC' ? 'bg-green-50 text-green-700' :
                                                                                p.source === 'MOBILE' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
                                                                            }`}>{p.source}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Regularization Submit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-gray-100 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wide">Submit Regularization</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-sm">✕</button>
                        </div>
                        <form onSubmit={handleModalSubmit} className="p-6 space-y-4">
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
                                    disabled={modalLoading}
                                    className="px-4 py-2 text-white text-xs font-bold rounded-xl hover:shadow-md transition-all flex items-center gap-1.5"
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
