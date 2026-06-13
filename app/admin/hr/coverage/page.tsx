'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, Plus, Loader2, X, Trash2 } from 'lucide-react';
import { getCoverageRules, createCoverageRule, getShiftPatternsAdmin } from '@/app/actions/shift-roster-actions';
import { getModuleConfig } from '@/app/actions/module-config-actions'; // Or we can just get departments from general API.

export default function AdminCoverageRules() {
    const [rules, setRules] = useState<any[]>([]);
    const [patterns, setPatterns] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([
        { id: 'dept_icu', name: 'Intensive Care Unit (ICU)' },
        { id: 'dept_er', name: 'Emergency Room (ER)' },
        { id: 'dept_opd', name: 'Outpatient Dept (OPD)' },
        { id: 'dept_ward', name: 'General Ward' },
    ]); // Mocked departments for now, since we don't have a direct fetch function imported
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    
    const [form, setForm] = useState({
        departmentId: 'dept_icu',
        shiftPatternId: 0,
        designation: '',
        minStaff: 1
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        const [rulesRes, patRes] = await Promise.all([
            getCoverageRules(),
            getShiftPatternsAdmin()
        ]);
        if (rulesRes.success) setRules(rulesRes.data);
        if (patRes.success) {
            setPatterns(patRes.data);
            if(patRes.data.length > 0) setForm(f => ({...f, shiftPatternId: patRes.data[0].id}));
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSave = async () => {
        if (!form.departmentId || !form.shiftPatternId) return;
        setSaving(true);
        const res = await createCoverageRule(form);
        if (res.success) {
            setShowForm(false);
            setForm({ departmentId: 'dept_icu', shiftPatternId: patterns[0]?.id || 0, designation: '', minStaff: 1 });
            loadData();
        }
        setSaving(false);
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Coverage Rules</h1>
                    <p className="text-sm text-gray-500 font-medium">Define minimum staffing requirements per department & shift</p>
                </div>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md">
                    <Plus className="h-4 w-4" /> Add Rule
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-gray-800">New Coverage Rule</h2>
                        <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Department</label>
                            <select className="w-full p-2 border rounded-xl bg-white" value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value})}>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Shift Pattern</label>
                            <select className="w-full p-2 border rounded-xl bg-white" value={form.shiftPatternId} onChange={e => setForm({...form, shiftPatternId: Number(e.target.value)})}>
                                {patterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Designation (Optional)</label>
                            <input type="text" className="w-full p-2 border rounded-xl" value={form.designation} onChange={e => setForm({...form, designation: e.target.value})} placeholder="e.g. Nurse" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Min Staff Required</label>
                            <input type="number" min={1} className="w-full p-2 border rounded-xl" value={form.minStaff} onChange={e => setForm({...form, minStaff: Number(e.target.value)})} />
                        </div>
                    </div>
                    <button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Save Rule
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
                                <th className="p-4">Department</th>
                                <th className="p-4">Shift Pattern</th>
                                <th className="p-4">Designation</th>
                                <th className="p-4">Min. Staff</th>
                                <th className="p-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rules.map((r: any) => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                    <td className="p-4 font-bold text-gray-900">{r.department_name}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.shift_pattern?.color }}></div>
                                            <span className="font-medium text-gray-700">{r.shift_pattern?.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-gray-500">{r.designation || <span className="italic">Any</span>}</td>
                                    <td className="p-4 font-black text-indigo-600">{r.min_staff}</td>
                                    <td className="p-4">
                                        <button className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {rules.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">No coverage rules defined</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
