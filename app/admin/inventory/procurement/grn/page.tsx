'use client';
import { useEffect, useState } from 'react';
import { listGRNs, createGRN, listPurchaseOrders, getPurchaseOrderById } from '@/app/actions/procurement-actions';
import { listStores } from '@/app/actions/store-actions';
import {
  Package, Search, Plus, Filter, RefreshCw, X, AlertCircle, Eye,
  CheckCircle2, Box, Calendar, PlusCircle, Trash, Check, User
} from 'lucide-react';
import { AdminPage } from '@/app/admin/components/AdminPage';

export default function GoodsReceiptNotesPage() {
  const [grns, setGrns] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected GRN Details Modal
  const [selectedGRN, setSelectedGRN] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // Create GRN Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [selectedPOId, setSelectedPOId] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [remarks, setRemarks] = useState('');

  // Items to receive (fetched from selected PO)
  const [receiveLines, setReceiveLines] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    const [grnRes, poOrderedRes, poApprovedRes, storeRes] = await Promise.all([
      listGRNs(),
      listPurchaseOrders({ status: 'Ordered' }),
      listPurchaseOrders({ status: 'Approved' }),
      listStores()
    ]);
    if (grnRes.success) setGrns(grnRes.data?.grns || []);
    const allPOs = [
      ...(poOrderedRes.data?.orders || []),
      ...(poApprovedRes.data?.orders || []),
    ];
    setPurchaseOrders(allPOs);
    if (storeRes.success) setStores(storeRes.data || []);
    setLoading(false);
  };


  useEffect(() => {
    loadData();
  }, []);

  const handlePOChange = async (poId: string) => {
    setSelectedPOId(poId);
    if (!poId) {
      setReceiveLines([]);
      return;
    }
    const res = await getPurchaseOrderById(parseInt(poId));
    if (res.success && res.data) {
      const items = res.data.items?.map((itm: any) => ({
        item_id: itm.item_id,
        name: itm.item?.name || `Item ${itm.item_id}`,
        item_code: itm.item?.item_code,
        quantity_ordered: itm.quantity_ordered,
        quantity_accepted: itm.quantity_ordered,
        quantity_rejected: 0,
        rejection_reason: '',
        batch_no: `BAT-${Date.now().toString().slice(-4)}`,
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year ahead
        unit_price: itm.unit_price,
        gst_rate: itm.gst_rate || 18,
      })) || [];
      setReceiveLines(items);
    }
  };

  const handleUpdateLine = (index: number, key: string, val: any) => {
    const copy = [...receiveLines];
    copy[index] = { ...copy[index], [key]: val };
    setReceiveLines(copy);
  };

  const handleCreateGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!selectedPOId) {
      setFormError('Purchase Order is required.');
      return;
    }
    if (!selectedStoreId) {
      setFormError('Target store location is required.');
      return;
    }
    if (receiveLines.length === 0) {
      setFormError('No items to receive.');
      return;
    }

    setSubmitting(true);
    // Resolve vendor from PO
    const po = purchaseOrders.find(o => o.id === parseInt(selectedPOId));
    const res = await createGRN({
      po_id: parseInt(selectedPOId),
      vendor_id: po ? po.vendor_id : 1,
      store_id: parseInt(selectedStoreId),
      remarks: remarks.trim() || null,
      items: receiveLines.map(l => ({
        item_id: l.item_id,
        quantity_accepted: parseInt(l.quantity_accepted) || 0,
        quantity_rejected: parseInt(l.quantity_rejected) || 0,
        rejection_reason: l.rejection_reason || null,
        batch_no: l.batch_no || null,
        expiry_date: l.expiry_date ? new Date(l.expiry_date).toISOString() : null,
        unit_price: parseFloat(l.unit_price) || 0,
        gst_rate: parseFloat(l.gst_rate) || 0,
      }))
    });
    setSubmitting(false);

    if (res.success) {
      setShowCreateModal(false);
      loadData();
      setSelectedPOId('');
      setSelectedStoreId('');
      setRemarks('');
      setReceiveLines([]);
    } else {
      setFormError(res.error || 'Failed to register GRN.');
    }
  };

  return (
    <AdminPage
      pageTitle="Goods Receipt Notes (GRN)"
      pageIcon={<Package className="h-5 w-5" />}
      onRefresh={loadData}
      refreshing={loading}
      headerActions={
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium px-4 py-2.5 rounded-lg shadow-md transition-all cursor-pointer"
        >
          <Plus size={18} />
          Register Goods Receipt (GRN)
        </button>
      }
    >
      <div className="text-gray-500 text-sm mb-4">
        Record clinical products delivery, verify physical quality standards, log batch expiries, and trigger General Ledger listings.
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : grns.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 border border-gray-200 rounded-xl">
          <Package size={48} className="text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 text-lg font-medium">No Goods Receipt Notes found</p>
          <p className="text-gray-400 text-sm">Post delivery logs against open vendor purchase orders to populate the directory.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">GRN Number</th>
                <th className="py-3 px-4">Purchase Order</th>
                <th className="py-3 px-4">Delivery Location</th>
                <th className="py-3 px-4">Settle Date</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
              {grns.map((grn) => (
                <tr key={grn.id} className="hover:bg-gray-50">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">{grn.grn_number}</td>
                  <td className="py-3.5 px-4 font-mono text-gray-500">{grn.purchase_order?.po_number || 'Direct/No PO'}</td>
                  <td className="py-3.5 px-4 font-semibold text-gray-900">{grn.store?.name || `Store ${grn.store_id}`}</td>
                  <td className="py-3.5 px-4 text-gray-500">
                    {new Date(grn.received_at || grn.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => {
                        setSelectedGRN(grn);
                        setShowViewModal(true);
                      }}
                      className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1 mx-auto cursor-pointer"
                    >
                      <Eye size={14} /> Review GRN
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create GRN Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-xl max-w-4xl w-full relative z-10 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-900">Create Goods Receipt Note (GRN)</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-900 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateGRN} className="space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-lg flex gap-2">
                  <AlertCircle className="shrink-0 mt-0.5" size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Purchase Order Reference</label>
                  <select
                    value={selectedPOId}
                    onChange={(e) => handlePOChange(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                    required
                  >
                    <option value="">Select Purchase Order...</option>
                    {purchaseOrders.map(po => (
                      <option key={po.id} value={po.id}>{po.po_number} — {po.vendor?.vendor_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Receiving Store Location</label>
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                    required
                  >
                    <option value="">Select Store location...</option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.store_type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Audit/GRN Remarks</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Verified package seal, matches invoice"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                  />
                </div>
              </div>

              {/* Items Panel */}
              {receiveLines.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Audit Material Deliveries</h3>
                  <div className="border border-gray-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[800px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                          <th className="p-3">Item Catalog SKU</th>
                          <th className="p-3 text-right">Qty Ordered</th>
                          <th className="p-3 text-right">Accepted Qty</th>
                          <th className="p-3 text-right">Rejected Qty</th>
                          <th className="p-3">Batch Number</th>
                          <th className="p-3">Expiry Date</th>
                          <th className="p-3 text-right">Price (GST Extra)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 text-gray-700 bg-white">
                        {receiveLines.map((l, idx) => (
                          <tr key={l.item_id}>
                            <td className="p-3">
                              <div className="font-semibold text-gray-900">{l.name}</div>
                              <div className="text-[10px] text-gray-500">{l.item_code}</div>
                            </td>
                            <td className="p-3 text-right font-semibold text-gray-500">{l.quantity_ordered}</td>
                            <td className="p-3 text-right">
                              <input
                                type="number"
                                min="0"
                                value={l.quantity_accepted}
                                onChange={(e) => handleUpdateLine(idx, 'quantity_accepted', Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-16 bg-white border border-gray-300 rounded px-1.5 py-1 text-right text-xs"
                              />
                            </td>
                            <td className="p-3 text-right">
                              <input
                                type="number"
                                min="0"
                                value={l.quantity_rejected}
                                onChange={(e) => handleUpdateLine(idx, 'quantity_rejected', Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-16 bg-white border border-gray-300 rounded px-1.5 py-1 text-right text-xs"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                value={l.batch_no}
                                onChange={(e) => handleUpdateLine(idx, 'batch_no', e.target.value)}
                                className="w-24 bg-white border border-gray-300 rounded px-1.5 py-1 text-xs font-mono text-indigo-600"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="date"
                                value={l.expiry_date}
                                onChange={(e) => handleUpdateLine(idx, 'expiry_date', e.target.value)}
                                className="bg-white border border-gray-300 rounded px-1.5 py-1 text-xs"
                              />
                            </td>
                            <td className="p-3 text-right font-semibold">
                              ₹{Number(l.unit_price).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm transition"
                >
                  {submitting ? 'Registering delivery logs...' : 'Register Goods Receipt (GRN)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View GRN Details Modal */}
      {showViewModal && selectedGRN && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowViewModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-xl max-w-2xl w-full relative z-10 p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                GRN Log: <span className="text-indigo-600 font-mono">{selectedGRN.grn_number}</span>
              </h2>
              <button onClick={() => setShowViewModal(false)} className="text-gray-500 hover:text-gray-900 transition">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 border border-gray-200 rounded-lg text-xs text-gray-700 mb-6">
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-bold">Purchase Order Ref</span>
                <span className="font-mono text-gray-900">{selectedGRN.purchase_order?.po_number || 'Direct/No PO'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-bold">Receiving Store</span>
                <span className="font-semibold text-gray-900">{selectedGRN.store?.name || `Store ${selectedGRN.store_id}`}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-bold">Received Date</span>
                <span className="font-semibold text-gray-900">{new Date(selectedGRN.received_at || selectedGRN.created_at).toLocaleString()}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-bold">Auditor Remarks</span>
                <span className="font-semibold text-gray-900">{selectedGRN.remarks || 'None recorded'}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Item Receipt Lines</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-100/50 border-b border-gray-200 text-gray-500 font-bold">
                      <th className="p-2.5">Item Catalog SKU</th>
                      <th className="p-2.5 text-right">Accepted Qty</th>
                      <th className="p-2.5 text-right">Rejected Qty</th>
                      <th className="p-2.5">Batch Number</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-700">
                    {selectedGRN.items?.map((itm: any) => (
                      <tr key={itm.id}>
                        <td className="p-2.5 font-semibold text-gray-900">{itm.item?.name || `Item ${itm.item_id}`}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-600">{itm.quantity_accepted}</td>
                        <td className="p-2.5 text-right font-bold text-rose-600">{itm.quantity_rejected || 0}</td>
                        <td className="p-2.5 font-mono text-gray-500">{itm.batch_no || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2 rounded-lg text-sm"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
