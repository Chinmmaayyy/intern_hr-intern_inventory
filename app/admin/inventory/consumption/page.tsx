'use client';
import { useEffect, useState } from 'react';
import { recordConsumption, listConsumptions } from '@/app/actions/stock-actions';
import { listStores } from '@/app/actions/store-actions';
import { listItems } from '@/app/actions/item-master-actions';
import { AdminPage } from '@/app/admin/components/AdminPage';
import {
  Flame, Plus, X, AlertCircle, RefreshCw, Filter, Package
} from 'lucide-react';

export default function ConsumptionPage() {
  const [consumptions, setConsumptions] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form fields
  const [storeId, setStoreId] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [consumptionType, setConsumptionType] = useState<'PATIENT' | 'DEPARTMENT'>('DEPARTMENT');
  const [patientId, setPatientId] = useState('');
  const [admissionId, setAdmissionId] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [reason, setReason] = useState('');

  const load = async () => {
    setLoading(true);
    const [consRes, storeRes, itemRes] = await Promise.all([
      listConsumptions({ limit: 50 }),
      listStores(),
      listItems({ status: 'Active', limit: 200 }),
    ]);
    if (consRes.success) setConsumptions(consRes.data?.movements || []);
    if (storeRes.success) setStores(storeRes.data || []);
    if (itemRes.success) setAllItems(itemRes.data?.items || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectedItemObj = allItems.find(i => i.id === parseInt(itemId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!storeId || !itemId || quantity <= 0) {
      setFormError('Store, item, and quantity are required.'); return;
    }
    if (consumptionType === 'PATIENT' && !admissionId && !patientId) {
      setFormError('Admission ID or Patient ID is required for patient consumption.'); return;
    }
    setSubmitting(true);
    const res = await recordConsumption({
      store_id: parseInt(storeId),
      item_id: parseInt(itemId),
      quantity,
      type: consumptionType,
      admission_id: admissionId || null,
      patient_id: patientId || null,
      cost_center: costCenter || null,
      reason: reason || null,
    });
    setSubmitting(false);
    if (res.success) {
      setShowCreateModal(false);
      setStoreId(''); setItemId(''); setQuantity(1);
      setConsumptionType('DEPARTMENT'); setPatientId(''); setAdmissionId('');
      setCostCenter(''); setReason('');
      await load();
    } else {
      setFormError(res.error || 'Failed to record consumption.');
    }
  };

  const formatType = (type: string) => {
    if (type === 'CONSUMPTION') return 'Dept Consumption';
    if (type === 'PATIENT_CHARGE') return 'Patient Charged';
    return type;
  };

  return (
    <AdminPage
      pageTitle="Consumption Log"
      pageIcon={<Flame className="h-5 w-5" />}
      onRefresh={load}
      refreshing={loading}
      headerActions={
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-medium px-4 py-2.5 rounded-lg shadow-md transition-all cursor-pointer"
        >
          <Plus size={18} />
          Log Consumption
        </button>
      }
    >
      <p className="text-sm text-gray-500 mb-5">
        Record clinical material consumption against departments or patient admissions. Stock is deducted in real-time and posted to the GL.
      </p>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
        </div>
      ) : consumptions.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <Flame size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg font-medium">No consumptions recorded yet</p>
          <p className="text-gray-400 text-sm">Log department or patient consumption to track material usage.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4 text-left">Item</th>
                <th className="py-3 px-4 text-left">Store</th>
                <th className="py-3 px-4 text-right">Qty Used</th>
                <th className="py-3 px-4 text-right">Unit Cost</th>
                <th className="py-3 px-4 text-left">Type</th>
                <th className="py-3 px-4 text-left">Patient / Dept</th>
                <th className="py-3 px-4 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {consumptions.map(mov => (
                <tr key={mov.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{mov.item?.name || `Item ${mov.item_id}`}</td>
                  <td className="py-3 px-4 text-gray-600">{mov.store?.name || `Store ${mov.store_id}`}</td>
                  <td className="py-3 px-4 text-right font-bold text-rose-600">{mov.quantity_out}</td>
                  <td className="py-3 px-4 text-right text-gray-500">₹{Number(mov.unit_cost || 0).toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${mov.movement_type === 'PATIENT_CHARGE' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                      {formatType(mov.movement_type)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">
                    {mov.admission_id || mov.patient_id || mov.cost_center || mov.reason || '—'}
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs">{new Date(mov.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log Consumption Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-xl max-w-lg w-full relative z-10 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-900">Log Consumption</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-900 transition"><X size={20} /></button>
            </div>

            {formError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-lg flex gap-2 mb-4">
                <AlertCircle className="shrink-0 mt-0.5" size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Consumption Type</label>
                <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                  <button type="button" onClick={() => setConsumptionType('DEPARTMENT')}
                    className={`flex-1 text-sm py-2.5 font-medium transition ${consumptionType === 'DEPARTMENT' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    Department Use
                  </button>
                  <button type="button" onClick={() => setConsumptionType('PATIENT')}
                    className={`flex-1 text-sm py-2.5 font-medium transition ${consumptionType === 'PATIENT' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    Patient Charge
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Issuing Store *</label>
                  <select value={storeId} onChange={(e) => setStoreId(e.target.value)} required
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900">
                    <option value="">Select Store...</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Item *</label>
                  <select value={itemId} onChange={(e) => setItemId(e.target.value)} required
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900">
                    <option value="">Select Item...</option>
                    {allItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.base_uom})</option>)}
                  </select>
                </div>
              </div>

              {selectedItemObj && (
                <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                  <span className="font-semibold text-gray-700">{selectedItemObj.name}</span> — 
                  Type: {selectedItemObj.item_type?.replace(/_/g, ' ')} | 
                  Stock: <span className={selectedItemObj.total_stock === 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>{selectedItemObj.total_stock} {selectedItemObj.base_uom}</span>
                  {selectedItemObj.is_patient_chargeable && <span className="ml-2 text-purple-600 font-semibold">• Patient Chargeable</span>}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Quantity *</label>
                <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
              </div>

              {consumptionType === 'PATIENT' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Admission ID</label>
                    <input type="text" value={admissionId} onChange={(e) => setAdmissionId(e.target.value)}
                      placeholder="e.g. adm-inventory-e2e" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
                    <p className="text-[10px] text-gray-400 mt-1">Seed test admission: adm-inventory-e2e</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Patient ID</label>
                    <input type="text" value={patientId} onChange={(e) => setPatientId(e.target.value)}
                      placeholder="e.g. PAT-001" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Cost Center / Department</label>
                  <input type="text" value={costCenter} onChange={(e) => setCostCenter(e.target.value)}
                    placeholder="e.g. ICU, OT, Emergency" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Reason / Notes</label>
                <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Routine surgical use, Dressing change" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-orange-500 hover:bg-orange-400 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                  {submitting ? 'Recording...' : 'Record Consumption'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
