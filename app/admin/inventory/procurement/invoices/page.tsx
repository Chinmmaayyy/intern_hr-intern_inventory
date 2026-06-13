'use client';
import { useEffect, useState } from 'react';
import {
  listPurchaseOrders,
  listGRNs,
  createPurchaseInvoice,
  approvePurchaseInvoiceVariance,
} from '@/app/actions/procurement-actions';
import { AdminPage } from '@/app/admin/components/AdminPage';
import { FileText, RefreshCw, CheckCircle2, AlertTriangle, X } from 'lucide-react';

export default function PurchaseInvoicesPage() {
  const [pendingPOs, setPendingPOs] = useState<any[]>([]);
  const [invoicedPOs, setInvoicedPOs] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [selectedGrnId, setSelectedGrnId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [matchError, setMatchError] = useState('');

  const loadData = async () => {
    setLoading(true);
    const [receivedRes, invoicedRes, grnRes] = await Promise.all([
      listPurchaseOrders({ status: 'Received' }),
      listPurchaseOrders({ status: 'Invoiced' }),
      listGRNs({ limit: 100 }),
    ]);
    if (receivedRes.success) setPendingPOs(receivedRes.data?.orders || []);
    if (invoicedRes.success) setInvoicedPOs(invoicedRes.data?.orders || []);
    if (grnRes.success) setGrns(grnRes.data?.grns || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openMatchModal = (po: any) => {
    setSelectedPO(po);
    setSelectedGrnId('');
    setInvoiceNumber(`INV-${po.po_number}-${Date.now().toString().slice(-4)}`);
    setMatchError('');
    setShowMatchModal(true);
  };

  const poGrns = grns.filter(g => g.po_id === selectedPO?.id);

  const handleThreeWayMatch = async () => {
    if (!selectedPO || !selectedGrnId || !invoiceNumber) {
      setMatchError('PO, GRN, and invoice number are required.');
      return;
    }
    setMatching(true);
    setMatchError('');
    const res = await createPurchaseInvoice({
      poId: selectedPO.id,
      grnId: parseInt(selectedGrnId, 10),
      invoiceNumber,
      invoiceDate: new Date(invoiceDate).toISOString(),
      lineItems: selectedPO.items.map((i: any) => ({
        item_id: i.item_id,
        medicine_id: i.medicine_id,
        quantity: i.quantity_received ?? i.quantity_ordered,
        unit_price: i.unit_price,
        gst_rate: i.gst_rate,
      })),
    });
    setMatching(false);
    if (res.success) {
      setShowMatchModal(false);
      loadData();
      if (res.data?.status === 'PendingApproval') {
        alert('Invoice created but requires finance variance approval due to PO/GRN/invoice mismatch.');
      } else {
        alert('3-way match complete. Invoice posted to GL.');
      }
    } else {
      setMatchError(res.error || '3-way match failed.');
    }
  };

  const handleApproveVariance = async (invoiceId: number) => {
    const res = await approvePurchaseInvoiceVariance(invoiceId);
    if (res.success) {
      alert('Variance approved and invoice posted.');
      loadData();
    } else {
      alert(res.error || 'Failed to approve variance.');
    }
  };

  return (
    <AdminPage pageTitle="Purchase Invoices & 3-Way Match" pageIcon={<FileText className="h-5 w-5" />} onRefresh={loadData} refreshing={loading}>
      <p className="text-sm text-gray-500 mb-6">
        Match Purchase Order → GRN → Vendor Invoice. Variances within tolerance auto-post; larger variances require finance approval.
      </p>

      <h3 className="text-sm font-bold text-gray-900 mb-3">POs Ready for 3-Way Match ({pendingPOs.length})</h3>
      {pendingPOs.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 border border-gray-200 rounded-xl mb-8">
          <p className="text-gray-500 text-sm">No received POs awaiting invoice matching.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-[11px] font-bold text-gray-500 uppercase">
                <th className="py-3 px-4 text-left">PO Number</th>
                <th className="py-3 px-4 text-left">Vendor</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pendingPOs.map(po => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono font-bold text-indigo-600">{po.po_number}</td>
                  <td className="py-3 px-4">{po.vendor?.vendor_name || '—'}</td>
                  <td className="py-3 px-4 text-right font-bold">₹{Number(po.total_amount || 0).toLocaleString('en-IN')}</td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => openMatchModal(po)} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-semibold">
                      3-Way Match
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="text-sm font-bold text-gray-900 mb-3">Posted Invoices ({invoicedPOs.length})</h3>
      {invoicedPOs.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 border border-gray-200 rounded-xl">
          <FileText size={40} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No posted purchase invoices yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-[11px] font-bold text-gray-500 uppercase">
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoicedPOs.map(po => (
                <tr key={po.id}>
                  <td className="py-3 px-4 font-mono text-indigo-600">{po.po_number}</td>
                  <td className="py-3 px-4">{po.vendor?.vendor_name}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={12} /> Invoiced
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold">₹{Number(po.total_amount || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showMatchModal && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMatchModal(false)} />
          <div className="bg-white rounded-xl max-w-md w-full relative z-10 p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-gray-900">3-Way Match: {selectedPO.po_number}</h2>
              <button onClick={() => setShowMatchModal(false)}><X size={20} /></button>
            </div>
            {matchError && (
              <div className="mb-3 p-3 bg-rose-50 text-rose-700 text-sm rounded-lg flex gap-2">
                <AlertTriangle size={16} className="shrink-0" /> {matchError}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">GRN</label>
                <select value={selectedGrnId} onChange={e => setSelectedGrnId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                  <option value="">Select GRN...</option>
                  {poGrns.map(g => (
                    <option key={g.id} value={g.id}>{g.grn_number} — ₹{Number(g.total_amount || 0).toLocaleString('en-IN')}</option>
                  ))}
                </select>
                {poGrns.length === 0 && <p className="text-xs text-amber-600 mt-1">No GRN found for this PO. Create a GRN first.</p>}
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Vendor Invoice Number</label>
                <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Invoice Date</label>
                <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowMatchModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleThreeWayMatch} disabled={matching || !selectedGrnId} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                {matching ? 'Matching...' : 'Match & Post Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
