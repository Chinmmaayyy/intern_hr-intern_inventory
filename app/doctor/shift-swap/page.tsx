'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, Clock, User, AlertCircle, Loader2 } from 'lucide-react';
import { 
    getEligibleSwapTargets, 
    requestShiftSwapGeneric,
    getMySwapRequests
} from '@/app/actions/shift-roster-actions';

export default function DoctorShiftSwap() {
    const [sessionResolved, setSessionResolved] = useState(false);
    const [session, setSession] = useState<any>(null);

    const [eligibleTargets, setEligibleTargets] = useState<any[]>([]);
    
    // My Form State
    const [giveDate, setGiveDate] = useState('');
    const [givePattern, setGivePattern] = useState('Day Shift');
    
    // Target Form State
    const [selectedTarget, setSelectedTarget] = useState('');
    const [takeDate, setTakeDate] = useState('');
    const [takePattern, setTakePattern] = useState('Day Shift');
    
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    const [swapRequests, setSwapRequests] = useState<any[]>([]);

    useEffect(() => {
        async function fetchSession() {
            try {
                const res = await fetch('/api/session');
                if (res.ok) {
                    const data = await res.json();
                    setSession(data);
                }
            } catch (e) {
                console.error('Failed to fetch session', e);
            } finally {
                setSessionResolved(true);
            }
        }
        fetchSession();
    }, []);

    const loadData = async () => {
        if (!session?.id) return;
        setLoading(true);
        try {
            const [targetsRes, requestsRes] = await Promise.all([
                getEligibleSwapTargets(),
                getMySwapRequests(session.id)
            ]);
            
            if (targetsRes.success) {
                setEligibleTargets(targetsRes.data); 
            }
            if (requestsRes.success) setSwapRequests(requestsRes.data);
            
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (sessionResolved) {
            loadData();
        }
    }, [sessionResolved, session]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!giveDate || !givePattern || !selectedTarget || !takeDate || !takePattern) {
            alert('Please fill out all fields');
            return;
        }

        setSubmitting(true);
        try {
            const res = await requestShiftSwapGeneric(
                session.id, 
                Number(selectedTarget), 
                giveDate, 
                givePattern, 
                takeDate, 
                takePattern
            );
            if (res.success) {
                alert('Shift swap requested successfully!');
                setGiveDate('');
                setSelectedTarget('');
                setTakeDate('');
                loadData(); // Refresh the list
            } else {
                alert('Error requesting swap: ' + (res.error || 'Unknown error'));
            }
        } catch (error) {
            console.error(error);
            alert('An unexpected error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    if (!sessionResolved || loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    const inputCls = "w-full p-3.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/30 outline-none font-medium text-gray-900";
    const labelCls = "text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 block mb-2 mt-4";

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8">
            <div>
                <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                    <ArrowLeftRight className="h-8 w-8 text-orange-500" />
                    Shift Swap Request
                </h1>
                <p className="text-gray-500 font-medium mt-2">
                    Request to swap one of your shifts with another colleague.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* FORM */}
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Clock className="h-5 w-5 text-gray-400" />
                        New Request
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="p-4 rounded-xl border border-orange-100 bg-orange-50/50">
                            <h3 className="text-sm font-bold text-orange-900 mb-2">My Shift to Give</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-orange-700/70 uppercase tracking-widest block mb-1">Date</label>
                                    <input type="date" required className={inputCls} value={giveDate} onChange={e => setGiveDate(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-orange-700/70 uppercase tracking-widest block mb-1">Shift</label>
                                    <select required className={inputCls} value={givePattern} onChange={e => setGivePattern(e.target.value)}>
                                        <option>Day Shift</option>
                                        <option>Night Shift</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-center py-1">
                            <div className="bg-gray-50 p-2 rounded-full border border-gray-100">
                                <ArrowLeftRight className="h-4 w-4 text-gray-400" />
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50">
                            <h3 className="text-sm font-bold text-indigo-900 mb-2">Colleague's Shift to Take</h3>
                            <label className="text-[10px] font-black text-indigo-700/70 uppercase tracking-widest block mb-1">Select Colleague</label>
                            <select required className={inputCls} value={selectedTarget} onChange={(e) => setSelectedTarget(e.target.value)}>
                                <option value="">-- Select Colleague --</option>
                                {eligibleTargets.map((emp) => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.name} ({emp.designation})
                                    </option>
                                ))}
                            </select>

                            <div className="grid grid-cols-2 gap-3 mt-4">
                                <div>
                                    <label className="text-[10px] font-black text-indigo-700/70 uppercase tracking-widest block mb-1">Date</label>
                                    <input type="date" required className={inputCls} value={takeDate} onChange={e => setTakeDate(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-indigo-700/70 uppercase tracking-widest block mb-1">Shift</label>
                                    <select required className={inputCls} value={takePattern} onChange={e => setTakePattern(e.target.value)}>
                                        <option>Day Shift</option>
                                        <option>Night Shift</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={submitting || !giveDate || !selectedTarget || !takeDate}
                            className="w-full mt-6 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-black py-4 rounded-xl shadow-lg shadow-orange-500/30 transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'SUBMIT REQUEST'}
                        </button>
                    </form>
                </div>

                {/* MY REQUESTS */}
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <User className="h-5 w-5 text-gray-400" />
                        My Swaps History
                    </h2>
                    
                    <div className="flex-1 overflow-y-auto space-y-4">
                        {swapRequests.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="mx-auto w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                    <AlertCircle className="h-6 w-6 text-gray-300" />
                                </div>
                                <p className="text-gray-500 font-medium">No swap requests yet.</p>
                            </div>
                        ) : (
                            swapRequests.map((req) => {
                                const statusColor = 
                                    req.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                                    req.status === 'ADMIN_APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                                    req.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                                    'bg-gray-100 text-gray-700';

                                return (
                                    <div key={req.id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-white transition-colors group">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className={`px-2.5 py-1 text-[10px] font-black rounded-full uppercase tracking-wider ${statusColor}`}>
                                                {req.status === 'REJECTED' ? 'DENIED' : req.status}
                                            </span>
                                            <span className="text-xs text-gray-400 font-medium">
                                                {new Date(req.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-gray-500">Giving:</span>
                                                <span className="font-bold text-gray-900 text-right">
                                                    {new Date(req.requesterAssignment?.date).toLocaleDateString()} ({req.requesterAssignment?.shift_pattern?.name})
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-gray-500">Taking:</span>
                                                <span className="font-bold text-gray-900 text-right">
                                                    {new Date(req.targetAssignment?.date).toLocaleDateString()} ({req.targetAssignment?.shift_pattern?.name})
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-gray-500">With:</span>
                                                <span className="font-bold text-gray-900">
                                                    {req.targetAssignment?.employee?.name}
                                                </span>
                                            </div>
                                        </div>
                                        {req.status === 'REJECTED' && (
                                            <div className="mt-4 p-3 bg-red-50 text-red-800 text-xs rounded-xl border border-red-100">
                                                <strong>Notice:</strong> Your request has been denied. 
                                                {req.admin_notes && <span className="ml-1">Reason: {req.admin_notes}</span>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
