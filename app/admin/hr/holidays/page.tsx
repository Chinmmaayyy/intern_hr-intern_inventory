'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Plus, Loader2, X, Trash2 } from 'lucide-react';
import { getHolidaysAdmin, createHoliday } from '@/app/actions/shift-roster-actions';

export default function AdminHolidays() {
    const [holidays, setHolidays] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    
    const [form, setForm] = useState({
        name: '',
        date: '',
        type: 'NATIONAL',
        isOptional: false
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        const res = await getHolidaysAdmin();
        if (res.success) setHolidays(res.data);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSave = async () => {
        if (!form.name || !form.date) return;
        setSaving(true);
        const res = await createHoliday(form);
        if (res.success) {
            setShowForm(false);
            setForm({ name: '', date: '', type: 'NATIONAL', isOptional: false });
            loadData();
        }
        setSaving(false);
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Holiday Calendar</h1>
                    <p className="text-sm text-gray-500 font-medium">Manage hospital holidays and off-days</p>
                </div>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md">
                    <Plus className="h-4 w-4" /> Add Holiday
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-gray-800">New Holiday</h2>
                        <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Name</label>
                            <input type="text" className="w-full p-2 border rounded-xl" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Christmas" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Date</label>
                            <input type="date" className="w-full p-2 border rounded-xl" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Type</label>
                            <select className="w-full p-2 border rounded-xl bg-white" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                                <option value="NATIONAL">National</option>
                                <option value="FESTIVAL">Festival</option>
                                <option value="RESTRICTED">Restricted</option>
                            </select>
                        </div>
                        <div className="md:col-span-4 flex items-center gap-2 mt-2">
                            <input type="checkbox" id="optional" checked={form.isOptional} onChange={e => setForm({...form, isOptional: e.target.checked})} />
                            <label htmlFor="optional" className="text-sm font-bold text-gray-700">Is this an optional holiday?</label>
                        </div>
                    </div>
                    <button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />} Save Holiday
                    </button>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                            <tr>
                                <th className="p-4">Date</th>
                                <th className="p-4">Holiday Name</th>
                                <th className="p-4">Type</th>
                                <th className="p-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {holidays.map((h: any) => (
                                <tr key={h.id} className="hover:bg-gray-50">
                                    <td className="p-4 font-medium text-gray-900">{new Date(h.date).toDateString()}</td>
                                    <td className="p-4 font-bold text-gray-700">
                                        {h.name} {h.is_optional && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">OPTIONAL</span>}
                                    </td>
                                    <td className="p-4"><span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-[10px] font-bold rounded-full">{h.type}</span></td>
                                    <td className="p-4">
                                        <button className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {holidays.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-400">No holidays defined</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
