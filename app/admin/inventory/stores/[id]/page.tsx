'use client';
import { useEffect, useState, use } from 'react';
import { getStoreById, getStoreStock, upsertStoreItemSetting, postOpeningStock } from '@/app/actions/store-actions';
import { listItems } from '@/app/actions/item-master-actions';
import { AdminPage } from '@/app/admin/components/AdminPage';
import {
  ArrowLeft, Store, Package, Plus, ClipboardList, Settings, Check,
  AlertTriangle, RefreshCw, X, Search, CheckCircle2, ChevronRight
} from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function StoreDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const storeId = parseInt(resolvedParams.id);

  const [store, setStore] = useState<any>(null);
  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stock' | 'reorder' | 'opening'>('stock');

  // Search & Filter
  const [stockSearch, setStockSearch] = useState('');
  const [stockPage, setStockPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals / Actions
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [submittingConfig, setSubmittingConfig] = useState(false);
  const [configItem, setConfigItem] = useState<any>(null);
  const [parLevel, setParLevel] = useState(0);
  const [reorderPoint, setReorderPoint] = useState(0);
  const [maxLevel, setMaxLevel] = useState(0);
  const [autoIndent, setAutoIndent] = useState(false);

  // Opening Stock Action
  const [allItems, setAllItems] = useState<any[]>([]);
  const [openingLines, setOpeningLines] = useState<Array<{
    item_id: number;
    name: string;
    uom: string;
    is_batch: boolean;
    is_expiry: boolean;
    batch_no?: string;
    expiry_date?: string;
    quantity: number;
    unit_cost: number;
  }>>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [openingQty, setOpeningQty] = useState(1);
  const [openingCost, setOpeningCost] = useState(0);
  const [openingBatch, setOpeningBatch] = useState('');
  const [openingExpiry, setOpeningExpiry] = useState('');
  const [postingStock, setPostingStock] = useState(false);
  const [postError, setPostError] = useState('');
  const [postSuccess, setPostSuccess] = useState(false);

  const loadStoreDetails = async () => {
    setLoading(true);
    try {
      const [storeRes, stockRes, itemsRes] = await Promise.all([
        getStoreById(storeId),
        getStoreStock(storeId, { search: stockSearch, page: stockPage, limit: 15 }),
        listItems({ limit: 100 })
      ]);

      if (storeRes.success) setStore(storeRes.data);
      if (stockRes.success) {
        setStock(stockRes.data?.stocks || []);
        setTotalPages(stockRes.data?.totalPages || 1);
      }
      if (itemsRes.success) setAllItems(itemsRes.data?.items || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStoreDetails();
  }, [storeId, stockPage, stockSearch]);

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configItem) return;
    setSubmittingConfig(true);
    const res = await upsertStoreItemSetting({
      store_id: storeId,
      item_id: configItem.id,
      par_level: parLevel,
      reorder_point: reorderPoint,
      max_level: maxLevel,
      auto_indent: autoIndent
    });
    setSubmittingConfig(false);
    if (res.success) {
      setShowConfigModal(false);
      loadStoreDetails();
    }
  };

  const openConfigModal = (item: any, existingSetting?: any) => {
    setConfigItem(item);
    setParLevel(existingSetting?.par_level ?? 0);
    setReorderPoint(existingSetting?.reorder_point ?? 0);
    setMaxLevel(existingSetting?.max_level ?? 0);
    setAutoIndent(existingSetting?.auto_indent ?? false);
    setShowConfigModal(true);
  };

  const addOpeningLine = () => {
    if (!selectedItemId) return;
    const item = allItems.find(i => i.id === parseInt(selectedItemId));
    if (!item) return;

    // Check if duplicate already in lines
    if (openingLines.some(l => l.item_id === item.id && l.batch_no === openingBatch)) {
      alert('This item and batch combination is already in the list.');
      return;
    }

    setOpeningLines([
      ...openingLines,
      {
        item_id: item.id,
        name: item.name,
        uom: item.base_uom,
        is_batch: item.is_batch_tracked,
        is_expiry: item.is_expiry_tracked,
        batch_no: openingBatch || undefined,
        expiry_date: openingExpiry || undefined,
        quantity: openingQty,
        unit_cost: openingCost
      }
    ]);

    // reset inputs
    setSelectedItemId('');
    setOpeningQty(1);
    setOpeningCost(0);
    setOpeningBatch('');
    setOpeningExpiry('');
  };

  const removeOpeningLine = (index: number) => {
    setOpeningLines(openingLines.filter((_, i) => i !== index));
  };

  const handlePostOpeningStock = async () => {
    if (openingLines.length === 0) return;
    setPostingStock(true);
    setPostError('');
    setPostSuccess(false);

    const formattedLines = openingLines.map(l => ({
      item_id: l.item_id,
      batch_no: l.batch_no,
      expiry_date: l.expiry_date,
      quantity: l.quantity,
      unit_cost: l.unit_cost
    }));

    const res = await postOpeningStock(storeId, formattedLines);
    setPostingStock(false);
    if (res.success) {
      setPostSuccess(true);
      setOpeningLines([]);
      loadStoreDetails();
    } else {
      setPostError(res.error || 'Failed to post opening stock.');
    }
  };

  return (
    <AdminPage
      pageTitle={store ? store.name : 'Store Details'}
      pageIcon={<Store size={20} />}
      onRefresh={loadStoreDetails}
      refreshing={loading}
      headerActions={
        <div className="flex gap-2">
          <Link
            href="/admin/inventory/stores"
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 transition"
          >
            <ArrowLeft size={16} /> Back to Stores
          </Link>
          <button
            onClick={loadStoreDetails}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 transition"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      }
    >
      {loading && !store ? (
        <div className="flex justify-center items-center py-32">
          <RefreshCw className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : !store ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <AlertTriangle className="text-amber-500 mx-auto mb-3" size={40} />
          <p className="text-gray-800 font-semibold text-lg">Store not found</p>
          <Link href="/admin/inventory/stores" className="text-amber-600 hover:underline mt-2 inline-block">
            Back to Stores
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Cost Center</span>
                <p className="text-sm font-semibold text-gray-900">{store.cost_center || 'Not assigned'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">In-Charge Manager</span>
                <p className="text-sm font-semibold text-gray-900">{store.incharge_user?.name || 'Unassigned'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Stock Items Count</span>
                <p className="text-sm font-semibold text-gray-900">{stock.length} unique batches/items</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200 gap-6">
            <button
              onClick={() => setActiveTab('stock')}
              className={`pb-3 text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'stock'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Package size={16} /> Stock List ({stock.length})
            </button>
            <button
              onClick={() => setActiveTab('reorder')}
              className={`pb-3 text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'reorder'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Settings size={16} /> Store Stock Thresholds
            </button>
            <button
              onClick={() => setActiveTab('opening')}
              className={`pb-3 text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'opening'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Plus size={16} /> Opening Stock Posting
            </button>
          </div>

          {/* TAB 1: Stock List */}
          {activeTab === 'stock' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search stock list by item name..."
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Item Details</th>
                      <th className="py-3 px-4">Batch Number</th>
                      <th className="py-3 px-4">Expiry Date</th>
                      <th className="py-3 px-4 text-right">Qty On Hand</th>
                      <th className="py-3 px-4 text-right">Reorder Pt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                    {stock.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-gray-500 text-sm">
                          No stock records found. Go to 'Opening Stock Posting' to load inventory.
                        </td>
                      </tr>
                    ) : (
                      stock.map((s) => {
                        const lowStock = s.quantity_on_hand <= (s.item?.reorder_point || 0);
                        return (
                          <tr key={s.id} className="hover:bg-gray-50/50">
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-gray-900">{s.item?.name}</div>
                              <div className="text-xs text-gray-500">{s.item?.item_code} | {s.item?.base_uom}</div>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-gray-600">
                              {s.batch?.batch_no || <span className="text-gray-400">—</span>}
                            </td>
                            <td className="py-3.5 px-4 text-gray-600">
                              {s.batch?.expiry_date ? new Date(s.batch.expiry_date).toLocaleDateString('en-IN') : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="py-3.5 px-4 text-right font-medium">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${lowStock ? 'bg-rose-100 text-rose-800' : 'bg-green-100 text-green-800'}`}>
                                {s.quantity_on_hand}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right text-gray-500">
                              {s.item?.reorder_point || 0}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Threshold Settings */}
          {activeTab === 'reorder' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Set Par, Reorder Points, and Max stocking thresholds specifically for this store location. These control automatic indents and replenishment alerts.
              </p>

              <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4 text-center">Auto Indent</th>
                      <th className="py-3 px-4 text-right">Par Level</th>
                      <th className="py-3 px-4 text-right">Reorder Point</th>
                      <th className="py-3 px-4 text-right">Max Level</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                    {allItems.map((item) => {
                      const setting = store.store_settings?.find((s: any) => s.item_id === item.id);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50/50">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-500">{item.item_code} | UOM: {item.base_uom}</div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {setting?.auto_indent ? (
                              <span className="inline-flex bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">Auto-indent</span>
                            ) : (
                              <span className="inline-flex bg-gray-100 text-gray-600 text-xs px-2.5 py-0.5 rounded-full">Manual</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-gray-900">{setting?.par_level ?? 0}</td>
                          <td className="py-3.5 px-4 text-right text-gray-600">{setting?.reorder_point ?? 0}</td>
                          <td className="py-3.5 px-4 text-right text-gray-600">{setting?.max_level ?? 0}</td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => openConfigModal(item, setting)}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1 rounded transition cursor-pointer"
                            >
                              Configure
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Opening Stock */}
          {activeTab === 'opening' && (
            <div className="space-y-6">
              <div className="bg-gray-50 border border-gray-200 p-5 rounded-xl space-y-4">
                <h3 className="text-sm font-bold text-gray-900">Post Opening Stock Form</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 font-medium mb-1">Select Item</label>
                    <select
                      value={selectedItemId}
                      onChange={(e) => setSelectedItemId(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg text-sm text-gray-900 px-3 py-2 focus:outline-none focus:border-amber-500"
                    >
                      <option value="">Choose item...</option>
                      {allItems.map(i => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.item_code}) {i.is_batch_tracked ? '• Batch tracked' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedItemId && allItems.find(i => i.id === parseInt(selectedItemId))?.is_batch_tracked && (
                    <div>
                      <label className="block text-xs text-gray-500 font-medium mb-1">Batch Number</label>
                      <input
                        type="text"
                        placeholder="e.g. BATCH-01"
                        value={openingBatch}
                        onChange={(e) => setOpeningBatch(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg text-sm text-gray-900 px-3 py-2 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}

                  {selectedItemId && allItems.find(i => i.id === parseInt(selectedItemId))?.is_expiry_tracked && (
                    <div>
                      <label className="block text-xs text-gray-500 font-medium mb-1">Expiry Date</label>
                      <input
                        type="date"
                        value={openingExpiry}
                        onChange={(e) => setOpeningExpiry(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg text-sm text-gray-900 px-3 py-2 focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-gray-500 font-medium mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={openingQty}
                      onChange={(e) => setOpeningQty(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-gray-300 rounded-lg text-sm text-gray-900 px-3 py-2 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 font-medium mb-1">Unit Cost (INR)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={openingCost}
                      onChange={(e) => setOpeningCost(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-gray-300 rounded-lg text-sm text-gray-900 px-3 py-2 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={addOpeningLine}
                    className="bg-gray-800 hover:bg-gray-900 text-white font-semibold text-xs px-4 py-2 rounded-lg transition cursor-pointer"
                  >
                    Add Line Item
                  </button>
                </div>
              </div>

              {/* Pending Lines Table */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pending Opening Stock Entries</h4>
                <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Item</th>
                        <th className="py-2.5 px-4">Batch / Expiry</th>
                        <th className="py-2.5 px-4 text-right">Qty</th>
                        <th className="py-2.5 px-4 text-right">Unit Cost</th>
                        <th className="py-2.5 px-4 text-right">Total Cost</th>
                        <th className="py-2.5 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                      {openingLines.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-gray-400">
                            No lines added yet. Add items above to build opening stock batch.
                          </td>
                        </tr>
                      ) : (
                        openingLines.map((l, index) => (
                          <tr key={index} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-4">
                              <div className="font-semibold text-gray-950">{l.name}</div>
                              <div className="text-xs text-gray-500">UOM: {l.uom}</div>
                            </td>
                            <td className="py-2.5 px-4 text-xs font-mono text-gray-600">
                              {l.batch_no ? `Batch: ${l.batch_no}` : 'No batch'}
                              {l.expiry_date ? ` | Exp: ${l.expiry_date}` : ''}
                            </td>
                            <td className="py-2.5 px-4 text-right font-medium text-gray-900">{l.quantity}</td>
                            <td className="py-2.5 px-4 text-right text-gray-600">₹{l.unit_cost.toFixed(2)}</td>
                            <td className="py-2.5 px-4 text-right font-semibold text-amber-600">₹{(l.quantity * l.unit_cost).toFixed(2)}</td>
                            <td className="py-2.5 px-4 text-center">
                              <button onClick={() => removeOpeningLine(index)} className="text-red-500 hover:text-red-700 p-1">
                                <X size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Posting Status Messages */}
                {postError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm flex gap-2">
                    <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                    <span>{postError}</span>
                  </div>
                )}
                {postSuccess && (
                  <div className="p-3.5 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm flex gap-2">
                    <CheckCircle2 className="shrink-0 mt-0.5" size={16} />
                    <span>Opening stock successfully posted and GL ledger entries generated!</span>
                  </div>
                )}

                {openingLines.length > 0 && (
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={handlePostOpeningStock}
                      disabled={postingStock}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm px-6 py-2.5 rounded-lg shadow-md transition disabled:opacity-50 cursor-pointer"
                    >
                      {postingStock ? 'Posting...' : 'Post Opening Stock to GL & Ledger'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Threshold configuration modal */}
      {showConfigModal && configItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-500/50 backdrop-blur-sm" onClick={() => setShowConfigModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full relative z-10 p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-gray-900">Threshold Setup</h2>
              <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-gray-750 transition">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-gray-600 mb-4 bg-gray-50 p-2.5 border border-gray-200 rounded">
              Setting levels for: <span className="text-gray-900 font-semibold">{configItem.name}</span>
            </p>

            <form onSubmit={handleConfigSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Par Level</label>
                  <input
                    type="number"
                    value={parLevel}
                    onChange={(e) => setParLevel(parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Reorder Pt</label>
                  <input
                    type="number"
                    value={reorderPoint}
                    onChange={(e) => setReorderPoint(parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Max Level</label>
                  <input
                    type="number"
                    value={maxLevel}
                    onChange={(e) => setMaxLevel(parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="autoIndent"
                  checked={autoIndent}
                  onChange={(e) => setAutoIndent(e.target.checked)}
                  className="w-4 h-4 text-amber-600 bg-white border-gray-300 rounded focus:ring-amber-500"
                />
                <label htmlFor="autoIndent" className="text-sm text-gray-700 cursor-pointer select-none">
                  Auto-trigger purchase requisition/indent when stock falls below reorder point
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-5">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingConfig}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2 rounded-lg text-sm transition"
                >
                  {submittingConfig ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
