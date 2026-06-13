'use client';

import React, { useState, useEffect } from 'react';
import { createAttendanceDeviceAction, getAttendanceDevicesAction } from '@/app/actions/attendance-actions';
import { Loader2, CheckCircle2, XCircle, Copy, Link as LinkIcon, Plus, Info } from 'lucide-react';

interface DeviceManagerProps {
    initialDevices: any[];
    branches: any[];
    organizationId: string;
}

export function DeviceManager({
    initialDevices,
    branches,
    organizationId
}: DeviceManagerProps) {
    const [devices, setDevices] = useState<any[]>(initialDevices);
    const [showModal, setShowModal] = useState(false);
    
    // Form fields
    const [deviceCode, setDeviceCode] = useState('');
    const [vendor, setVendor] = useState('');
    const [branchId, setBranchId] = useState('');
    const [webhookSecret, setWebhookSecret] = useState('');

    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [baseUrl, setBaseUrl] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setBaseUrl(window.location.origin);
        }
    }, []);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    const copyToClipboard = (text: string, subject: string) => {
        navigator.clipboard.writeText(text);
        showToast('success', `${subject} copied to clipboard.`);
    };

    const handleOpenModal = () => {
        // Generate a random UUID for the webhook secret
        const secret = typeof crypto !== 'undefined' && crypto.randomUUID 
            ? crypto.randomUUID() 
            : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        
        setWebhookSecret(secret);
        setDeviceCode('');
        setVendor('');
        setBranchId('');
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await createAttendanceDeviceAction({
                device_code: deviceCode,
                vendor: vendor || undefined,
                branch_id: branchId || undefined,
                webhook_secret: webhookSecret
            });

            if (res.success) {
                showToast('success', 'Biometric device registered successfully.');
                setShowModal(false);
                // Refresh list
                const list = await getAttendanceDevicesAction();
                if (list.success) {
                    setDevices(list.data || []);
                }
            } else {
                showToast('error', res.error || 'Failed to register device.');
            }
        } catch (error: any) {
            showToast('error', error.message || 'An error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const formatRelativeTime = (dateStr: string | null) => {
        if (!dateStr) return 'Never';
        const d = new Date(dateStr);
        const diffMs = Date.now() - d.getTime();
        const mins = Math.floor(diffMs / 60000);
        const hours = Math.floor(mins / 60);
        const days = Math.floor(hours / 24);

        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    const webhookEndpoint = `${baseUrl}/api/hr/attendance-events`;

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

            {/* Webhook URL Alert / Info panel */}
            <div className="bg-orange-50 border border-orange-100 shadow-sm rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-orange-600" />
                    <h3 className="text-sm font-black text-orange-800 uppercase tracking-wide">Biometric Integration Webhook</h3>
                </div>
                <p className="text-xs text-orange-700 leading-relaxed max-w-2xl">
                    Configure your physical attendance devices to POST punch records to the endpoint below. 
                    All payloads must be HMAC-SHA256 authenticated using the corresponding device's secret.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <div className="flex-1 bg-white border border-orange-200 rounded-xl p-3 flex items-center justify-between text-xs font-mono font-bold text-gray-700 select-all overflow-x-auto">
                        <span>{webhookEndpoint}</span>
                    </div>
                    <button
                        onClick={() => copyToClipboard(webhookEndpoint, 'Webhook URL')}
                        className="px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 shadow-sm"
                    >
                        <Copy className="h-3.5 w-3.5" />
                        Copy Webhook URL
                    </button>
                </div>
            </div>

            {/* Header controls */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-gray-900">Registered Devices</h2>
                <button
                    onClick={handleOpenModal}
                    className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 text-white text-xs font-bold rounded-xl hover:shadow-md transition-all flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Register New Device
                </button>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Device Code</th>
                                <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vendor</th>
                                <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assigned Branch</th>
                                <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="text-left px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Last Seen</th>
                                <th className="text-right px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">HMAC Secret</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {devices.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                                        <LinkIcon className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                                        <p className="font-semibold text-sm">No registered devices</p>
                                        <p className="text-xs">Click "Register New Device" to start linking biometric hardware.</p>
                                    </td>
                                </tr>
                            ) : (
                                devices.map((d) => (
                                    <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-4 whitespace-nowrap font-bold text-gray-900">
                                            {d.device_code}
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap text-gray-600 font-medium">
                                            {d.vendor || 'Generic'}
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap text-gray-600 font-medium">
                                            {d.branchName}
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold ${
                                                d.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {d.is_active ? 'ACTIVE' : 'INACTIVE'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap text-gray-500 text-xs">
                                            {formatRelativeTime(d.last_seen_at)}
                                        </td>
                                        <td className="px-5 py-4 text-right whitespace-nowrap">
                                            <button
                                                onClick={() => copyToClipboard(d.webhook_secret, 'HMAC secret')}
                                                className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-[10px] font-extrabold rounded-lg border border-gray-200 transition-colors inline-flex items-center gap-1.5"
                                            >
                                                <Copy className="h-3 w-3" />
                                                Copy Secret
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Register Device Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-gray-100 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                            <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wide">Register New Biometric Device</h3>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Device Code (Unique)</label>
                                <input
                                    type="text"
                                    value={deviceCode}
                                    onChange={e => setDeviceCode(e.target.value)}
                                    placeholder="e.g. BIO-LOBBY-01"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Vendor / Model</label>
                                <input
                                    type="text"
                                    value={vendor}
                                    onChange={e => setVendor(e.target.value)}
                                    placeholder="e.g. Essl, ZKTeco"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Hospital Branch</label>
                                <select
                                    value={branchId}
                                    onChange={e => setBranchId(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                                >
                                    <option value="">General (All Branches)</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.branch_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">HMAC Webhook Secret (Auto-generated)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={webhookSecret}
                                        className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-xs font-mono font-bold bg-gray-50 text-gray-500 select-all"
                                        readOnly
                                    />
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(webhookSecret, 'HMAC secret')}
                                        className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        <Copy className="h-4 w-4 text-gray-600" />
                                    </button>
                                </div>
                                <span className="text-[9px] text-orange-600 italic block">
                                    * Store this secret on your biometric device. It cannot be edited.
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
                                    disabled={loading}
                                    className="px-4 py-2 text-white text-xs font-bold rounded-xl hover:shadow-md transition-all flex items-center gap-1.5"
                                    style={{ background: 'linear-gradient(to right, #f97316, #16a34a)' }}
                                >
                                    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    Register Device
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
