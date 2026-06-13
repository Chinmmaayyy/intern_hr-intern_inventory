'use client';
import { useEffect, useState } from 'react';
import { listPurchaseOrders, getPurchaseOrderById } from '@/app/actions/procurement-actions';
import { AdminPage } from '@/app/admin/components/AdminPage';
import {
  FileText, RefreshCw, Eye, CheckCircle2, X
} from 'lucide-react';

export default function PurchaseInvoicesPage() {
  const [invoicedPOs, setInvoicedPOs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const res = await listPurchaseOrders({ status: 'Invoiced' });
    if (res.success) setInvoicedPOs(res.data?.orders || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleOpenDetails = async (po: any) => {
    const res = await getPurchaseOrderById(po.id);
    if (res.success) {
      setSelectedPO(res.data);
      setShowViewModal(true);
    }
  };

  return (
    <AdminPage
      pageTitle="Purchase Invoices"
      pageIcon={<FileText className="h-5 w-5" />}
      onRefresh={loadData}
      refreshing={loading}
    >
      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500">Total Billed Invoices: {invoicedPOs.length}</span>
        <button
          onClick={loadData}
          className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-lg transition"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : invoicedPOs.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 border border-gray-200 rounded-xl">
          <FileText size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 text-lg font-medium">No purchase invoices found</p>
          <p className="text-gray-500 text-sm">Perform 3-way matching on ordered purchase orders to generate purchase invoice postings.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Vendor Partner</th>
                <th className="py-3 px-4">Matched Status</th>
                <th className="py-3 px-4 text-right">Billed Value</th>
                <th className="py-3 px-4">Order Date</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-700">
              {invoicedPOs.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">{po.po_number}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-gray-900">{po.vendor?.vendor_name || 'Generic Vendor'}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={12} /> Billed / Posted
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-gray-900">₹{Number(po.total_amount || 0).toLocaleString('en-IN')}</td>
                  <td className="py-3.5 px-4 text-gray-500">{new Date(po.order_date).toLocaleDateString()}</td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => handleOpenDetails(po)}
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

      {/* Details View Modal */}
      {showViewModal && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowViewModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full relative z-10 p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                Invoice Details: <span className="text-indigo-600 font-mono">{selectedPO.po_number}</span>
              </h2>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-700 transition">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 border border-gray-200 rounded-xl text-xs text-gray-500 mb-6">
              <div>
                <span className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Vendor Name</span>
                <span className="font-semibold text-gray-900">{selectedPO.vendor?.vendor_name}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Billing Value</span>
                <span className="font-bold text-emerald-600">₹{Number(selectedPO.total_amount).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Order Settle Date</span>
                <span className="font-semibold text-gray-900">{new Date(selectedPO.order_date).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-400 uppercase font-bold mb-1">GL Posting Status</span>
                <span className="font-semibold text-emerald-600">Balanced Ledger Journal Posted</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Billed Line Items</h3>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                      <th className="p-2.5">Item Name</th>
                      <th className="p-2.5 text-right">Qty Billed</th>
                      <th className="p-2.5 text-right">Unit Price</th>
                      <th className="p-2.5 text-right">Total Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-700">
                    {selectedPO.items?.map((itm: any) => (
                      <tr key={itm.id}>
                        <td className="p-2.5 font-semibold text-gray-900">{itm.item?.name || `Item ${itm.item_id}`}</td>
                        <td className="p-2.5 text-right font-bold text-gray-900">{itm.quantity_ordered}</td>
                        <td className="p-2.5 text-right text-gray-500">₹{Number(itm.unit_price || 0).toFixed(2)}</td>
                        <td className="p-2.5 text-right font-bold text-indigo-600">₹{Number((itm.quantity_ordered || 0) * (itm.unit_price || 0)).toFixed(2)}</td>
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
                className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-xl text-sm"
              >
                Close details
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
