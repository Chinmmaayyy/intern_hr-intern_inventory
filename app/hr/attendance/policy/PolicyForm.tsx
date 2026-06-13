'use client';

import React, { useState } from 'react';
import { updateAttendancePolicy } from '@/app/actions/attendance-actions';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface PolicyFormProps {
    initialPolicy: any;
    organizationId: string;
}

export function PolicyForm({
    initialPolicy,
    organizationId
}: PolicyFormProps) {
    const [policy, setPolicy] = useState(initialPolicy);
    const [graceMinutes, setGraceMinutes] = useState<number>(policy?.grace_minutes ?? 10);
    const [lateMarks, setLateMarks] = useState<number>(policy?.late_marks_for_half_day ?? 3);
    const [minFullDay, setMinFullDay] = useState<number>(policy?.min_hours_full_day ?? 8.0);
    const [minHalfDay, setMinHalfDay] = useState<number>(policy?.min_hours_half_day ?? 4.0);
    const [maxRegularizations, setMaxRegularizations] = useState<number>(policy?.max_regularizations_month ?? 3);
    const [sandwichRule, setSandwichRule] = useState<boolean>(policy?.sandwich_rule_enabled ?? false);

    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const dataToSave = {
                grace_minutes: graceMinutes,
                late_marks_for_half_day: lateMarks,
                min_hours_full_day: parseFloat(String(minFullDay)),
                min_hours_half_day: parseFloat(String(minHalfDay)),
                sandwich_rule_enabled: sandwichRule,
                max_regularizations_month: maxRegularizations
            };

            const updated = await updateAttendancePolicy(organizationId, dataToSave);
            setPolicy(updated);
            showToast('success', 'Attendance policy updated successfully.');
        } catch (error: any) {
            showToast('error', error.message || 'Failed to update policy.');
        } finally {
            setLoading(false);
        }
    };

    const formatTimestamp = (dateStr: string | undefined) => {
        if (!dateStr) return 'Never';
        const d = new Date(dateStr);
        return d.toLocaleString();
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
                <form onSubmit={handleSave} className="space-y-6">
                    {/* Grace period */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase">Late grace period (minutes)</label>
                        <input
                            type="number"
                            value={graceMinutes}
                            onChange={e => setGraceMinutes(parseInt(e.target.value, 10))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            min="0"
                            required
                        />
                        <span className="text-[10px] text-gray-400 block font-medium">
                            Minutes after shift start time before an employee is marked late.
                        </span>
                    </div>

                    {/* Late Marks threshold */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase">Late marks before half-day LOP</label>
                        <input
                            type="number"
                            value={lateMarks}
                            onChange={e => setLateMarks(parseInt(e.target.value, 10))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            min="1"
                            required
                        />
                        <span className="text-[10px] text-gray-400 block font-medium">
                            Every X late marks in a month automatically deducts 0.5 days of salary/attendance.
                        </span>
                    </div>

                    {/* Minimum Hours Full and Half Day */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase">Minimum hours for full day</label>
                            <input
                                type="number"
                                step="0.5"
                                value={minFullDay}
                                onChange={e => setMinFullDay(parseFloat(e.target.value))}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                min="0"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase">Minimum hours for half day</label>
                            <input
                                type="number"
                                step="0.5"
                                value={minHalfDay}
                                onChange={e => setMinHalfDay(parseFloat(e.target.value))}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                min="0"
                                required
                            />
                        </div>
                    </div>

                    {/* Max regularizations limit */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase">Max regularizations per employee per month</label>
                        <input
                            type="number"
                            value={maxRegularizations}
                            onChange={e => setMaxRegularizations(parseInt(e.target.value, 10))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            min="0"
                            required
                        />
                    </div>

                    {/* Sandwich rule */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div>
                            <label className="text-xs font-bold text-gray-700 block uppercase">Enable sandwich rule for leaves</label>
                            <span className="text-[10px] text-gray-400 block font-medium mt-0.5">
                                If active, public holidays/weekends sandwiched between leaves are also counted as leave.
                            </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={sandwichRule}
                                onChange={e => setSandwichRule(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                    </div>

                    {/* Policy metadata */}
                    <div className="text-[10px] text-gray-400 pt-2 flex items-center justify-between border-t border-gray-50">
                        <span>Organization Scope: ID Scoped</span>
                        <span>Last Updated: {formatTimestamp(policy?.updated_at)}</span>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 text-white font-bold text-sm rounded-xl transition-all hover:shadow-lg hover:shadow-orange-500/10 flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(to right, #f97316, #16a34a)' }}
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        Save Policy
                    </button>
                </form>
            </div>
        </div>
    );
}
