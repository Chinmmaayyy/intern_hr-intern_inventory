'use client';
import { useEffect, useState } from 'react';
import { listTransfers, createStoreTransfer } from '@/app/actions/stock-actions';
import { listStores } from '@/app/actions/store-actions';
import { listItems } from '@/app/actions/item-master-actions';
import { AdminPage } from '@/app/admin/components/AdminPage';
import {
  ArrowLeftRight, Plus, RefreshCw, X, AlertCircle, Eye,
  PlusCircle, Trash
} from 'lucide-react';

export default function StockTransfersPage() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [fromStoreId, setFromStoreId] = useState('');
  const [toStoreId, setToStoreId] = useState('');
  const [lines, setLines] = useState<Array<{ item_id: number; name: string; qty: number; unit_cost: number }>>([]);

  const [selectedItemId, setSelectedItemId] = useState('');
  const [qty, setQty] = useState(1);
  const [unitCost, setUnitCost] = useState(0);

  const loadData = async () => {
    setLoading(true);
    const [trfRes, storeRes, itemRes] = await Promise.all([
      listTransfers({ status: statusFilter || undefined }),
      listStores(),
      listItems({ limit: 100 })
    ]);
    if (trfRes.success) setTransfers(trfRes.data?.transfers || []);
    if (storeRes.success) setStores(storeRes.data || []);
    if (itemRes.success) setAllItems(itemRes.data?.items || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [statusFilter]);

  const addLineItem = () => {
    if (!selectedItemId) return;
    const item = allItems.find(i => i.id === parseInt(selectedItemId));
    if (!item) return;
    if (lines.some(l => l.item_id === item.id)) { alert('Item already added.'); return; }
    setLines([...lines, { item_id: item.id, name: item.name, qty, unit_cost: unitCost || item.std_purchase_price || 0 }]);
    setSelectedItemId(''); setQty(1); setUnitCost(0);
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!fromStoreId || !toStoreId) { setFormError('Source and Destination stores are required.'); return; }
    if (fromStoreId === toStoreId) { setFormError('Source and Destination stores cannot be the same.'); return; }
    if (lines.length === 0) { setFormError('At least one transfer item is required.'); return; }

    setSubmitting(true);
    const res = await createStoreTransfer({
      from_store_id: parseInt(fromStoreId),
      to_store_id: parseInt(toStoreId),
      items: lines.map(l => ({ item_id: l.item_id, quantity: l.qty, unit_cost: l.unit_cost, batch_id: null }))
    });
    setSubmitting(false);

    if (res.success) {
      setShowCreateModal(false); loadData();
      setFromStoreId(''); setToStoreId(''); setLines([]);
    } else {
      setFormError(res.error || 'Failed to submit transfer. Make sure source store has enough stock.');
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Dispatched') return 'bg-amber-100 text-amber-700 border border-amber-200';
    if (status === 'Received') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <AdminPage
      pageTitle="Stock Transfers"
      pageIcon={<ArrowLeftRight className="h-5 w-5" />}
      onRefresh={loadData}
      refreshing={loading}
    >
      {/* Filters Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between mb-4">
        <span className="text-sm text-gray-500">Total Stock Transfers: {transfers.length}</span>
        <div className="flex w-full md:w-auto items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg text-sm text-gray-700 px-3 py-2 focus:outline-none focus:border-indigo-500 w-full md:w-44"
          >
            <option value="">All Statuses</option>
            <option value="Dispatched">Dispatched (In Transit)</option>
            <option value="Received">Received (Completed)</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus size={16} /> New Transfer
          </button>
          <button onClick={loadData} className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-lg transition">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : transfers.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 border border-gray-200 rounded-xl">
          <ArrowLeftRight size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 text-lg font-medium">No stock transfers found</p>
          <p className="text-gray-500 text-sm">Initiate transfers to move clinical products from central to auxiliary sub-stores.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Transfer ID</th>
                <th className="py-3 px-4">Source Store</th>
                <th className="py-3 px-4">Destination Store</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Dispatch Date</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
              {transfers.map((trf) => (
                <tr key={trf.id} className="hover:bg-gray-50">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">{trf.transfer_number}</td>
                  <td className="py-3.5 px-4 font-semibold text-gray-900">{trf.from_store?.name || `Store ${trf.from_store_id}`}</td>
                  <td className="py-3.5 px-4 font-semibold text-gray-900">{trf.to_store?.name || `Store ${trf.to_store_id}`}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadge(trf.status)}`}>
                      {trf.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-gray-500">{trf.dispatch_at ? new Date(trf.dispatch_at).toLocaleDateString() : 'N/A'}</td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => { setSelectedTransfer(trf); setShowViewModal(true); }}
                      className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1 mx-auto cursor-pointer"
                    >
                      <Eye size={14} /> Review Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full relative z-10 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-900">New Stock Transfer</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-700 transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateTransfer} className="space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl flex gap-2">
                  <AlertCircle className="shrink-0 mt-0.5" size={16} />
                  <span>{formError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Source Store (Deduct)</label>
                  <select value={fromStoreId} onChange={(e) => setFromStoreId(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700" required>
                    <option value="">Select store...</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.store_type})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Destination Store (Add)</label>
                  <select value={toStoreId} onChange={(e) => setToStoreId(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700" required>
                    <option value="">Select store...</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.store_type})</option>)}
                  </select>
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Add Transfer Line</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] text-gray-500 mb-1">Select Item Catalog</label>
                    <select value={selectedItemId} onChange={(e) => { setSelectedItemId(e.target.value); const itm = allItems.find(i => i.id === parseInt(e.target.value)); if (itm) setUnitCost(itm.std_purchase_price || 0); }} className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700">
                      <option value="">Select item...</option>
                      {allItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.item_code})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Quantity</label>
                    <input type="number" min="1" value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700" />
                  </div>
                  <button type="button" onClick={addLineItem} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer">
                    <PlusCircle size={14} /> Add Line
                  </button>
                </div>
              </div>
              {lines.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                        <th className="p-3">Item Details</th>
                        <th className="p-3 text-right">Transfer Qty</th>
                        <th className="p-3 text-right">Unit Cost (Est)</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-gray-700">
                      {lines.map((l, idx) => (
                        <tr key={l.item_id}>
                          <td className="p-3 font-semibold text-gray-900">{l.name}</td>
                          <td className="p-3 text-right font-bold">{l.qty}</td>
                          <td className="p-3 text-right text-gray-500">₹{Number(l.unit_cost).toFixed(2)}</td>
                          <td className="p-3 text-center">
                            <button type="button" onClick={() => setLines(lines.filter((_, i) => i !== idx))} className="text-rose-500 hover:text-rose-400 transition">
                              <Trash size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-5">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm transition disabled:opacity-50">
                  {submitting ? 'Processing Dispatch...' : 'Dispatch Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {showViewModal && selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowViewModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-2xl max-w-xl w-full relative z-10 p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                Transfer Details: <span className="text-indigo-600 font-mono">{selectedTransfer.transfer_number}</span>
              </h2>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-700 transition"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 border border-gray-200 rounded-xl text-xs text-gray-500 mb-6">
              <div>
                <span className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Source Store</span>
                <span className="font-semibold text-gray-900">{selectedTransfer.from_store?.name || `Store ${selectedTransfer.from_store_id}`}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Destination Store</span>
                <span className="font-semibold text-gray-900">{selectedTransfer.to_store?.name || `Store ${selectedTransfer.to_store_id}`}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Status</span>
                <span className="font-semibold text-gray-900">{selectedTransfer.status}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Dispatch Date</span>
                <span className="font-semibold text-gray-900">{selectedTransfer.dispatch_at ? new Date(selectedTransfer.dispatch_at).toLocaleString() : 'N/A'}</span>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Material Lines</h3>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                      <th className="p-2.5">Item Name</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5 text-right">Avg Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-700">
                    {selectedTransfer.items?.map((itm: any) => (
                      <tr key={itm.id}>
                        <td className="p-2.5 font-semibold text-gray-900">{itm.item?.name || `Item ${itm.item_id}`}</td>
                        <td className="p-2.5 text-right font-bold text-gray-900">{itm.quantity}</td>
                        <td className="p-2.5 text-right text-gray-500">₹{Number(itm.unit_cost || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
              <button type="button" onClick={() => setShowViewModal(false)} className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-xl text-sm">
                Close details
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
