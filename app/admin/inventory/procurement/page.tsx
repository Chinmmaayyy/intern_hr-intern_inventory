'use client';
import { useEffect, useState } from 'react';
import {
  listPurchaseOrders, getPurchaseOrderById, createPurchaseOrder,
  createPurchaseOrderFromPR, approvePurchaseOrder, sendPurchaseOrder,
  listRequisitions, listVendors
} from '@/app/actions/procurement-actions';
import { listItems } from '@/app/actions/item-master-actions';
import { listStores } from '@/app/actions/store-actions';
import {
  FileText, Plus, RefreshCw, X, AlertCircle, Eye,
  ShoppingBag, Check, Trash2, CheckCircle2, Send
} from 'lucide-react';
import { AdminPage } from '@/app/admin/components/AdminPage';

const STATUS_BADGE: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600 border-gray-200',
  Approved: 'bg-blue-100 text-blue-700 border-blue-200',
  Ordered: 'bg-amber-100 text-amber-700 border-amber-200',
  'Partially Received': 'bg-orange-100 text-orange-700 border-orange-200',
  Received: 'bg-green-100 text-green-700 border-green-200',
  Invoiced: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-red-100 text-red-700 border-red-200',
};

export default function ProcurementPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [approvedPRs, setApprovedPRs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // View PO Modal
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // Create PO Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState<'from-pr' | 'direct'>('direct');
  const [submittingPO, setSubmittingPO] = useState(false);
  const [formError, setFormError] = useState('');

  // "From PR" form
  const [selectedPRId, setSelectedPRId] = useState('');
  const [prVendorId, setPrVendorId] = useState('');

  // "Direct PO" form
  const [directVendorId, setDirectVendorId] = useState('');
  const [directStoreId, setDirectStoreId] = useState('');
  const [directLines, setDirectLines] = useState<Array<{ item_id: number; name: string; qty: number; price: number }>>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [lineQty, setLineQty] = useState(1);
  const [linePrice, setLinePrice] = useState(0);

  const loadData = async () => {
    setLoading(true);
    const [poRes, prRes, vendorRes, itemRes, storeRes] = await Promise.all([
      listPurchaseOrders({ status: statusFilter }),
      listRequisitions({ status: 'Approved' }),
      listVendors(),
      listItems({ status: 'Active', limit: 200 }),
      listStores(),
    ]);
    if (poRes.success) setOrders(poRes.data?.orders || []);
    if (prRes.success) setApprovedPRs(prRes.data?.requisitions || []);
    if (vendorRes.success) setVendors(vendorRes.data || []);
    if (itemRes.success) setAllItems(itemRes.data?.items || []);
    if (storeRes.success) setStores(storeRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [statusFilter]);

  const addDirectLine = () => {
    if (!selectedItemId || lineQty <= 0 || linePrice < 0) return;
    const item = allItems.find(i => i.id === parseInt(selectedItemId));
    if (!item) return;
    if (directLines.some(l => l.item_id === item.id)) {
      alert('Item already added.'); return;
    }
    setDirectLines([...directLines, { item_id: item.id, name: item.name, qty: lineQty, price: linePrice }]);
    setSelectedItemId(''); setLineQty(1); setLinePrice(0);
  };

  const handleCreateFromPR = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!selectedPRId || !prVendorId) {
      setFormError('Select an approved requisition and a vendor.'); return;
    }
    setSubmittingPO(true);
    const res = await createPurchaseOrderFromPR(parseInt(selectedPRId), parseInt(prVendorId));
    setSubmittingPO(false);
    if (res.success) { setShowCreateModal(false); loadData(); setSelectedPRId(''); setPrVendorId(''); }
    else setFormError(res.error || 'Failed to create PO.');
  };

  const handleCreateDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!directVendorId) { setFormError('Select a vendor.'); return; }
    if (directLines.length === 0) { setFormError('Add at least one item line.'); return; }
    setSubmittingPO(true);
    const res = await createPurchaseOrder({
      vendor_id: parseInt(directVendorId),
      receiving_store_id: directStoreId ? parseInt(directStoreId) : null,
      items: directLines.map(l => ({ item_id: l.item_id, quantity_ordered: l.qty, unit_price: l.price, gst_rate: 0 })),
    });
    setSubmittingPO(false);
    if (res.success) {
      setShowCreateModal(false);
      loadData();
      setDirectVendorId(''); setDirectStoreId(''); setDirectLines([]);
    } else setFormError(res.error || 'Failed to create PO.');
  };

  const handleApprovePO = async (poId: number) => {
    setActionLoading(poId);
    const res = await approvePurchaseOrder(poId);
    setActionLoading(null);
    if (res.success) { loadData(); }
    else alert(res.error || 'Failed to approve PO.');
  };

  const handleSendPO = async (poId: number) => {
    setActionLoading(poId);
    const res = await sendPurchaseOrder(poId);
    setActionLoading(null);
    if (res.success) { loadData(); }
    else alert(res.error || 'Failed to send PO.');
  };

  const handleOpenDetails = async (po: any) => {
    const res = await getPurchaseOrderById(po.id);
    if (res.success) { setSelectedPO(res.data); setShowViewModal(true); }
  };

  return (
    <AdminPage
      pageTitle="Purchase Orders & Sourcing"
      pageIcon={<ShoppingBag className="h-5 w-5" />}
      onRefresh={loadData}
      refreshing={loading}
      headerActions={
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium px-4 py-2.5 rounded-lg shadow-md transition-all cursor-pointer"
        >
          <Plus size={18} />
          Create Purchase Order
        </button>
      }
    >
      <div className="text-gray-500 text-sm mb-4">
        Create vendor Purchase Orders directly or from approved requisitions. Approve, send to vendor, receive GRN, and execute 3-way matching.
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between mb-5 shadow-sm">
        <span className="text-sm text-gray-500">Total Purchase Orders: {orders.length}</span>
        <div className="flex w-full md:w-auto items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 px-3 py-2 focus:outline-none focus:border-indigo-500 w-full md:w-52"
          >
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Approved">Approved</option>
            <option value="Ordered">Ordered (Pending GRN)</option>
            <option value="Partially Received">Partially Received</option>
            <option value="Received">Fully Received</option>
            <option value="Invoiced">Invoiced</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <button onClick={loadData} className="p-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg transition">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* PO List Table */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <ShoppingBag size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg font-medium">No purchase orders found</p>
          <p className="text-gray-400 text-sm">Create a PO directly or convert an approved requisition.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Total Value</th>
                <th className="py-3 px-4">Order Date</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {orders.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">{po.po_number}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-gray-900">{po.vendor?.vendor_name || '—'}</div>
                    <div className="text-xs text-gray-400">{po.vendor?.vendor_code}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_BADGE[po.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-gray-900">₹{Number(po.total_amount || 0).toLocaleString('en-IN')}</td>
                  <td className="py-3.5 px-4 text-gray-500">{new Date(po.order_date || po.created_at).toLocaleDateString()}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-center gap-2">
                      {po.status === 'Draft' && (
                        <button
                          onClick={() => handleApprovePO(po.id)}
                          disabled={actionLoading === po.id}
                          className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg transition disabled:opacity-50 cursor-pointer"
                        >
                          <CheckCircle2 size={13} /> Approve
                        </button>
                      )}
                      {po.status === 'Approved' && (
                        <button
                          onClick={() => handleSendPO(po.id)}
                          disabled={actionLoading === po.id}
                          className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-lg transition disabled:opacity-50 cursor-pointer"
                        >
                          <Send size={13} /> Send/Order
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenDetails(po)}
                        className="flex items-center gap-1 text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        <Eye size={13} /> View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create PO Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-xl max-w-2xl w-full relative z-10 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-900">Create Purchase Order</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-900 transition"><X size={20} /></button>
            </div>

            {/* Mode Tabs */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden mb-5">
              <button
                onClick={() => setCreateMode('direct')}
                className={`flex-1 text-sm py-2.5 font-medium transition ${createMode === 'direct' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Direct PO (with Items)
              </button>
              <button
                onClick={() => setCreateMode('from-pr')}
                className={`flex-1 text-sm py-2.5 font-medium transition ${createMode === 'from-pr' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                From Approved PR
              </button>
            </div>

            {formError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-lg flex gap-2 mb-4">
                <AlertCircle className="shrink-0 mt-0.5" size={16} />
                <span>{formError}</span>
              </div>
            )}

            {createMode === 'from-pr' ? (
              <form onSubmit={handleCreateFromPR} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Approved Requisition</label>
                  <select
                    value={selectedPRId}
                    onChange={(e) => setSelectedPRId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                    required
                  >
                    <option value="">Choose Requisition...</option>
                    {approvedPRs.map(pr => (
                      <option key={pr.id} value={pr.id}>{pr.pr_number} — Store: {pr.store?.name}</option>
                    ))}
                  </select>
                  {approvedPRs.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">No approved requisitions found. Create and approve a PR first.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Vendor</label>
                  <select value={prVendorId} onChange={(e) => setPrVendorId(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" required>
                    <option value="">Choose Vendor...</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_name} ({v.vendor_code})</option>)}
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={submittingPO} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm transition disabled:opacity-50">{submittingPO ? 'Creating...' : 'Create PO from PR'}</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateDirect} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Vendor *</label>
                    <select value={directVendorId} onChange={(e) => setDirectVendorId(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" required>
                      <option value="">Choose Vendor...</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_name} ({v.vendor_code})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Receiving Store</label>
                    <select value={directStoreId} onChange={(e) => setDirectStoreId(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900">
                      <option value="">Select Store (optional)</option>
                      {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Add item lines */}
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Order Lines</h3>
                  <div className="grid grid-cols-12 gap-2 items-end mb-2">
                    <div className="col-span-5">
                      <label className="block text-[10px] text-gray-500 mb-1">Item *</label>
                      <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg text-xs text-gray-900 px-2.5 py-1.5 focus:outline-none">
                        <option value="">Choose item...</option>
                        {allItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.base_uom})</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-gray-500 mb-1">Qty</label>
                      <input type="number" min="1" value={lineQty} onChange={(e) => setLineQty(parseInt(e.target.value) || 1)} className="w-full bg-white border border-gray-200 rounded-lg text-xs text-gray-900 px-2.5 py-1.5" />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[10px] text-gray-500 mb-1">Unit Price (₹)</label>
                      <input type="number" min="0" step="0.01" value={linePrice} onChange={(e) => setLinePrice(parseFloat(e.target.value) || 0)} className="w-full bg-white border border-gray-200 rounded-lg text-xs text-gray-900 px-2.5 py-1.5" />
                    </div>
                    <button type="button" onClick={addDirectLine} className="col-span-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium">Add</button>
                  </div>

                  {directLines.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-gray-100 border-b border-gray-200 text-gray-500 font-bold">
                          <th className="p-2.5 text-left">Item</th>
                          <th className="p-2.5 text-right">Qty</th>
                          <th className="p-2.5 text-right">Price</th>
                          <th className="p-2.5 text-right">Total</th>
                          <th className="p-2.5"></th>
                        </tr></thead>
                        <tbody className="divide-y divide-gray-200">
                          {directLines.map((l, idx) => (
                            <tr key={idx} className="hover:bg-gray-100">
                              <td className="p-2.5 font-medium text-gray-900">{l.name}</td>
                              <td className="p-2.5 text-right">{l.qty}</td>
                              <td className="p-2.5 text-right">₹{l.price.toFixed(2)}</td>
                              <td className="p-2.5 text-right font-semibold text-indigo-600">₹{(l.qty * l.price).toFixed(2)}</td>
                              <td className="p-2.5 text-right">
                                <button type="button" onClick={() => setDirectLines(directLines.filter((_, i) => i !== idx))} className="text-rose-500 hover:text-rose-700"><Trash2 size={13} /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot><tr className="border-t-2 border-gray-300 bg-gray-100">
                          <td colSpan={3} className="p-2.5 font-bold text-gray-700 text-right">Grand Total:</td>
                          <td className="p-2.5 text-right font-bold text-indigo-700">₹{directLines.reduce((s, l) => s + l.qty * l.price, 0).toFixed(2)}</td>
                          <td></td>
                        </tr></tfoot>
                      </table>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={submittingPO} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm transition disabled:opacity-50">{submittingPO ? 'Creating...' : 'Create Purchase Order'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* View PO Modal */}
      {showViewModal && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowViewModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-xl max-w-3xl w-full relative z-10 p-6 shadow-2xl overflow-y-auto max-h-[95vh]">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Purchase Order: <span className="text-indigo-600 font-mono">{selectedPO.po_number}</span></h2>
                <p className="text-xs text-gray-500 mt-0.5">Vendor: {selectedPO.vendor?.vendor_name} ({selectedPO.vendor?.vendor_code})</p>
              </div>
              <button onClick={() => setShowViewModal(false)} className="text-gray-500 hover:text-gray-900 transition"><X size={20} /></button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 border border-gray-200 rounded-lg text-xs text-gray-700 mb-6">
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-bold">Total Value</span>
                <span className="font-bold text-gray-900">₹{Number(selectedPO.total_amount).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-bold">Status</span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_BADGE[selectedPO.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>{selectedPO.status}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-bold">Receiving Store</span>
                <span className="font-semibold text-gray-900">{selectedPO.receiving_store?.name || 'Not set'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-bold">Items</span>
                <span className="font-semibold text-gray-900">{selectedPO.items?.length ?? 0} line(s)</span>
              </div>
            </div>

            {/* Action Buttons in modal */}
            {selectedPO.status === 'Draft' && (
              <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-800">This PO is in Draft — awaiting approval</p>
                  <p className="text-xs text-amber-600 mt-0.5">Approve it to enable sending to vendor and GRN processing.</p>
                </div>
                <button
                  onClick={async () => { await handleApprovePO(selectedPO.id); setShowViewModal(false); }}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  <CheckCircle2 size={16} /> Approve PO
                </button>
              </div>
            )}
            {selectedPO.status === 'Approved' && (
              <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-800">PO Approved — ready to send to vendor</p>
                  <p className="text-xs text-blue-600 mt-0.5">Send to vendor to place order and enable GRN processing.</p>
                </div>
                <button
                  onClick={async () => { await handleSendPO(selectedPO.id); setShowViewModal(false); }}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  <Send size={16} /> Send / Place Order
                </button>
              </div>
            )}

            {/* Line Items */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Order Lines</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-100/50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Item</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Ordered Qty</th>
                      <th className="py-2.5 px-3 text-right">Received Qty</th>
                      <th className="py-2.5 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-700">
                    {selectedPO.items?.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-100/50">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-gray-900">{item.item?.name}</div>
                          <div className="text-[10px] text-gray-500">{item.item?.item_code} | {item.item?.base_uom}</div>
                        </td>
                        <td className="py-3 px-3 text-right text-gray-600">₹{Number(item.unit_price).toFixed(2)}</td>
                        <td className="py-3 px-3 text-right font-medium text-gray-900">{item.quantity_ordered}</td>
                        <td className="py-3 px-3 text-right font-medium text-emerald-700">{item.quantity_received ?? 0}</td>
                        <td className="py-3 px-3 text-right font-semibold text-indigo-600">₹{(item.quantity_ordered * item.unit_price).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t border-gray-200 mt-6">
              <button onClick={() => setShowViewModal(false)} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2 rounded-lg text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
