'use client';

import React, { useState, useEffect } from 'react';
import { recordManualAttendance } from '@/app/actions/attendance-actions';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface ManualEntryFormProps {
    employees: any[];
    policy: any;
    organizationId: string;
    enteredBy: string;
}

export function ManualEntryForm({
    employees,
    policy,
    organizationId,
    enteredBy
}: ManualEntryFormProps) {
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [checkInTime, setCheckInTime] = useState('09:00');
    const [checkOutTime, setCheckOutTime] = useState('17:00');
    const [reason, setReason] = useState('');

    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 5000);
    };

    // Filter employees based on search
    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
        emp.employee_code.toLowerCase().includes(employeeSearch.toLowerCase())
    );

    // Compute status preview
    const [statusPreview, setStatusPreview] = useState('Present');
    const [workedHoursPreview, setWorkedHoursPreview] = useState(8.0);

    useEffect(() => {
        if (!checkOutTime) {
            setStatusPreview('Incomplete');
            setWorkedHoursPreview(0);
            return;
        }

        const [inH, inM] = checkInTime.split(':').map(Number);
        const [outH, outM] = checkOutTime.split(':').map(Number);

        let diffMs = (outH * 60 + outM) - (inH * 60 + inM);
        if (diffMs < 0) {
            // Assume next day for overnight shifts
            diffMs += 24 * 60;
        }

        const hours = diffMs / 60;
        setWorkedHoursPreview(Math.round(hours * 100) / 100);

        if (hours < policy.min_hours_half_day) {
            setStatusPreview('Absent');
        } else if (hours < policy.min_hours_full_day) {
            setStatusPreview('Half-Day');
        } else {
            setStatusPreview('Present');
        }
    }, [checkInTime, checkOutTime, policy]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedEmployeeId) {
            showToast('error', 'Please select an employee.');
            return;
        }

        if (reason.length < 10) {
            showToast('error', 'Reason must be at least 10 characters long.');
            return;
        }

        setLoading(true);
        try {
            // Combine date string with time strings to create full Date objects in local time zone
            const checkInDate = new Date(`${date}T${checkInTime}:00`);
            const checkOutDate = checkOutTime ? new Date(`${date}T${checkOutTime}:00`) : null;

            if (checkOutDate && checkOutDate < checkInDate) {
                // Shift ends on the next day
                checkOutDate.setDate(checkOutDate.getDate() + 1);
            }

            const res = await recordManualAttendance({
                employeeId: selectedEmployeeId,
                date: new Date(date),
                checkIn: checkInDate,
                checkOut: checkOutDate,
                reason,
                organizationId,
                enteredBy
            });

            if (res && res.error) {
                showToast('error', res.error);
            } else if (res && (res.id || res.success)) {
                showToast('success', `Attendance recorded as ${statusPreview}. Total: ${workedHoursPreview} hrs.`);
                // Reset form
                setEmployeeSearch('');
                setSelectedEmployeeId(null);
                setReason('');
            } else {
                showToast('error', 'Failed to submit manual attendance.');
            }
        } catch (error: any) {
            showToast('error', error.message || 'An error occurred while saving.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Toast Feedback */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border transition-all text-sm font-semibold ${
                    toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span>{toast.message}</span>
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Employee Search/Select */}
                    <div className="relative space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase">Select Employee</label>
                        <input
                            type="text"
                            value={employeeSearch}
                            onChange={(e) => {
                                setEmployeeSearch(e.target.value);
                                setSelectedEmployeeId(null);
                                setShowSuggestions(true);
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            placeholder="Type employee name or code..."
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            required
                        />
                        {showSuggestions && employeeSearch && !selectedEmployeeId && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 shadow-lg rounded-xl z-20 max-h-60 overflow-y-auto divide-y divide-gray-50">
                                {filteredEmployees.length === 0 ? (
                                    <div className="p-3 text-xs text-gray-400 text-center">No active employees found</div>
                                ) : (
                                    filteredEmployees.map(emp => (
                                        <button
                                            key={emp.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedEmployeeId(emp.id);
                                                setEmployeeSearch(`${emp.name} (${emp.employee_code})`);
                                                setShowSuggestions(false);
                                            }}
                                            className="w-full text-left p-3 hover:bg-gray-50 flex flex-col transition-colors"
                                        >
                                            <span className="font-bold text-xs text-gray-900">{emp.name}</span>
                                            <span className="text-[10px] text-gray-400">{emp.employee_code} • {emp.designation}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Date Picker */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
                        <input
                            type="date"
                            value={date}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            required
                        />
                    </div>

                    {/* Check-In and Check-Out Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase">Check-In Time</label>
                            <input
                                type="time"
                                value={checkInTime}
                                onChange={(e) => setCheckInTime(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase">Check-Out Time (Optional)</label>
                            <input
                                type="time"
                                value={checkOutTime}
                                onChange={(e) => setCheckOutTime(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            />
                        </div>
                    </div>

                    {/* Reason Textarea */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase">Reason for Manual Entry</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Enter the justification/reason for this manual record (min 10 characters)..."
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 h-24"
                            required
                        />
                        <span className="text-[10px] text-gray-400 font-medium block">
                            Min 10 characters. Current length: {reason.length}
                        </span>
                    </div>

                    {/* Status Preview Card */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Status Preview</p>
                            <p className="text-sm font-semibold text-gray-600 mt-0.5">
                                Computed worked hours: <span className="font-bold text-gray-900">{workedHoursPreview} hrs</span>
                            </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-black ${
                            statusPreview === 'Present' ? 'bg-green-100 text-green-700' :
                            statusPreview === 'Half-Day' ? 'bg-yellow-100 text-yellow-700' :
                            statusPreview === 'Absent' ? 'bg-red-100 text-red-700' :
                            'bg-orange-100 text-orange-700'
                        }`}>
                            {statusPreview}
                        </span>
                    </div>

                    {/* Info Note about audit trail */}
                    <p className="text-[10px] text-gray-400 italic">
                        * Note: This manual entry is flagged as MANUAL — it will appear in the employee's attendance history and is logged to the system audit trails.
                    </p>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 text-white font-bold text-sm rounded-xl transition-all hover:shadow-lg hover:shadow-orange-500/10 flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(to right, #f97316, #16a34a)' }}
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        Record Manual Attendance
                    </button>
                </form>
            </div>
        </div>
    );
}
