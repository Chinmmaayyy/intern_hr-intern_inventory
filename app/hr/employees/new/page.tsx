'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/app/components/layout/AppShell';
import { UserPlus, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createEmployee } from '@/app/actions/hr-actions';

const sanitizeName = (value: string) => value.replace(/[^a-zA-Z\s.'-]/g, '');
const sanitizePhone = (value: string) => value.replace(/\D/g, '').slice(0, 10);
const sanitizeMoney = (value: string) => value.replace(/[^\d.]/g, '');

export default function NewEmployeePage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        name: '', designation: '', departmentId: '',
        dateOfJoining: new Date().toISOString().split('T')[0],
        salaryBasic: '', phone: '', email: '', employmentType: '', branchId: '', gradeBand: '', workLocation: '', bloodGroup: '', emergencyContact: '', panNumber: '', aadhaarMasked: '', uanNumber: '', pfNumber: '', esicNumber: '', paymentMode: '', reportingManagerId: '', dateOfConfirmation: '', dateOfExit: '', exitReason: '', bankAccount: '', bankIfsc: '', bankName: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.designation.trim() || !form.dateOfJoining) {
            setError('Name, Designation, and Date of Joining are required.');
            return;
        }
        if (!form.aadhaarMasked.trim() || !/^\d{12}$/.test(form.aadhaarMasked.replace(/\s/g, ''))) {
            setError('Aadhaar number is required and must be exactly 12 digits.');
            return;
        }
        setError('');
        setSaving(true);
        try {
            const res = await createEmployee({
                name: form.name.trim(),
                designation: form.designation.trim(),
                departmentId: form.departmentId || undefined,
                dateOfJoining: form.dateOfJoining,
                salaryBasic: form.salaryBasic ? parseFloat(form.salaryBasic) : undefined,
                phone: form.phone || undefined,
                email: form.email || undefined,

                //Employee Master Upgrade
                employmentType: form.employmentType || undefined,
                branchId: form.branchId || undefined,
                gradeBand: form.gradeBand || undefined,
                workLocation: form.workLocation || undefined,
                bloodGroup: form.bloodGroup || undefined,
                emergencyContact: form.emergencyContact || undefined,

                panNumber: form.panNumber || undefined,
                aadhaarMasked: form.aadhaarMasked,
                uanNumber: form.uanNumber || undefined,
                pfNumber: form.pfNumber || undefined,
                esicNumber: form.esicNumber || undefined,

                paymentMode: form.paymentMode || undefined,

                reportingManagerId: form.reportingManagerId
                    ? parseInt(form.reportingManagerId)
                    : undefined,

                dateOfConfirmation:
                    form.dateOfConfirmation || undefined,

                dateOfExit:
                    form.dateOfExit || undefined,

                exitReason:
                    form.exitReason || undefined,

                bankAccount:
                    form.bankAccount || undefined,

                bankIfsc:
                    form.bankIfsc || undefined,

                bankName:
                    form.bankName || undefined,
            });
            if (res.success) {
                router.push('/hr/employees');
            } else {
                setError(res.error || 'Failed to create employee');
            }
        } catch (e) {
            setError('An unexpected error occurred');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AppShell pageTitle="Add New Employee" pageIcon={<UserPlus className="h-5 w-5" />}
            headerActions={
                <Link href="/hr/employees" className="flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-gray-700">
                    <ArrowLeft className="h-4 w-4" /> Back
                </Link>
            }>
            <div className="max-w-2xl mx-auto">
                <form onSubmit={handleSubmit} className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-5">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-xl">{error}</div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Name *</label>
                            <input type="text" required value={form.name}
                                onChange={e => setForm({ ...form, name: sanitizeName(e.target.value) })}
                                maxLength={60}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                placeholder="Full name" />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Designation *</label>
                            <input type="text" required value={form.designation}
                                onChange={e => setForm({ ...form, designation: sanitizeName(e.target.value) })}
                                maxLength={50}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                placeholder="e.g. Nurse, Technician" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Department ID</label>
                            <input type="text" value={form.departmentId}
                                onChange={e => setForm({ ...form, departmentId: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                placeholder="Optional" />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Date of Joining *</label>
                            <input type="date" required value={form.dateOfJoining}
                                onChange={e => setForm({ ...form, dateOfJoining: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        <div>
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Basic Salary</label>
                            <input type="number" value={form.salaryBasic}
                                onChange={e => setForm({ ...form, salaryBasic: sanitizeMoney(e.target.value) })}
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                placeholder="0" />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Phone</label>
                            <input type="tel" value={form.phone}
                                onChange={e => setForm({ ...form, phone: sanitizePhone(e.target.value) })}
                                inputMode="numeric"
                                pattern="[0-9]{10}"
                                maxLength={10}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                placeholder="Optional" />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Email</label>
                            <input type="email" value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                placeholder="Optional" />
                        </div>
                    </div>

                    {/* Employee Master Upgrade */}
                    <div className="border-t pt-5">
                        <h3 className="text-lg font-semibold text-gray-700 mb-4">
                            Employment Information
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                                    Employment Type
                                </label>

                                <select
                                    value={form.employmentType}
                                    onChange={(e) =>
                                        setForm({ ...form, employmentType: e.target.value })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                                >
                                    <option value="">Select</option>
                                    <option value="PERMANENT">Permanent</option>
                                    <option value="CONTRACT">Contract</option>
                                    <option value="CONSULTANT_VISITING">Consultant Visiting</option>
                                    <option value="CONSULTANT_RETAINER">Consultant Retainer</option>
                                    <option value="INTERN_TRAINEE">Intern / Trainee</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                                    Work Location
                                </label>

                                <input
                                    type="text"
                                    value={form.workLocation}
                                    onChange={(e) =>
                                        setForm({ ...form, workLocation: e.target.value })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                                    placeholder="Mumbai Branch"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                                    Blood Group
                                </label>

                                <input
                                    type="text"
                                    value={form.bloodGroup}
                                    onChange={(e) =>
                                        setForm({ ...form, bloodGroup: e.target.value })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                                    placeholder="O+"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                                    Emergency Contact
                                </label>

                                <input
                                    type="tel"
                                    value={form.emergencyContact}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            emergencyContact: sanitizePhone(e.target.value)
                                        })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                                    placeholder="9876543210"
                                />
                            </div>

                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
                        <div>
                            <label>Branch ID</label>
                            <input
                                value={form.branchId}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        branchId: e.target.value,
                                    })
                                }
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl"
                            />
                        </div>

                        <div>
                            <label>Grade Band</label>
                            <input
                                value={form.gradeBand}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        gradeBand: e.target.value,
                                    })
                                }
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl"
                            />
                        </div>

                        <div>
                            <label>Reporting Manager ID</label>
                            <input
                                value={form.reportingManagerId}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        reportingManagerId: e.target.value,
                                    })
                                }
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl"
                            />
                        </div>

                        <div>
                            <label>Date Of Confirmation</label>
                            <input
                                type="date"
                                value={form.dateOfConfirmation}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        dateOfConfirmation: e.target.value,
                                    })
                                }
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl"
                            />
                        </div>

                        <div>
                            <label>Date Of Exit</label>
                            <input
                                type="date"
                                value={form.dateOfExit}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        dateOfExit: e.target.value,
                                    })
                                }
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl"
                            />
                        </div>

                        <div>
                            <label>Exit Reason</label>
                            <input
                                value={form.exitReason}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        exitReason: e.target.value,
                                    })
                                }
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl"
                            />
                        </div>

                    </div>
                    <div className="border-t pt-5 mt-5">
                        <h3 className="text-lg font-semibold text-gray-700 mb-4">
                            Statutory Information
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                                    PAN Number
                                </label>

                                <input
                                    type="text"
                                    value={form.panNumber}
                                    onChange={(e) =>
                                        setForm({ ...form, panNumber: e.target.value.toUpperCase() })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                                    placeholder="ABCDE1234F"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                                    Aadhaar *
                                </label>

                                <input
                                    type="text"
                                    required
                                    value={form.aadhaarMasked}
                                    onChange={(e) =>
                                        setForm({ ...form, aadhaarMasked: e.target.value.replace(/\D/g, '').slice(0, 12) })
                                    }
                                    pattern="\d{12}"
                                    maxLength={12}
                                    inputMode="numeric"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                                    placeholder="123456789012"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                                    UAN Number
                                </label>

                                <input
                                    type="text"
                                    value={form.uanNumber}
                                    onChange={(e) =>
                                        setForm({ ...form, uanNumber: e.target.value })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                                    PF Number
                                </label>

                                <input
                                    type="text"
                                    value={form.pfNumber}
                                    onChange={(e) =>
                                        setForm({ ...form, pfNumber: e.target.value })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                                    ESIC Number
                                </label>

                                <input
                                    type="text"
                                    value={form.esicNumber}
                                    onChange={(e) =>
                                        setForm({ ...form, esicNumber: e.target.value })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                                    Bank Account
                                </label>

                                <input
                                    type="text"
                                    value={form.bankAccount}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            bankAccount: e.target.value,
                                        })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                                    placeholder="123456789012"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                                    IFSC
                                </label>

                                <input
                                    type="text"
                                    value={form.bankIfsc}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            bankIfsc: e.target.value.toUpperCase(),
                                        })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                                    placeholder="SBIN0001234"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                                    Bank Name
                                </label>

                                <input
                                    type="text"
                                    value={form.bankName}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            bankName: e.target.value,
                                        })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                                    placeholder="State Bank of India"
                                />
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                                    Payment Mode
                                </label>

                                <select
                                    value={form.paymentMode}
                                    onChange={(e) =>
                                        setForm({ ...form, paymentMode: e.target.value })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                                >
                                    <option value="">Select</option>
                                    <option value="BANK">Bank</option>
                                    <option value="CHEQUE">Cheque</option>
                                    <option value="CASH">Cash</option>
                                </select>
                            </div>

                        </div>
                    </div>

                    <div className="pt-2">
                        <button type="submit" disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                            Create Employee
                        </button>
                    </div>
                </form>
            </div>
        </AppShell>
    );
}
