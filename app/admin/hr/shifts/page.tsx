'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Clock, Plus, Loader2, X, Trash2 } from 'lucide-react';
import { getShiftPatternsAdmin, createShiftPatternV2, updateShiftPattern } from '@/app/actions/shift-roster-actions';

export default function AdminShiftPatterns() {
    const [patterns, setPatterns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    
    const [form, setForm] = useState({
        name: '',
        startTime: '09:00',
        endTime: '17:00',
        shiftCategory: 'GENERAL',
        isOvernight: false,
        breakMinutes: 0,
        color: '#3B82F6',
        nightAllowance: 0,
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        const res = await getShiftPatternsAdmin();
        if (res.success) setPatterns(res.data);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSave = async () => {
        if (!form.name) return;
        setSaving(true);
        const res = await createShiftPatternV2(form);
        if (res.success) {
            setShowForm(false);
            setForm({ name: '', startTime: '09:00', endTime: '17:00', shiftCategory: 'GENERAL', isOvernight: false, breakMinutes: 0, color: '#3B82F6', nightAllowance: 0 });
            loadData();
        }
        setSaving(false);
    };

    const handleDelete = async (id: number) => {
        if(!confirm('Delete this pattern?')) return;
        // Basic soft delete for demo
        await updateShiftPattern(id, { isActive: false });
        loadData();
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Shift Patterns</h1>
                    <p className="text-sm text-gray-500 font-medium">Manage available shift timings and categories</p>
                </div>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md">
                    <Plus className="h-4 w-4" /> Add Pattern
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-gray-800">New Shift Pattern</h2>
                        <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Name</label>
                            <input type="text" className="w-full p-2 border rounded-xl" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Start Time</label>
                            <input type="time" className="w-full p-2 border rounded-xl" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">End Time</label>
                            <input type="time" className="w-full p-2 border rounded-xl" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Category</label>
                            <select className="w-full p-2 border rounded-xl bg-white" value={form.shiftCategory} onChange={e => setForm({...form, shiftCategory: e.target.value})}>
                                <option value="MORNING">Morning</option>
                                <option value="EVENING">Evening</option>
                                <option value="NIGHT">Night</option>
                                <option value="ROTATING">Rotating</option>
                                <option value="GENERAL">General</option>
                                <option value="ON_CALL">On Call</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Break (Mins)</label>
                            <input type="number" className="w-full p-2 border rounded-xl" value={form.breakMinutes} onChange={e => setForm({...form, breakMinutes: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Night Allowance ($)</label>
                            <input type="number" className="w-full p-2 border rounded-xl" value={form.nightAllowance} onChange={e => setForm({...form, nightAllowance: Number(e.target.value)})} />
                        </div>
                        <div className="flex items-center gap-2 mt-6">
                            <input type="checkbox" id="overnight" checked={form.isOvernight} onChange={e => setForm({...form, isOvernight: e.target.checked})} />
                            <label htmlFor="overnight" className="text-sm font-bold text-gray-700">Is Overnight?</label>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Color</label>
                            <input type="color" className="w-full p-1 h-10 border rounded-xl" value={form.color} onChange={e => setForm({...form, color: e.target.value})} />
                        </div>
                    </div>
                    <button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />} Save Pattern
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
                                <th className="p-4">Pattern Name</th>
                                <th className="p-4">Timings</th>
                                <th className="p-4">Category</th>
                                <th className="p-4">Break / Allowance</th>
                                <th className="p-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {patterns.map((p: any) => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-4 h-4 rounded-full shadow-inner" style={{ backgroundColor: p.color }}></div>
                                            <span className="font-bold text-gray-900">{p.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 font-medium text-gray-600">
                                        {p.start_time} - {p.end_time} {p.is_overnight && <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded-full">OVERNIGHT</span>}
                                    </td>
                                    <td className="p-4"><span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-[10px] font-bold rounded-full">{p.shift_category}</span></td>
                                    <td className="p-4 text-gray-500">{p.break_minutes}m break / ${p.night_allowance} allw.</td>
                                    <td className="p-4">
                                        <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {patterns.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">No patterns found</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
