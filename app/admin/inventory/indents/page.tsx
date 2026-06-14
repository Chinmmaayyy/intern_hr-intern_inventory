'use client';
import { useEffect, useState } from 'react';
import { listIndents, createIndent, getIndentById, issueIndentItems, approveIndent, getFEFOSuggestion, receiveConfirmIndent, emergencyIssue } from '@/app/actions/indent-actions';
import { listStores } from '@/app/actions/store-actions';
import { listItems } from '@/app/actions/item-master-actions';
import { AdminPage } from '@/app/admin/components/AdminPage';
import {
  FileText, Search, Plus, Filter, Eye, RefreshCw, X, AlertCircle, CheckCircle2,
  Calendar, ArrowRightLeft, User, Package, Send, Check
} from 'lucide-react';

export default function IndentsListPage() {
  const [indents, setIndents] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const QUICK_FILTERS = [
    { label: 'All', value: '' },
    { label: 'Pending Issues', value: 'Approved' },
    { label: 'Pending Receipts', value: 'In Transit' },
    { label: 'Submitted', value: 'Submitted' },
  ];

  // View Details Modal
  const [selectedIndent, setSelectedIndent] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [issueQtyMap, setIssueQtyMap] = useState<Record<number, number>>({});
  const [issuingLineId, setIssuingLineId] = useState<number | null>(null);
  const [fefoHints, setFefoHints] = useState<Record<number, string>>({});
  const [receiving, setReceiving] = useState(false);
  const [approving, setApproving] = useState(false);

  const formatPriority = (priority?: string) => {
    if (priority === 'EMERGENCY') return 'Emergency';
    if (priority === 'URGENT') return 'Urgent';
    return 'Routine';
  };

  const priorityClass = (priority?: string) => {
    if (priority === 'NORMAL') return 'bg-blue-100 text-blue-700';
    if (priority === 'URGENT') return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700 font-bold';
  };

  // Create Modal Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestingStoreId, setRequestingStoreId] = useState('');
  const [supplyingStoreId, setSupplyingStoreId] = useState('');
  const [urgency, setUrgency] = useState<'Routine' | 'Urgent' | 'Emergency'>('Routine');
  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState<Array<{ item_id: number; name: string; qty: number }>>([]);
  
  // Create Line Form
  const [selectedItemId, setSelectedItemId] = useState('');
  const [qtyRequested, setQtyRequested] = useState(1);

  const loadData = async () => {
    setLoading(true);
    const [indRes, storeRes, itemRes] = await Promise.all([
      listIndents({ status: statusFilter }),
      listStores(),
      listItems({ limit: 100 })
    ]);
    if (indRes.success) setIndents(indRes.data?.indents || []);
    if (storeRes.success) setStores(storeRes.data || []);
    if (itemRes.success) setAllItems(itemRes.data?.items || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const addLineItem = () => {
    if (!selectedItemId) return;
    const item = allItems.find(i => i.id === parseInt(selectedItemId));
    if (!item) return;

    if (lines.some(l => l.item_id === item.id)) {
      alert('Item already added to request list.');
      return;
    }

    setLines([...lines, { item_id: item.id, name: item.name, qty: qtyRequested }]);
    setSelectedItemId('');
    setQtyRequested(1);
  };

  const removeLineItem = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleCreateIndent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!requestingStoreId || !supplyingStoreId) {
      setFormError('Requesting store and Supplying store are required.');
      return;
    }
    if (requestingStoreId === supplyingStoreId) {
      setFormError('Requesting store and Supplying store cannot be the same.');
      return;
    }
    if (lines.length === 0) {
      setFormError('At least one line item is required.');
      return;
    }

    setSubmitting(true);
    const res = await createIndent({
      from_store_id: parseInt(requestingStoreId),
      to_store_id: parseInt(supplyingStoreId),
      priority: urgency === 'Emergency' ? 'EMERGENCY' : urgency === 'Urgent' ? 'URGENT' : 'NORMAL',
      cost_center: remarks.trim() || null,
      items: lines.map(l => ({ item_id: l.item_id, qty_requested: l.qty }))
    });
    setSubmitting(false);

    if (res.success) {
      setShowCreateModal(false);
      loadData();
      // Reset form
      setRequestingStoreId('');
      setSupplyingStoreId('');
      setUrgency('Routine');
      setRemarks('');
      setLines([]);
    } else {
      setFormError(res.error || 'Failed to submit indent.');
    }
  };

  const handleViewDetails = async (indent: any) => {
    const res = await getIndentById(indent.id);
    if (res.success) {
      setSelectedIndent(res.data);
      // Init issue quantity maps with requested quantities
      const initialMap: Record<number, number> = {};
      res.data.items?.forEach((i: any) => {
        initialMap[i.item_id] = i.qty_requested - (i.qty_issued || 0);
      });
      setIssueQtyMap(initialMap);
      setShowViewModal(true);
    }
  };

  const handleApproveIndent = async () => {
    if (!selectedIndent?.items?.length) return;
    setApproving(true);
    const res = await approveIndent(
      selectedIndent.id,
      selectedIndent.items.map((i: any) => ({
        item_id: i.item_id,
        qty_approved: i.qty_requested,
      }))
    );
    setApproving(false);
    if (res.success) {
      const detailRes = await getIndentById(selectedIndent.id);
      if (detailRes.success) setSelectedIndent(detailRes.data);
      loadData();
    } else {
      alert(res.error || 'Failed to approve indent.');
    }
  };

  const handleIssueItem = async (masterItemId: number) => {
    const qty = issueQtyMap[masterItemId];
    if (!qty || qty <= 0) {
      alert('Please specify a valid issue quantity.');
      return;
    }
    setIssuingLineId(masterItemId);

    // FEFO batch suggestion from issuing store
    const fefoRes = await getFEFOSuggestion(selectedIndent.to_store_id, masterItemId, qty);
    let issueLines: Array<{ item_id: number; batch_id?: number | null; quantity: number }> = [{ item_id: masterItemId, quantity: qty }];
    if (fefoRes.success && fefoRes.data?.allocations?.length) {
      issueLines = fefoRes.data.allocations.map(a => ({
        item_id: masterItemId,
        batch_id: a.batch_id,
        quantity: a.qty,
      }));
      setFefoHints(prev => ({
        ...prev,
        [masterItemId]: fefoRes.data!.allocations.map(a => `${a.batch_no}${a.expiry_date ? ` (exp ${new Date(a.expiry_date).toLocaleDateString()})` : ''}: ${a.qty}`).join(', '),
      }));
    }

    const res = await issueIndentItems(selectedIndent.id, issueLines);
    setIssuingLineId(null);
    if (res.success) {
      const detailRes = await getIndentById(selectedIndent.id);
      if (detailRes.success) {
        setSelectedIndent(detailRes.data);
        const initialMap: Record<number, number> = {};
        detailRes.data.items?.forEach((i: any) => {
          initialMap[i.item_id] = Math.max(0, (i.qty_requested || 0) - (i.qty_issued || 0));
        });
        setIssueQtyMap(initialMap);
      }
      loadData();
    } else {
      alert(res.error || 'Failed to issue item. Check supplying store stock.');
    }
  };

  const handleReceiveConfirm = async () => {
    if (!selectedIndent?.items?.length) return;
    setReceiving(true);
    const lines = selectedIndent.items
      .filter((i: any) => (i.qty_issued || 0) > (i.qty_received || 0))
      .map((i: any) => ({
        item_id: i.item_id,
        quantity: (i.qty_issued || 0) - (i.qty_received || 0),
      }));
    if (lines.length === 0) {
      setReceiving(false);
      alert('Nothing pending receipt.');
      return;
    }
    const res = await receiveConfirmIndent(selectedIndent.id, lines);
    setReceiving(false);
    if (res.success) {
      const detailRes = await getIndentById(selectedIndent.id);
      if (detailRes.success) setSelectedIndent(detailRes.data);
      loadData();
    } else {
      alert(res.error || 'Receipt confirmation failed.');
    }
  };

  return (
    <AdminPage 
      pageTitle="Internal Store Indents" 
      pageIcon={<FileText className="h-5 w-5" />} 
      onRefresh={loadData} 
      refreshing={loading}
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <p className="text-gray-500 text-sm mt-1">
            Request stock transfers, approve indents, and issue materials between hospital sub-stores and central stores.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium px-4 py-2.5 rounded-lg shadow-md transition-all cursor-pointer"
        >
          <Plus size={18} />
          New Indent Request
        </button>
      </div>

      {/* Toolbar Filter */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
        <div>
          <span className="text-sm text-gray-500">Total indents found: {indents.length}</span>
        </div>

        <div className="flex w-full md:w-auto items-center gap-4 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {QUICK_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
                  statusFilter === f.value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg text-sm text-gray-700 px-3 py-2 focus:outline-none focus:border-indigo-500 w-full md:w-44"
          >
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Submitted">Submitted</option>
            <option value="Approved">Approved</option>
            <option value="In Transit">In Transit</option>
            <option value="Partially Issued">Partially Issued</option>
            <option value="Completed">Completed</option>
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

      {/* Indents List Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : indents.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 border border-gray-200 rounded-xl">
          <FileText size={48} className="text-gray-400 mx-auto mb-3" />
          <p className="text-gray-900 text-lg font-medium">No indents found</p>
          <p className="text-gray-500 text-sm">Raise a new internal store indent request to transfer stock from central inventory.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Indent No</th>
                <th className="py-3 px-4">Stores (Req → Supply)</th>
                <th className="py-3 px-4">Urgency</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
              {indents.map((ind) => (
                <tr key={ind.id} className="hover:bg-gray-50">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">{ind.indent_number}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{ind.from_store?.name}</span>
                      <ArrowRightLeft size={12} className="text-gray-400" />
                      <span className="text-gray-500">{ind.to_store?.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${priorityClass(ind.priority)}`}>
                      {formatPriority(ind.priority)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      ind.status === 'Submitted' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                      ind.status === 'Approved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                      ind.status === 'Partially Issued' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                      ind.status === 'Completed' ? 'bg-teal-100 text-teal-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {ind.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-gray-500">
                    {new Date(ind.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => handleViewDetails(ind)}
                      className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1 mx-auto cursor-pointer"
                    >
                      <Eye size={14} /> View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Raise Indent Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-xl max-w-lg w-full relative z-10 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-900">New Store Indent Request</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-900 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateIndent} className="space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex gap-2">
                  <AlertCircle className="shrink-0 mt-0.5" size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Requesting Store</label>
                  <select
                    value={requestingStoreId}
                    onChange={(e) => setRequestingStoreId(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                    required
                  >
                    <option value="">Choose store...</option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.store_type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Supplying Store</label>
                  <select
                    value={supplyingStoreId}
                    onChange={(e) => setSupplyingStoreId(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                    required
                  >
                    <option value="">Choose store...</option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.store_type})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Urgency Level</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as any)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="Routine">Routine</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Remarks / Reason</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Brief notes..."
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                  />
                </div>
              </div>

              {/* Items Line Creator */}
              <div className="border-t border-gray-200 pt-4 mt-4 space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Add Materials Requested</h3>
                <div className="grid grid-cols-5 gap-2 items-end">
                  <div className="col-span-3">
                    <label className="block text-[10px] text-gray-500 mb-1">Select Material SKU</label>
                    <select
                      value={selectedItemId}
                      onChange={(e) => setSelectedItemId(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg text-xs text-gray-900 px-2.5 py-1.5 focus:outline-none"
                    >
                      <option value="">Choose item...</option>
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
                    onClick={addLineItem}
                    className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs px-3 py-2 rounded-lg font-medium"
                  >
                    Add
                  </button>
                </div>

                {/* Lines Review Table */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 max-h-36 overflow-y-auto">
                  {lines.length === 0 ? (
                    <p className="text-xs text-center py-4 text-gray-500">No line items added yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {lines.map((l, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white border border-gray-200 px-3 py-1.5 rounded text-xs text-gray-700">
                          <span>{l.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-gray-900">Qty: {l.qty}</span>
                            <button onClick={() => removeLineItem(idx)} className="text-rose-600 hover:text-rose-500">
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
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Indent Details & Action Modal */}
      {showViewModal && selectedIndent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowViewModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-xl max-w-2xl w-full relative z-10 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  Indent Request: <span className="text-indigo-600 font-mono">{selectedIndent.indent_number}</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Raised by: {selectedIndent.raised_by_user?.name || 'Automated'}</p>
              </div>
              <button onClick={() => setShowViewModal(false)} className="text-gray-500 hover:text-gray-900 transition">
                <X size={20} />
              </button>
            </div>

            {/* General Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 border border-gray-200 rounded-lg text-xs text-gray-700 mb-6">
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-bold">Req. Store</span>
                <span className="font-semibold text-gray-900">{selectedIndent.from_store?.name}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-bold">Supplying Store</span>
                <span className="font-semibold text-gray-900">{selectedIndent.to_store?.name}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-bold">Urgency</span>
                <span className="font-semibold text-gray-900">{formatPriority(selectedIndent.priority)}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-bold">Current Status</span>
                <span className="font-semibold text-gray-900">{selectedIndent.status}</span>
              </div>
            </div>

            {['In Transit', 'Partially Issued'].includes(selectedIndent.status) && (
              <div className="mb-4 flex justify-end">
                <button
                  onClick={handleReceiveConfirm}
                  disabled={receiving}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-4 py-2 rounded-lg transition disabled:opacity-50"
                >
                  {receiving ? 'Confirming...' : 'Confirm Receipt'}
                </button>
              </div>
            )}

            {selectedIndent.status === 'Submitted' && (
              <div className="mb-4 flex justify-end">
                <button
                  onClick={handleApproveIndent}
                  disabled={approving}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2 rounded-lg transition disabled:opacity-50"
                >
                  {approving ? 'Approving...' : 'Approve Indent'}
                </button>
              </div>
            )}

            {/* Line Items Table with Issuing Action */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Package size={16} className="text-indigo-600" /> Material Details
              </h3>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Item Details</th>
                      <th className="py-2.5 px-3 text-right">Req. Qty</th>
                      <th className="py-2.5 px-3 text-right">Issued Qty</th>
                      {['Approved', 'Partially Issued'].includes(selectedIndent.status) && (
                        <th className="py-2.5 px-3 text-center w-52">Material Issue Dispatch</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-700">
                    {selectedIndent.items?.map((item: any) => {
                      const pending = (item.qty_approved || item.qty_requested) - (item.qty_issued || 0);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-gray-900">{item.item?.name}</div>
                            <div className="text-[10px] text-gray-500">{item.item?.item_code} | UOM: {item.item?.base_uom}</div>
                            {fefoHints[item.item_id] && (
                              <div className="text-[10px] text-indigo-600 mt-0.5">FEFO: {fefoHints[item.item_id]}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-medium text-gray-900">{item.qty_requested}</td>
                          <td className="py-3 px-3 text-right text-gray-500">{item.qty_issued || 0}</td>
                          {['Approved', 'Partially Issued'].includes(selectedIndent.status) && (
                            <td className="py-3 px-3 text-center">
                              {pending <= 0 ? (
                                <span className="inline-flex bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                  <Check size={10} className="mr-0.5" /> Fulfilled
                                </span>
                              ) : (
                                <div className="flex items-center gap-1 justify-center">
                                  <input
                                    type="number"
                                    min="1"
                                    max={pending}
                                    value={issueQtyMap[item.item_id] || ''}
                                    onChange={(e) => setIssueQtyMap({ ...issueQtyMap, [item.item_id]: parseInt(e.target.value) || 0 })}
                                    className="bg-white border border-gray-200 rounded px-1.5 py-1 text-center w-14 text-gray-900 text-xs"
                                  />
                                  <button
                                    onClick={() => handleIssueItem(item.item_id)}
                                    disabled={issuingLineId === item.item_id}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[10px] px-2.5 py-1.5 rounded transition disabled:opacity-50 cursor-pointer"
                                  >
                                    {issuingLineId === item.item_id ? 'Dispatching' : 'Dispatch'}
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
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
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
