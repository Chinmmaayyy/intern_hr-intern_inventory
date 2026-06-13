'use client';
import { useEffect, useState, useCallback } from 'react';
import { getStockLedger, listItemBatches, quarantineBatch, recordConsumption } from '@/app/actions/stock-actions';
import { listStores, getStoreStock } from '@/app/actions/store-actions';
import { listItems } from '@/app/actions/item-master-actions';
import { getIPDAdmissions } from '@/app/actions/ipd-actions';
import { AdminPage } from '@/app/admin/components/AdminPage';
import {
  ShieldAlert, BarChart3, Clock, AlertTriangle, CheckCircle2, Search,
  RefreshCw, Lock, Unlock, HelpCircle, ArrowDownCircle, ArrowUpCircle,
  Activity, ClipboardList, Send, User, Building
} from 'lucide-react';

export default function AdjustmentsPage() {
  const [activeTab, setActiveTab] = useState<'ledger' | 'quarantine' | 'consumption'>('ledger');

  // Stock Ledger state
  const [movements, setMovements] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [storeFilter, setStoreFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loadingLedger, setLoadingLedger] = useState(true);

  // Quarantine state
  const [batches, setBatches] = useState<any[]>([]);
  const [searchBatch, setSearchBatch] = useState('');
  const [loadingQuarantine, setLoadingQuarantine] = useState(true);

  // Consumption state
  const [loadingConsumption, setLoadingConsumption] = useState(false);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [storeStocks, setStoreStocks] = useState<any[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [consumptionType, setConsumptionType] = useState<'DEPARTMENT' | 'PATIENT'>('DEPARTMENT');
  const [selectedAdmissionId, setSelectedAdmissionId] = useState('');
  const [consumeQty, setConsumeQty] = useState(1);
  const [consumeReason, setConsumeReason] = useState('');
  const [consumeCostCenter, setConsumeCostCenter] = useState('');
  const [consumptionError, setConsumptionError] = useState('');
  const [consumptionSuccess, setConsumptionSuccess] = useState(false);

  const loadLedger = useCallback(async () => {
    setLoadingLedger(true);
    try {
      const [movRes, storeRes, itemRes] = await Promise.all([
        getStockLedger({
          store_id: storeFilter ? parseInt(storeFilter) : undefined,
          item_id: itemFilter ? parseInt(itemFilter) : undefined,
          movement_type: typeFilter || undefined,
          limit: 50
        }),
        listStores(),
        listItems({ limit: 100 })
      ]);
      if (movRes.success) setMovements(movRes.data?.movements || []);
      if (storeRes.success) setStores(storeRes.data || []);
      if (itemRes.success) setItems(itemRes.data?.items || []);
    } catch (e) {
      console.error(e);
    }
    setLoadingLedger(false);
  }, [storeFilter, itemFilter, typeFilter]);

  const loadQuarantine = useCallback(async () => {
    setLoadingQuarantine(true);
    try {
      const res = await listItemBatches({ search: searchBatch || undefined });
      if (res.success) setBatches(res.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoadingQuarantine(false);
  }, [searchBatch]);

  const loadConsumptionData = useCallback(async () => {
    setLoadingConsumption(true);
    try {
      const [storeRes, itemRes, admRes] = await Promise.all([
        listStores(),
        listItems({ limit: 100 }),
        getIPDAdmissions('Admitted')
      ]);
      if (storeRes.success) setStores(storeRes.data || []);
      if (itemRes.success) setItems(itemRes.data?.items || []);
      if (admRes.success) setAdmissions(admRes.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoadingConsumption(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'ledger') {
      loadLedger();
    } else if (activeTab === 'quarantine') {
      loadQuarantine();
    } else if (activeTab === 'consumption') {
      loadConsumptionData();
    }
  }, [activeTab, loadLedger, loadQuarantine, loadConsumptionData]);

  // Load stocks for the selected store to filter available batches/quantities
  const handleStoreChange = async (storeIdVal: string) => {
    setSelectedStoreId(storeIdVal);
    setSelectedItemId('');
    setSelectedBatchId('');
    setStoreStocks([]);
    if (!storeIdVal) return;

    setLoadingConsumption(true);
    try {
      const res = await getStoreStock(parseInt(storeIdVal), { limit: 200 });
      if (res.success) {
        setStoreStocks(res.data?.stocks || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingConsumption(false);
  };

  const handleToggleQuarantine = async (batchId: number, currentStatus: boolean) => {
    const res = await quarantineBatch(batchId, !currentStatus);
    if (res.success) {
      alert(`Batch has been successfully ${!currentStatus ? 'Quarantined' : 'Released'}.`);
      loadQuarantine();
    } else {
      alert(res.error || 'Failed to update quarantine status.');
    }
  };

  const handleRecordConsumptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConsumptionError('');
    setConsumptionSuccess(false);

    if (!selectedStoreId || !selectedItemId || consumeQty <= 0) {
      setConsumptionError('Please fill in all required fields.');
      return;
    }

    if (consumptionType === 'PATIENT' && !selectedAdmissionId) {
      setConsumptionError('Please select a patient admission for patient charging.');
      return;
    }

    setLoadingConsumption(true);
    try {
      const res = await recordConsumption({
        store_id: parseInt(selectedStoreId),
        item_id: parseInt(selectedItemId),
        batch_id: selectedBatchId ? parseInt(selectedBatchId) : null,
        quantity: consumeQty,
        type: consumptionType,
        admission_id: consumptionType === 'PATIENT' ? selectedAdmissionId : null,
        cost_center: consumeCostCenter || null,
        reason: consumeReason || null
      });

      if (res.success) {
        setConsumptionSuccess(true);
        setConsumeQty(1);
        setConsumeReason('');
        setConsumeCostCenter('');
        setSelectedItemId('');
        setSelectedBatchId('');
        // Reload stock levels for the store
        handleStoreChange(selectedStoreId);
      } else {
        setConsumptionError(res.error || 'Failed to record consumption.');
      }
    } catch (err: any) {
      setConsumptionError(err.message || 'An error occurred.');
    }
    setLoadingConsumption(false);
  };

  // Get items that are currently in stock for the selected store
  const availableItemsInStore = Array.from(
    new Map(storeStocks.map(s => [s.item?.id, s.item])).values()
  ).filter(Boolean);

  // Get batches that are currently in stock for the selected store and item
  const availableBatchesForItem = storeStocks.filter(
    s => s.item_id === parseInt(selectedItemId) && s.quantity_on_hand > 0
  );

  const selectedStockRecord = storeStocks.find(
    s => s.item_id === parseInt(selectedItemId) && s.batch_id === (selectedBatchId ? parseInt(selectedBatchId) : null)
  ) || storeStocks.find(s => s.item_id === parseInt(selectedItemId));

  const maxAvailableStock = selectedStockRecord?.quantity_on_hand || 0;

  const currentLoading = activeTab === 'ledger' 
    ? loadingLedger 
    : activeTab === 'quarantine' 
      ? loadingQuarantine 
      : loadingConsumption;

  const currentRefresh = activeTab === 'ledger' 
    ? loadLedger 
    : activeTab === 'quarantine' 
      ? loadQuarantine 
      : loadConsumptionData;

  return (
    <AdminPage 
      pageTitle="Quarantine & Adjustments" 
      pageIcon={<ShieldAlert className="h-5 w-5" />} 
      onRefresh={currentRefresh} 
      refreshing={currentLoading}
    >
      <div className="mb-6">
        <p className="text-gray-500 text-sm mt-1">
          Monitor perpetual stock ledgers, review adjustment history, record departmental/patient consumptions, and manage quarantine status for materials.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'ledger'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock size={16} />
            Stock Ledger
          </div>
        </button>
        <button
          onClick={() => setActiveTab('consumption')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'consumption'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Activity size={16} />
            Record Consumption
          </div>
        </button>
        <button
          onClick={() => setActiveTab('quarantine')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'quarantine'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} />
            Quarantine Control
          </div>
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Store Location</label>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg text-sm text-gray-700 px-3 py-2 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              >
                <option value="">All Stores</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Material SKU</label>
              <select
                value={itemFilter}
                onChange={(e) => setItemFilter(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg text-sm text-gray-700 px-3 py-2 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              >
                <option value="">All Items</option>
                {items.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Movement Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg text-sm text-gray-700 px-3 py-2 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              >
                <option value="">All Movements</option>
                <option value="OPENING">Opening stock</option>
                <option value="GRN_RECEIPT">GRN receipt</option>
                <option value="INDENT_RECEIPT">Indent receipt</option>
                <option value="INDENT_ISSUE">Indent issue</option>
                <option value="TRANSFER_OUT">Transfer out</option>
                <option value="TRANSFER_IN">Transfer in</option>
                <option value="CONSUMPTION">Overhead Consumption</option>
                <option value="PATIENT_CHARGE">Patient Chargeable Consumption</option>
                <option value="ADJUSTMENT_PLUS">Variance gain (+)</option>
                <option value="ADJUSTMENT_MINUS">Variance shrinkage (-)</option>
              </select>
            </div>

            <div>
              <button
                onClick={loadLedger}
                className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer text-sm"
              >
                <RefreshCw size={15} className={loadingLedger ? 'animate-spin' : ''} />
                Refresh Ledger
              </button>
            </div>
          </div>

          {/* Ledger Table */}
          {loadingLedger ? (
            <div className="flex justify-center items-center py-20">
              <RefreshCw className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
              <Clock size={48} className="text-gray-400 mx-auto mb-3" />
              <p className="text-gray-900 text-lg font-medium">No movements recorded</p>
              <p className="text-gray-500 text-sm">Perform stock operations (GRNs, Issues, Transfers) to generate ledger logs.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Date/Time</th>
                    <th className="py-3 px-4">Store Location</th>
                    <th className="py-3 px-4">Item Catalog SKU</th>
                    <th className="py-3 px-4">Movement Type</th>
                    <th className="py-3 px-4 text-right">Quantity Change</th>
                    <th className="py-3 px-4 text-right">Valuation Cost</th>
                    <th className="py-3 px-4 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-gray-700">
                  {movements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 text-gray-500">{new Date(mov.created_at).toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 font-semibold text-gray-900">{mov.store?.name}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{mov.item?.name}</div>
                        <div className="text-[10px] text-gray-500">Code: {mov.item?.item_code} {mov.batch?.batch_no ? `| Batch: ${mov.batch.batch_no}` : ''}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          mov.movement_type.includes('RECEIPT') || mov.movement_type === 'OPENING' || mov.movement_type === 'ADJUSTMENT_PLUS' || mov.movement_type.includes('IN')
                            ? 'bg-emerald-100 text-emerald-850'
                            : 'bg-rose-100 text-rose-850'
                        }`}>
                          {mov.movement_type}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${
                        mov.quantity_in > 0 ? 'text-green-600' : 'text-rose-600'
                      }`}>
                        {mov.quantity_in > 0 ? `+${mov.quantity_in}` : `-${mov.quantity_out}`}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500">₹{Number(mov.unit_cost || 0).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">{mov.balance_after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Consumption */}
      {activeTab === 'consumption' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-500" />
              Record Materials Consumption
            </h3>
            
            <form onSubmit={handleRecordConsumptionSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Select Store</label>
                  <select
                    value={selectedStoreId}
                    onChange={(e) => handleStoreChange(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg text-sm text-gray-900 px-3 py-2 focus:outline-none focus:border-amber-500"
                    required
                  >
                    <option value="">Choose Store...</option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.store_type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Select Item in Store</label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => { setSelectedItemId(e.target.value); setSelectedBatchId(''); }}
                    className="w-full bg-white border border-gray-300 rounded-lg text-sm text-gray-900 px-3 py-2 focus:outline-none focus:border-amber-500"
                    disabled={!selectedStoreId}
                    required
                  >
                    <option value="">Choose SKU...</option>
                    {availableItemsInStore.map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.item_code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedItemId && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Select Batch</label>
                    <select
                      value={selectedBatchId}
                      onChange={(e) => setSelectedBatchId(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg text-sm text-gray-900 px-3 py-2 focus:outline-none focus:border-amber-500"
                    >
                      <option value="">Choose Batch (Optional if non-batch tracked)...</option>
                      {availableBatchesForItem.map(s => (
                        <option key={s.batch?.id || 0} value={s.batch?.id || ''}>
                          Batch: {s.batch?.batch_no || 'No Batch'} | Exp: {s.batch?.expiry_date ? new Date(s.batch.expiry_date).toLocaleDateString() : 'None'} (On-hand: {s.quantity_on_hand})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Consumption Flow</label>
                    <div className="flex gap-4 pt-1.5">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="consumptionType"
                          checked={consumptionType === 'DEPARTMENT'}
                          onChange={() => setConsumptionType('DEPARTMENT')}
                          className="text-amber-500 focus:ring-amber-500"
                        />
                        Department Overhead
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="consumptionType"
                          checked={consumptionType === 'PATIENT'}
                          onChange={() => setConsumptionType('PATIENT')}
                          className="text-amber-500 focus:ring-amber-500"
                        />
                        Charge Patient (IPD)
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {consumptionType === 'PATIENT' && selectedItemId && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    Patient Billing Details
                  </h4>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Active IPD Admission</label>
                    <select
                      value={selectedAdmissionId}
                      onChange={(e) => setSelectedAdmissionId(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg text-sm text-gray-900 px-3 py-2 focus:outline-none focus:border-amber-500"
                      required={consumptionType === 'PATIENT'}
                    >
                      <option value="">Select Admitted Patient...</option>
                      {admissions.map(a => (
                        <option key={a.admission_id} value={a.admission_id}>
                          {a.patient_id} | {a.admission_id} | Ward: {a.bed_id || 'Unassigned'}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedItemId && items.find(i => i.id === parseInt(selectedItemId))?.is_patient_chargeable ? (
                    <p className="text-xs text-green-700 font-semibold">
                      ✓ This item is patient-chargeable. Posting will log a charge of ₹{items.find(i => i.id === parseInt(selectedItemId))?.selling_price} to their IPD bill.
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700 font-semibold">
                      ⚠️ Note: This item is marked as Non-Chargeable in the Item Catalog. Billing charge won't be posted, but stock will deduct.
                    </p>
                  )}
                </div>
              )}

              {selectedItemId && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Quantity to Consume (Max: {maxAvailableStock})
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={maxAvailableStock}
                      value={consumeQty}
                      onChange={(e) => setConsumeQty(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-gray-300 rounded-lg text-sm text-gray-900 px-3 py-2 focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cost Center</label>
                    <input
                      type="text"
                      placeholder="e.g. CC-OT-01"
                      value={consumeCostCenter}
                      onChange={(e) => setConsumeCostCenter(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg text-sm text-gray-900 px-3 py-2 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Reason / Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Surgery usage"
                      value={consumeReason}
                      onChange={(e) => setConsumeReason(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg text-sm text-gray-900 px-3 py-2 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}

              {consumptionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                  {consumptionError}
                </div>
              )}

              {consumptionSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold rounded-lg">
                  ✓ Consumption successfully logged! Stock has been decremented, and matching GL journal entries have been posted.
                </div>
              )}

              {selectedItemId && (
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={loadingConsumption || consumeQty > maxAvailableStock}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-350 text-white font-bold text-sm rounded-lg shadow-sm cursor-pointer transition-colors"
                  >
                    <Send className="h-4 w-4" />
                    {loadingConsumption ? 'Recording...' : 'Record Consumption'}
                  </button>
                </div>
              )}
            </form>
          </div>

          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Building className="h-4 w-4 text-indigo-500" />
              Store-Wise Available Stock
            </h3>
            <p className="text-xs text-gray-500">
              Select a store location on the left to see all items currently stocked and their available quantities.
            </p>
            {storeStocks.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No store selected or no inventory available.</p>
            ) : (
              <div className="divide-y divide-gray-150 max-h-96 overflow-y-auto pr-1">
                {storeStocks.map((stockRecord, i) => (
                  <div key={i} className="py-2.5 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-semibold text-gray-900">{stockRecord.item?.name}</p>
                      <p className="text-gray-500 text-[10px]">
                        SKU: {stockRecord.item?.item_code} {stockRecord.batch?.batch_no ? `· Batch: ${stockRecord.batch.batch_no}` : ''}
                      </p>
                    </div>
                    <span className="bg-gray-100 text-gray-800 font-bold px-2 py-0.5 rounded-full shrink-0">
                      {stockRecord.quantity_on_hand} {stockRecord.item?.base_uom}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Quarantine */}
      {activeTab === 'quarantine' && (
        <div className="space-y-4">
          {/* Search Toolbar */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-md">
              <input
                type="text"
                placeholder="Search batch number..."
                value={searchBatch}
                onChange={(e) => setSearchBatch(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg text-sm text-gray-700 pl-10 pr-4 py-2 focus:outline-none focus:border-indigo-500"
              />
              <Search className="absolute left-3.5 top-2.5 text-gray-400" size={16} />
            </div>

            <button
              onClick={loadQuarantine}
              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer text-sm w-full md:w-auto"
            >
              <RefreshCw size={15} className={loadingQuarantine ? 'animate-spin' : ''} />
              Reload Batches
            </button>
          </div>

          {/* Batches Table */}
          {loadingQuarantine ? (
            <div className="flex justify-center items-center py-20">
              <RefreshCw className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 border border-gray-200 rounded-xl">
              <ShieldAlert size={48} className="text-gray-400 mx-auto mb-3" />
              <p className="text-gray-900 text-lg font-medium">No item batches found</p>
              <p className="text-gray-500 text-sm">Add item batches with purchase GRNs to populate physical quarantine lists.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Batch No</th>
                    <th className="py-3 px-4">Material SKU</th>
                    <th className="py-3 px-4">Standard Cost</th>
                    <th className="py-3 px-4">Expiry Date</th>
                    <th className="py-3 px-4">Quarantine Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-gray-700">
                  {batches.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">{b.batch_no}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{b.item?.name}</div>
                        <div className="text-[10px] text-gray-500">Code: {b.item?.item_code}</div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 font-medium">₹{Number(b.cost_price || 0).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-gray-500">
                        {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : 'No expiry'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.is_quarantined
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}>
                          {b.is_quarantined ? 'Quarantined (Locked)' : 'Active (Available)'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleQuarantine(b.id, b.is_quarantined)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1 mx-auto cursor-pointer ${
                            b.is_quarantined
                              ? 'bg-emerald-655 hover:bg-emerald-500 text-white bg-emerald-600'
                              : 'bg-rose-655 hover:bg-rose-500 text-white bg-rose-600'
                          }`}
                        >
                          {b.is_quarantined ? (
                            <>
                              <Unlock size={13} /> Release Stock
                            </>
                          ) : (
                            <>
                              <Lock size={13} /> Quarantine
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AdminPage>
  );
}
