'use client';
import { useEffect, useState } from 'react';
import { listRequisitions, createRequisition, approveRequisition } from '@/app/actions/procurement-actions';
import { listStores } from '@/app/actions/store-actions';
import { listItems } from '@/app/actions/item-master-actions';
import {
  ShoppingCart, Search, Plus, Filter, RefreshCw, X, AlertCircle, Eye,
  CheckCircle2, Box, Calendar, FileText, Check
} from 'lucide-react';
import { AdminPage } from '@/app/admin/components/AdminPage';

export default function RequisitionsPage() {
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // Selected Requisition details Modal
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [approving, setApproving] = useState(false);

  // Create Requisition Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  
  const [storeId, setStoreId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [lines, setLines] = useState<Array<{ item_id: number; name: string; qty: number }>>([]);

  // Create line helper
  const [selectedItemId, setSelectedItemId] = useState('');
  const [qtyRequested, setQtyRequested] = useState(1);

  const loadData = async () => {
    setLoading(true);
    const [reqRes, storeRes, itemRes] = await Promise.all([
      listRequisitions({ status: statusFilter }),
      listStores(),
      listItems({ limit: 100 })
    ]);
    if (reqRes.success) setRequisitions(reqRes.data?.requisitions || []);
    if (storeRes.success) setStores(storeRes.data || []);
    if (itemRes.success) setAllItems(itemRes.data?.items || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const addLine = () => {
    if (!selectedItemId) return;
    const item = allItems.find(i => i.id === parseInt(selectedItemId));
    if (!item) return;

    if (lines.some(l => l.item_id === item.id)) {
      alert('Item already added to requisition.');
      return;
    }

    setLines([...lines, { item_id: item.id, name: item.name, qty: qtyRequested }]);
    setSelectedItemId('');
    setQtyRequested(1);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleCreateRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!storeId) {
      setFormError('Please select a target store location.');
      return;
    }
    if (lines.length === 0) {
      setFormError('Requisition must have at least one material line item.');
      return;
    }

    setSubmitting(true);
    const res = await createRequisition({
      requesting_store_id: parseInt(storeId),
      priority: 'NORMAL',
      items: lines.map(l => ({ item_id: l.item_id, quantity: l.qty }))
    });
    setSubmitting(false);

    if (res.success) {
      setShowCreateModal(false);
      loadData();
      setStoreId('');
      setPurpose('');
      setLines([]);
    } else {
      setFormError(res.error || 'Failed to submit Purchase Requisition.');
    }
  };

  const handleOpenDetails = (req: any) => {
    setSelectedReq(req);
    setShowViewModal(true);
  };

  const handleApproveRequisition = async (id: number) => {
    setApproving(true);
    const res = await approveRequisition(id);
    setApproving(false);
    if (res.success) {
      alert('Purchase Requisition approved! Ready for Purchase Order sourcing.');
      setShowViewModal(false);
      loadData();
    } else {
      alert(res.error || 'Failed to approve requisition.');
    }
  };

  return (
    <AdminPage 
      pageTitle="Purchase Requisitions (PR)" 
      pageIcon={<ShoppingCart className="h-5 w-5" />} 
      onRefresh={loadData} 
      refreshing={loading}
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <p className="text-gray-500 text-sm">
          Request replenishment, review internal departmental demands, and approve sourcing batches for external purchase orders.
        </p>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer text-sm whitespace-nowrap"
        >
          <Plus size={18} />
          Create Requisition
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
        <div>
          <span className="text-sm text-gray-500">Total Requisitions: {requisitions.length}</span>
        </div>

        <div className="flex w-full md:w-auto items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg text-sm text-gray-700 px-3 py-2 focus:outline-none focus:border-indigo-500 w-full md:w-44"
          >
            <option value="">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Draft">Draft</option>
            <option value="Approved">Approved</option>
            <option value="PO Created">PO Created</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <button
            onClick={loadData}
            className="p-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg transition"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : requisitions.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <ShoppingCart size={48} className="text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 text-lg font-medium">No requisitions found</p>
          <p className="text-gray-400 text-sm">Raise a purchase requisition to begin requesting stock replenishment from external vendors.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">PR Number</th>
                <th className="py-3 px-4">Store / Location</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4">Purpose</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
              {requisitions.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">{req.pr_number}</td>
                  <td className="py-3.5 px-4 font-semibold text-gray-900">{req.store?.name}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      req.status === 'Submitted' ? 'bg-blue-55 text-blue-700 border border-blue-100' :
                      req.status === 'Draft' ? 'bg-indigo-55 text-indigo-700 border border-indigo-100' :
                      req.status === 'Approved' ? 'bg-emerald-55 text-emerald-700 border border-emerald-100' :
                      req.status === 'PO Created' ? 'bg-teal-55 text-teal-700 border border-teal-100' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-gray-500">
                    {new Date(req.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-gray-500 max-w-xs truncate">{req.purpose || '—'}</td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => handleOpenDetails(req)}
                      className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1 mx-auto cursor-pointer"
                    >
                      <Eye size={14} /> Review Requisition
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-xl max-w-lg w-full relative z-10 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-900">Create Purchase Requisition</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateRequisition} className="space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex gap-2">
                  <AlertCircle className="shrink-0 mt-0.5 text-rose-600" size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Destination Store</label>
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                  required
                >
                  <option value="">Select store...</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.store_type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Purpose / Justification</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Replenish clinical glove and syringe stocks"
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                />
              </div>

              {/* Items Line Creator */}
              <div className="border-t border-gray-200 pt-4 mt-4 space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Demand Materials List</h3>
                <div className="grid grid-cols-5 gap-2 items-end">
                  <div className="col-span-3">
                    <label className="block text-[10px] text-gray-500 mb-1">Select SKU</label>
                    <select
                      value={selectedItemId}
                      onChange={(e) => setSelectedItemId(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg text-xs text-gray-900 px-2.5 py-1.5 focus:outline-none"
                    >
                      <option value="">Choose item Master...</option>
                      {allItems.map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.base_uom})</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] text-gray-500 mb-1">Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={qtyRequested}
                      onChange={(e) => setQtyRequested(parseInt(e.target.value) || 1)}
                      className="w-full bg-white border border-gray-200 rounded-lg text-xs text-gray-900 px-2.5 py-1.5"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addLine}
                    className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs px-3 py-2 rounded-lg font-medium"
                  >
                    Add
                  </button>
                </div>

                {/* Lines Review */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 max-h-36 overflow-y-auto">
                  {lines.length === 0 ? (
                    <p className="text-xs text-center py-4 text-gray-500">No items added to demand block yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {lines.map((l, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white border border-gray-200 px-3 py-1.5 rounded text-xs text-gray-700">
                          <span>{l.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-gray-900">Qty: {l.qty}</span>
                            <button onClick={() => removeLine(idx)} className="text-rose-500 hover:text-rose-600">
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm transition"
                >
                  {submitting ? 'Submitting...' : 'Submit Requisition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showViewModal && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowViewModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-xl max-w-2xl w-full relative z-10 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  Requisition Profile: <span className="text-indigo-600 font-mono">{selectedReq.pr_number}</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Location: {selectedReq.store?.name}</p>
              </div>
              <button onClick={() => setShowViewModal(false)} className="text-gray-500 hover:text-gray-700 transition">
                <X size={20} />
              </button>
            </div>

            {/* Info Box */}
            <div className="flex justify-between items-center p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs mb-6">
              <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-gray-500">
                <div>
                  <span className="block text-[10px] text-gray-500 uppercase font-bold">Justification</span>
                  <span className="font-semibold text-gray-900">{selectedReq.purpose || 'Not stated'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-500 uppercase font-bold">Demand Type</span>
                  <span className="font-semibold text-gray-900">{selectedReq.is_auto_created ? 'Auto Replenishment' : 'Manual Demand'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-500 uppercase font-bold">Created At</span>
                  <span className="font-semibold text-gray-900">{new Date(selectedReq.created_at).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-500 uppercase font-bold">Status</span>
                  <span className="font-semibold text-gray-900">{selectedReq.status}</span>
                </div>
              </div>

              {(selectedReq.status === 'Submitted' || selectedReq.status === 'Draft') && (
                <button
                  onClick={() => handleApproveRequisition(selectedReq.id)}
                  disabled={approving}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} /> {approving ? 'Approving...' : 'Approve Requisition'}
                </button>
              )}
            </div>

            {/* Demand Items */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Requested Sourcing Details</h3>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Item Details</th>
                      <th className="py-2.5 px-3 text-right">Quantity Requested</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-700">
                    {selectedReq.items?.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-gray-900">{item.item?.name}</div>
                          <div className="text-[10px] text-gray-500">{item.item?.item_code} | UOM: {item.item?.base_uom}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-gray-900">{item.quantity_requested}</td>
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
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
