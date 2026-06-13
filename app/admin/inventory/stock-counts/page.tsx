'use client';
import { useEffect, useState } from 'react';
import { listItems } from '@/app/actions/item-master-actions';
import { listStores } from '@/app/actions/store-actions';
import { listCountSessions, createStockCountSession, getStockCountSessionById, updateCountLine, approveCountSession } from '@/app/actions/stock-actions';
import { AdminPage } from '@/app/admin/components/AdminPage';
import {
  ClipboardList, Search, Plus, Filter, RefreshCw, X, AlertCircle, Eye,
  CheckCircle2, Box, Calendar, PlusCircle, Trash, Check, User
} from 'lucide-react';

export default function StockCountsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // Selected Count Session Details
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [recordedQtyMap, setRecordedQtyMap] = useState<Record<number, number>>({});
  const [updatingLineId, setUpdatingLineId] = useState<number | null>(null);
  const [adjusting, setAdjusting] = useState(false);

  // Create Count Session Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submittingSession, setSubmittingSession] = useState(false);
  const [formError, setFormError] = useState('');
  const [storeId, setStoreId] = useState('');
  const [notes, setNotes] = useState('');

  const loadSessions = async () => {
    setLoading(true);
    const [sessRes, storeRes] = await Promise.all([
      listCountSessions({ status: statusFilter }),
      listStores()
    ]);
    if (sessRes.success) setSessions(sessRes.data || []);
    if (storeRes.success) setStores(storeRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadSessions();
  }, [statusFilter]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!storeId) {
      setFormError('Please select a store to conduct physical stock audit count.');
      return;
    }

    setSubmittingSession(true);
    const res = await createStockCountSession(parseInt(storeId));
    setSubmittingSession(false);

    if (res.success) {
      setShowCreateModal(false);
      loadSessions();
      setStoreId('');
      setNotes('');
    } else {
      setFormError(res.error || 'Failed to initialize count session.');
    }
  };

  const handleViewSession = async (session: any) => {
    const res = await getStockCountSessionById(session.id);
    if (res.success) {
      setSelectedSession(res.data);
      // Init recorded quantity mapping
      const initialMap: Record<number, number> = {};
      res.data.lines?.forEach((l: any) => {
        initialMap[l.id] = Number(l.counted_qty ?? l.book_qty);
      });
      setRecordedQtyMap(initialMap);
      setShowViewModal(true);
    }
  };

  const handleSaveLineQty = async (lineId: number) => {
    const qty = recordedQtyMap[lineId];
    if (qty === undefined || qty < 0) {
      alert('Specify a valid physical count quantity.');
      return;
    }
    setUpdatingLineId(lineId);
    const res = await updateCountLine(selectedSession.id, lineId, qty);
    setUpdatingLineId(null);
    if (res.success) {
      // Refresh details
      const detailRes = await getStockCountSessionById(selectedSession.id);
      if (detailRes.success) {
        setSelectedSession(detailRes.data);
      }
    } else {
      alert(res.error || 'Failed to update counted quantity.');
    }
  };

  const handleReconcileAndAdjust = async () => {
    if (!selectedSession) return;
    if (!confirm('This action reconciles system stock and posts double-entry GL ledger adjustments. Proceed?')) return;

    setAdjusting(true);
    const res = await approveCountSession(selectedSession.id);
    setAdjusting(false);

    if (res.success) {
      alert('Audit counts posted and discrepancies corrected successfully!');
      setShowViewModal(false);
      loadSessions();
    } else {
      alert(res.error || 'Failed to reconcile and adjust ledger.');
    }
  };

  return (
    <AdminPage 
      pageTitle="Physical Stock Counting & Audits" 
      pageIcon={<ClipboardList className="h-5 w-5" />} 
      onRefresh={loadSessions} 
      refreshing={loading}
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <p className="text-gray-500 text-sm mt-1">
            Conduct stock audits, perform variance analysis, and reconcile system book balances with actual stock count.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium px-4 py-2.5 rounded-lg shadow-md transition-all cursor-pointer"
        >
          <Plus size={18} />
          Initialize Stock Audit
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
        <div>
          <span className="text-sm text-gray-500">Total Audit Sessions: {sessions.length}</span>
        </div>

        <div className="flex w-full md:w-auto items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg text-sm text-gray-700 px-3 py-2 focus:outline-none focus:border-indigo-500 w-full md:w-44"
          >
            <option value="">All Statuses</option>
            <option value="Draft">Draft (Counting)</option>
            <option value="Completed">Completed</option>
            <option value="Reconciled">Reconciled</option>
          </select>

          <button
            onClick={loadSessions}
            className="p-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg transition"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Audit List Table */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 border border-gray-200 rounded-xl">
          <ClipboardList size={48} className="text-gray-400 mx-auto mb-3" />
          <p className="text-gray-900 text-lg font-medium">No stock audits found</p>
          <p className="text-gray-500 text-sm">Initialize a physical stock count session to trace variance and update ledger lines.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Audit ID</th>
                <th className="py-3 px-4">Store Location</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
              {sessions.map((sess) => (
                <tr key={sess.id} className="hover:bg-gray-50">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">#AUD-{sess.id}</td>
                  <td className="py-3.5 px-4 font-semibold text-gray-900">{sess.store?.name}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      sess.status === 'Draft' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                      sess.status === 'Completed' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                      'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}>
                      {sess.status === 'Draft' ? 'Counting' : sess.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-gray-500">
                    {new Date(sess.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-gray-500 max-w-xs truncate">{sess.notes || '—'}</td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => handleViewSession(sess)}
                      className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1 mx-auto cursor-pointer"
                    >
                      <Eye size={14} /> Open Audit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Initialize Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full relative z-10 p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-900">Initialize Physical Audit</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-900 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex gap-2">
                  <AlertCircle className="shrink-0 mt-0.5" size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Store to Audit</label>
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
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
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Session Notes / Scope</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. End of quarter consumables stock count"
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 h-24"
                ></textarea>
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
                  disabled={submittingSession}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm transition"
                >
                  {submittingSession ? 'Initializing...' : 'Start Audit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit details & Count Recording Modal */}
      {showViewModal && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowViewModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-xl max-w-4xl w-full relative z-10 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  Physical Audit: <span className="text-indigo-600 font-mono">#AUD-{selectedSession.id}</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Location: {selectedSession.store?.name} | Created by: {selectedSession.created_by_user?.name || 'Manager'}</p>
              </div>
              <button onClick={() => setShowViewModal(false)} className="text-gray-500 hover:text-gray-900 transition">
                <X size={20} />
              </button>
            </div>

            {/* Audit Status Info */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs gap-4 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-gray-500">
                <div>
                  <span className="block text-[10px] text-gray-500 uppercase font-bold">Scope / Notes</span>
                  <span className="font-semibold text-gray-900">{selectedSession.notes || 'No notes'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-500 uppercase font-bold">Created Date</span>
                  <span className="font-semibold text-gray-900">{new Date(selectedSession.created_at).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-500 uppercase font-bold">Status</span>
                  <span className={`font-semibold ${selectedSession.status === 'Draft' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                    {selectedSession.status === 'Draft' ? 'Counting In Progress' : selectedSession.status}
                  </span>
                </div>
              </div>

              {selectedSession.status === 'Draft' && (
                <button
                  onClick={handleReconcileAndAdjust}
                  disabled={adjusting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-4 py-2.5 rounded-lg shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {adjusting ? 'Reconciling Ledger...' : 'Post Reconciliations & Adjustments'}
                </button>
              )}
            </div>

            {/* Count Lines Table */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Box size={16} className="text-indigo-600" /> Count Verification Lines
              </h3>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Material / Batch</th>
                      <th className="py-2.5 px-3 text-right">System Qty</th>
                      <th className="py-2.5 px-3 text-right">Counted Qty</th>
                      <th className="py-2.5 px-3 text-right">Variance</th>
                      {selectedSession.status === 'Draft' && (
                        <th className="py-2.5 px-3 text-center w-40">Edit Count</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-700">
                    {selectedSession.lines?.map((line: any) => {
                      const systemQty = Number(line.system_quantity);
                      const countedQty = Number(line.recorded_quantity ?? systemQty);
                      const variance = countedQty - systemQty;

                      return (
                        <tr key={line.id} className="hover:bg-gray-50">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-gray-900">{line.item?.name}</div>
                            <div className="text-[10px] text-gray-500">
                              Code: {line.item?.item_code} | Batch: {line.batch?.batch_no || '—'}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right text-gray-500">{systemQty}</td>
                          <td className="py-3 px-3 text-right font-medium text-gray-900">
                            {line.recorded_quantity === null ? <span className="text-gray-400">Uncounted</span> : countedQty}
                          </td>
                          <td className="py-3 px-3 text-right font-bold">
                            {variance === 0 ? (
                              <span className="text-gray-500">0</span>
                            ) : variance > 0 ? (
                              <span className="text-emerald-600">+{variance}</span>
                            ) : (
                              <span className="text-rose-600">{variance}</span>
                            )}
                          </td>
                          {selectedSession.status === 'Draft' && (
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center gap-1.5 justify-center">
                                <input
                                  type="number"
                                  min="0"
                                  value={recordedQtyMap[line.id] ?? ''}
                                  onChange={(e) => setRecordedQtyMap({ ...recordedQtyMap, [line.id]: parseInt(e.target.value) || 0 })}
                                  className="bg-white border border-gray-200 rounded px-1.5 py-1 text-center w-16 text-gray-900 text-xs"
                                />
                                <button
                                  onClick={() => handleSaveLineQty(line.id)}
                                  disabled={updatingLineId === line.id}
                                  className="bg-white border border-gray-200 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 p-1.5 rounded transition cursor-pointer"
                                  title="Save count"
                                >
                                  <Check size={12} />
                                </button>
                              </div>
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
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
