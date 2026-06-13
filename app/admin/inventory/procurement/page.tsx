'use client';
import { useEffect, useState } from 'react';
import { listPurchaseOrders, getPurchaseOrderById, createPurchaseOrderFromPR, performThreeWayMatchAndInvoice, listRequisitions } from '@/app/actions/procurement-actions';
import {
  FileText, Search, Plus, Filter, RefreshCw, X, AlertCircle, Eye,
  CheckCircle2, Box, Calendar, ShoppingBag, Landmark, ArrowRight, Check
} from 'lucide-react';
import { AdminPage } from '@/app/admin/components/AdminPage';

export default function ProcurementPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [approvedPRs, setApprovedPRs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // Selected PO Modal Details
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [matching, setMatching] = useState(false);

  // Match Params Form
  const [grnNumber, setGrnNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');

  // Create PO Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submittingPO, setSubmittingPO] = useState(false);
  const [formError, setFormError] = useState('');
  const [selectedPRId, setSelectedPRId] = useState('');
  const [vendorId, setVendorId] = useState('');

  // Dummy vendors list for simplicity
  const vendors = [
    { id: 1, name: 'MedLabs Global Distributors', code: 'VEND-001' },
    { id: 2, name: 'Apex Clinical Consumables Corp', code: 'VEND-002' },
    { id: 3, name: 'SurgiKraft Instruments Pvt Ltd', code: 'VEND-003' }
  ];

  const loadData = async () => {
    setLoading(true);
    const [poRes, prRes] = await Promise.all([
      listPurchaseOrders({ status: statusFilter }),
      listRequisitions({ status: 'Approved' })
    ]);
    if (poRes.success) setOrders(poRes.data?.orders || []);
    if (prRes.success) setApprovedPRs(prRes.data?.requisitions || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!selectedPRId || !vendorId) {
      setFormError('Please select an approved Requisition and Sourcing Vendor.');
      return;
    }

    setSubmittingPO(true);
    const res = await createPurchaseOrderFromPR(parseInt(selectedPRId), parseInt(vendorId));
    setSubmittingPO(false);

    if (res.success) {
      setShowCreateModal(false);
      loadData();
      setSelectedPRId('');
      setVendorId('');
    } else {
      setFormError(res.error || 'Failed to create Purchase Order.');
    }
  };

  const handleOpenDetails = async (po: any) => {
    const res = await getPurchaseOrderById(po.id);
    if (res.success) {
      setSelectedPO(res.data);
      // Reset match inputs
      setGrnNumber('');
      setInvoiceNumber('');
      setInvoiceDate('');
      setShowViewModal(true);
    }
  };

  const handlePerformMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grnNumber || !invoiceNumber || !invoiceDate) {
      alert('GRN Number, Invoice Number, and Invoice Date are required for 3-way matching.');
      return;
    }

    setMatching(true);
    const res = await performThreeWayMatchAndInvoice(
      selectedPO.id,
      grnNumber.trim(),
      invoiceNumber.trim(),
      invoiceDate
    );
    setMatching(false);

    if (res.success) {
      alert('3-Way Match Verified! Invoices generated and GL ledger posted successfully.');
      setShowViewModal(false);
      loadData();
    } else {
      alert(res.error || 'Failed to verify match.');
    }
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
        Convert requisitions to Vendor Purchase Orders (PO), process Goods Receipt Notes (GRN), and execute automated 3-way matches.
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div>
          <span className="text-sm text-gray-500">Total Purchase Orders: {orders.length}</span>
        </div>

        <div className="flex w-full md:w-auto items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 px-3 py-2 focus:outline-none focus:border-indigo-500 w-full md:w-44"
          >
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Ordered">Ordered (Pending GRN)</option>
            <option value="Fully Received">Fully Received</option>
            <option value="Invoiced">Fully Billed / Invoiced</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* PO List Table */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 border border-gray-200 rounded-xl">
          <ShoppingBag size={48} className="text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 text-lg font-medium">No purchase orders found</p>
          <p className="text-gray-400 text-sm">Release purchase orders to vendors to procure clinical materials and consumables.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Vendor Partner</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Total Sourced</th>
                <th className="py-3 px-4">Order Date</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
              {orders.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">{po.po_number}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-gray-900">{po.vendor?.vendor_name || 'Generic Vendor'}</div>
                    <div className="text-xs text-gray-500">Code: {po.vendor?.vendor_code || 'VEND-001'}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      po.status === 'Draft' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25' :
                      po.status === 'Ordered' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25' :
                      po.status === 'Fully Received' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/25' :
                      po.status === 'Invoiced' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-gray-900">₹{Number(po.total_amount || 0).toLocaleString('en-IN')}</td>
                  <td className="py-3.5 px-4 text-gray-500">
                    {new Date(po.order_date).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => handleOpenDetails(po)}
                      className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1 mx-auto cursor-pointer"
                    >
                      <Eye size={14} /> Review PO
                    </button>
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
          <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full relative z-10 p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-900">Convert PR to Purchase Order</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-900 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-lg flex gap-2">
                  <AlertCircle className="shrink-0 mt-0.5" size={16} />
                  <span>{formError}</span>
                </div>
              )}

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
                    <option key={pr.id} value={pr.id}>
                      {pr.pr_number} — Store: {pr.store?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Sourcing Vendor Partner</label>
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                  required
                >
                  <option value="">Choose Vendor...</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                  ))}
                </select>
              </div>

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
                  disabled={submittingPO}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm transition"
                >
                  {submittingPO ? 'Processing...' : 'Sourcing Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View & 3-way Matching Action Modal */}
      {showViewModal && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowViewModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-xl max-w-3xl w-full relative z-10 p-6 shadow-2xl overflow-y-auto max-h-[95vh]">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  Purchase Order: <span className="text-indigo-600 font-mono">{selectedPO.po_number}</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Sourcing Partner: {selectedPO.vendor?.vendor_name} ({selectedPO.vendor?.vendor_code})</p>
              </div>
              <button onClick={() => setShowViewModal(false)} className="text-gray-500 hover:text-gray-900 transition">
                <X size={20} />
              </button>
            </div>

            {/* General Box */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 border border-gray-200 rounded-lg text-xs text-gray-700 mb-6">
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-bold">Total Ordered Value</span>
                <span className="font-bold text-gray-900">₹{Number(selectedPO.total_amount).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-bold">Created Date</span>
                <span className="font-semibold text-gray-900">{new Date(selectedPO.order_date).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-bold">PO Status</span>
                <span className="font-semibold text-gray-900">{selectedPO.status}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-bold">Delivery Location</span>
                <span className="font-semibold text-gray-900">CENTRAL STORE</span>
              </div>
            </div>

            {/* 3-Way Match Verification Section */}
            {selectedPO.status === 'Ordered' && (
              <div className="bg-indigo-50/50 border border-indigo-200 p-5 rounded-xl space-y-4 mb-6">
                <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-2">
                  <Landmark size={15} /> Execute Three-Way Matching & Invoicing
                </h3>
                <p className="text-xs text-gray-600">
                  Ensure the physical item quantities received in the Goods Receipt Note (GRN) match vendor's physical Invoice values and initial Purchase Order prices.
                </p>

                <form onSubmit={handlePerformMatch} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Verify GRN Number</label>
                    <input
                      type="text"
                      placeholder="e.g. GRN-001"
                      value={grnNumber}
                      onChange={(e) => setGrnNumber(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Vendor Invoice Number</label>
                    <input
                      type="text"
                      placeholder="e.g. INV-2026-902"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Invoice Settle Date</label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={matching}
                    className="col-span-1 md:col-span-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check size={14} /> {matching ? 'Validating 3-Way Match...' : 'Reconcile 3-Way Match & Post GL'}
                  </button>
                </form>
              </div>
            )}

            {/* Line Items */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Purchase Order Items list</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-100/50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Item Details</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Quantity Ordered</th>
                      <th className="py-2.5 px-3 text-right">Total Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-700">
                    {selectedPO.items?.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-100/50">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-gray-900">{item.item?.name}</div>
                          <div className="text-[10px] text-gray-500">{item.item?.item_code} | UOM: {item.item?.base_uom}</div>
                        </td>
                        <td className="py-3 px-3 text-right text-gray-500">₹{Number(item.unit_price).toFixed(2)}</td>
                        <td className="py-3 px-3 text-right font-medium text-gray-900">{item.quantity_ordered}</td>
                        <td className="py-3 px-3 text-right font-semibold text-indigo-600">₹{(item.quantity_ordered * item.unit_price).toFixed(2)}</td>
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
                Close PO Details
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
