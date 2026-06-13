'use client';
import { useEffect, useState } from 'react';
import { getModuleConfig, updateModuleConfig } from '@/app/actions/module-config-actions';
import { AdminPage } from '@/app/admin/components/AdminPage';
import { Settings, Save, RefreshCw } from 'lucide-react';

export default function InventoryConfigPage() {
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await getModuleConfig('inventory');
    if (res.success) setConfig((res.data?.config_json as object) || {});
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    const res = await updateModuleConfig('inventory', config);
    setSaving(false);
    if (res.success) alert('Inventory configuration saved.');
    else alert(res.error || 'Save failed.');
  };

  const thresholds = config.po_approval_thresholds || { store_manager: 50000, admin: 500000 };

  return (
    <AdminPage pageTitle="Inventory Configuration" pageIcon={<Settings className="h-5 w-5" />} onRefresh={load} refreshing={loading}>
      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="animate-spin" /></div>
      ) : (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white border rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-gray-900">PO Approval Thresholds (₹)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Store Manager Max</label>
                <input type="number" value={thresholds.store_manager ?? 50000}
                  onChange={e => setConfig({ ...config, po_approval_thresholds: { ...thresholds, store_manager: parseInt(e.target.value) || 0 } })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Admin Max (above → Finance)</label>
                <input type="number" value={thresholds.admin ?? 500000}
                  onChange={e => setConfig({ ...config, po_approval_thresholds: { ...thresholds, admin: parseInt(e.target.value) || 0 } })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
            </div>
          </div>
          <div className="bg-white border rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-gray-900">Count & Issue Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Adjustment Tolerance (%)</label>
                <input type="number" step="0.1" value={config.adjustment_tolerance_pct ?? 2}
                  onChange={e => setConfig({ ...config, adjustment_tolerance_pct: parseFloat(e.target.value) || 2 })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Emergency Issue Cap (₹)</label>
                <input type="number" value={config.emergency_issue_cap ?? 10000}
                  onChange={e => setConfig({ ...config, emergency_issue_cap: parseInt(e.target.value) || 10000 })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
            </div>
          </div>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      )}
    </AdminPage>
  );
}
