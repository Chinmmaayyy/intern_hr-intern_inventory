'use client';
import { useEffect, useState, use } from 'react';
import { getStoreById, getStoreStock, upsertStoreItemSetting, postOpeningStock } from '@/app/actions/store-actions';
import { listItems } from '@/app/actions/item-master-actions';
import { AdminPage } from '@/app/admin/components/AdminPage';
import {
  ArrowLeft, Store, Package, Plus, ClipboardList, Settings, Check,
  AlertTriangle, RefreshCw, X, Search, CheckCircle2, ChevronRight, MapPin, User, Activity, AlertCircle, ArrowUpRight
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function StoreDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const storeId = parseInt(resolvedParams.id);
  
  const pathname = usePathname();
  const routePrefix = pathname.startsWith('/admin') ? '/admin/inventory' : '/inventory';

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

  // Calculations for detail metrics
  const totalItemsCount = stock.length;
  const totalStockQty = stock.reduce((sum, s) => sum + (s.quantity_on_hand || 0), 0);
  const openingLinesTotalCost = openingLines.reduce((sum, l) => sum + (l.quantity * l.unit_cost), 0);

  return (
    <AdminPage
      pageTitle={store ? `${store.name}` : 'Store Details'}
      pageIcon={<Store size={20} />}
      onRefresh={loadStoreDetails}
      refreshing={loading}
      headerActions={
        <div className="flex gap-2">
          <Link
            href={`${routePrefix}/stores`}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-700 bg-white hover:bg-gray-50 transition-all shadow-sm"
          >
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> Back to Stores
          </Link>
          <button
            onClick={loadStoreDetails}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-700 bg-white hover:bg-gray-50 transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      }
    >
      {loading && !store ? (
        <div className="flex justify-center items-center py-32">
          <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
        </div>
      ) : !store ? (
        <div className="text-center py-20 bg-white border border-gray-150 rounded-2xl shadow-sm">
          <AlertTriangle className="text-amber-500 mx-auto mb-4" size={44} />
          <p className="text-gray-900 text-lg font-bold">Store Location not found</p>
          <Link href={`${routePrefix}/stores`} className="text-orange-500 hover:underline mt-2 inline-block font-semibold text-sm">
            Back to Stores list
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Metadata Card Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-gray-200/60 shadow-sm rounded-2xl p-5 hover:border-gray-300 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Cost Center</span>
                <div className="p-2 bg-blue-50 rounded-xl"><MapPin className="h-4 w-4 text-blue-500" /></div>
              </div>
              <p className="text-lg font-black text-gray-900">{store.cost_center || 'Not Configured'}</p>
              <p className="text-xs text-gray-400 mt-1">Branch: {store.branch?.branch_name || 'Main Organization'}</p>
            </div>

            <div className="bg-white border border-gray-200/60 shadow-sm rounded-2xl p-5 hover:border-gray-300 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">In-Charge Manager</span>
                <div className="p-2 bg-violet-50 rounded-xl"><User className="h-4 w-4 text-violet-500" /></div>
              </div>
              <p className="text-lg font-black text-gray-900">{store.incharge_user?.name || 'Unassigned'}</p>
              <p className="text-xs text-gray-400 mt-1">Authorized store management</p>
            </div>

            <div className="bg-white border border-gray-200/60 shadow-sm rounded-2xl p-5 hover:border-gray-300 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Stock Levels</span>
                <div className="p-2 bg-emerald-50 rounded-xl"><Package className="h-4 w-4 text-emerald-500" /></div>
              </div>
              <p className="text-lg font-black text-gray-900">{totalStockQty} Units</p>
              <p className="text-xs text-gray-400 mt-1">{totalItemsCount} distinct item batches</p>
            </div>
          </div>

          {/* Premium Navigation Tabs */}
          <div className="flex border-b border-gray-200 gap-6">
            <button
              onClick={() => setActiveTab('stock')}
              className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'stock'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Package size={16} /> Stock List ({totalItemsCount})
            </button>
            <button
              onClick={() => setActiveTab('reorder')}
              className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'reorder'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Settings size={16} /> Stock Thresholds ({store.store_settings?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('opening')}
              className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'opening'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Plus size={16} /> Opening Stock Posting
            </button>
          </div>

          {/* TAB 1: Stock List */}
          {activeTab === 'stock' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search stock list by item name..."
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition"
                  />
                </div>
              </div>

              <div className="bg-white border border-gray-150 shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/50 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                        <th className="py-3.5 px-5">Item Details</th>
                        <th className="py-3.5 px-5">Batch Number</th>
                        <th className="py-3.5 px-5 text-right">Qty On Hand</th>
                        <th className="py-3.5 px-5 text-right">Reorder Pt</th>
                        <th className="py-3.5 px-5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                      {stock.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-16 text-gray-400 text-sm">
                            <Package size={36} className="mx-auto text-gray-300 mb-2" />
                            <p className="font-semibold text-gray-600">No stock records found</p>
                            <p className="text-xs text-gray-400 mt-0.5">Go to 'Opening Stock Posting' to post initial inventory.</p>
                          </td>
                        </tr>
                      ) : (
                        stock.map((s) => {
                          const setting = store.store_settings?.find((st: any) => st.item_id === s.item_id);
                          const reorderPt = setting?.reorder_point ?? s.item?.reorder_point ?? 0;
                          const maxLvl = setting?.max_level ?? s.item?.max_level ?? 0;
                          
                          const lowStock = s.quantity_on_hand <= reorderPt;
                          const overStock = maxLvl > 0 && s.quantity_on_hand > maxLvl;

                          return (
                            <tr key={s.id} className="hover:bg-gray-50/30 transition-colors">
                              <td className="py-3.5 px-5">
                                <div className="font-bold text-gray-900 leading-snug">{s.item?.name}</div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{s.item?.item_code} · UOM: {s.item?.base_uom}</div>
                              </td>
                              <td className="py-3.5 px-5 font-mono text-xs text-gray-600 font-semibold">
                                {s.batch?.batch_no || <span className="text-gray-300 font-normal">—</span>}
                              </td>
                              <td className="py-3.5 px-5 text-right font-bold text-gray-900">
                                {s.quantity_on_hand}
                              </td>
                              <td className="py-3.5 px-5 text-right text-gray-500 font-medium">
                                {reorderPt}
                              </td>
                              <td className="py-3.5 px-5 text-center shrink-0">
                                {lowStock ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-55 px-2.5 py-1 rounded-full border border-rose-100">
                                    <AlertCircle size={10} /> Low Stock
                                  </span>
                                ) : overStock ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-55 px-2.5 py-1 rounded-full border border-blue-100">
                                    <ArrowUpRight size={10} /> Overstocked
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-55 px-2.5 py-1 rounded-full border border-emerald-100">
                                    <Check size={10} /> Optimal
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Threshold Settings */}
          {activeTab === 'reorder' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="bg-orange-50/50 border border-orange-100/60 p-4 rounded-2xl">
                <p className="text-xs font-semibold text-orange-800 leading-relaxed">
                  Set Par, Reorder Points, and Max stocking thresholds specifically for this store location. These values control automatic indents, purchase requisitions, and low stock warnings.
                </p>
              </div>

              <div className="bg-white border border-gray-150 shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/50 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                        <th className="py-3.5 px-5">Item</th>
                        <th className="py-3.5 px-5 text-center">Auto Indent</th>
                        <th className="py-3.5 px-5 text-right">Par Level</th>
                        <th className="py-3.5 px-5 text-right">Reorder Point</th>
                        <th className="py-3.5 px-5 text-right">Max Level</th>
                        <th className="py-3.5 px-5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                      {allItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-16 text-gray-400">
                            No master items available to configure thresholds.
                          </td>
                        </tr>
                      ) : (
                        allItems.map((item) => {
                          const setting = store.store_settings?.find((s: any) => s.item_id === item.id);
                          return (
                            <tr key={item.id} className="hover:bg-gray-50/30 transition-colors">
                              <td className="py-3.5 px-5">
                                <div className="font-bold text-gray-900 leading-snug">{item.name}</div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{item.item_code} · UOM: {item.base_uom}</div>
                              </td>
                              <td className="py-3.5 px-5 text-center">
                                {setting?.auto_indent ? (
                                  <span className="inline-flex bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-100 px-2.5 py-1 rounded-full uppercase tracking-wider">Auto-indent</span>
                                ) : (
                                  <span className="inline-flex bg-gray-105 text-gray-500 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Manual</span>
                                )}
                              </td>
                              <td className="py-3.5 px-5 text-right font-bold text-gray-900">{setting?.par_level ?? 0}</td>
                              <td className="py-3.5 px-5 text-right text-gray-600 font-semibold">{setting?.reorder_point ?? 0}</td>
                              <td className="py-3.5 px-5 text-right text-gray-600 font-semibold">{setting?.max_level ?? 0}</td>
                              <td className="py-3.5 px-5 text-center">
                                <button
                                  onClick={() => openConfigModal(item, setting)}
                                  className="bg-gray-900 hover:bg-gray-800 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-sm"
                                >
                                  Configure
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Opening Stock */}
          {activeTab === 'opening' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in-50 duration-200">
              {/* Form Card (5 cols) */}
              <div className="lg:col-span-5 bg-white border border-gray-150 shadow-sm rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-extrabold text-gray-900 border-b border-gray-105 pb-3 flex items-center gap-1.5">
                  <Plus className="h-4 w-4 text-orange-500" /> Post Opening Stock Form
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Select Item</label>
                    <select
                      value={selectedItemId}
                      onChange={(e) => setSelectedItemId(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-955 px-3.5 py-2.5 focus:outline-none focus:border-orange-500 cursor-pointer"
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
                    <div className="animate-in slide-in-from-top-1 duration-150">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Batch Number</label>
                      <input
                        type="text"
                        placeholder="e.g. BATCH-01"
                        value={openingBatch}
                        onChange={(e) => setOpeningBatch(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-955 px-3.5 py-2.5 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  )}

                  {selectedItemId && allItems.find(i => i.id === parseInt(selectedItemId))?.is_expiry_tracked && (
                    <div className="animate-in slide-in-from-top-1 duration-150">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Expiry Date</label>
                      <input
                        type="date"
                        value={openingExpiry}
                        onChange={(e) => setOpeningExpiry(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-955 px-3.5 py-2.5 focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={openingQty}
                        onChange={(e) => setOpeningQty(parseInt(e.target.value) || 0)}
                        className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-955 px-3.5 py-2.5 focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Unit Cost (INR)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={openingCost}
                        onChange={(e) => setOpeningCost(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-955 px-3.5 py-2.5 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={addOpeningLine}
                    className="bg-gray-955 hover:bg-gray-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer shadow-sm w-full uppercase tracking-wider"
                  >
                    Add Line Item
                  </button>
                </div>
              </div>

              {/* Pending Lines list (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white border border-gray-150 shadow-sm rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Opening Stock Lines</h4>
                    {openingLines.length > 0 && (
                      <span className="bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-100">
                        {openingLines.length} items to post
                      </span>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50/50 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                          <th className="py-2.5 px-4">Item</th>
                          <th className="py-2.5 px-4">Batch / Expiry</th>
                          <th className="py-2.5 px-4 text-right">Qty</th>
                          <th className="py-2.5 px-4 text-right">Cost/Unit</th>
                          <th className="py-2.5 px-4 text-right">Total</th>
                          <th className="py-2.5 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                        {openingLines.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-12 text-gray-400">
                              <ClipboardList className="mx-auto text-gray-300 mb-2" size={32} />
                              <p className="font-semibold text-gray-600 text-xs">No lines added yet</p>
                              <p className="text-[10px] text-gray-400">Configure inputs on the left form to build batch.</p>
                            </td>
                          </tr>
                        ) : (
                          openingLines.map((l, index) => (
                            <tr key={index} className="hover:bg-gray-50/20 transition-colors">
                              <td className="py-2.5 px-4">
                                <div className="font-bold text-gray-900 leading-snug">{l.name}</div>
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">UOM: {l.uom}</div>
                              </td>
                              <td className="py-2.5 px-4 text-xs font-mono text-gray-600 font-semibold">
                                {l.batch_no ? `B: ${l.batch_no}` : 'No Batch'}
                                {l.expiry_date ? ` | Exp: ${l.expiry_date}` : ''}
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold text-gray-900">{l.quantity}</td>
                              <td className="py-2.5 px-4 text-right text-gray-600 font-medium">₹{l.unit_cost.toFixed(2)}</td>
                              <td className="py-2.5 px-4 text-right font-bold text-orange-600">₹{(l.quantity * l.unit_cost).toFixed(2)}</td>
                              <td className="py-2.5 px-4 text-center">
                                <button onClick={() => removeOpeningLine(index)} className="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-gray-50 transition cursor-pointer">
                                  <X size={16} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {openingLines.length > 0 && (
                    <div className="bg-gray-50 border-t border-gray-100 p-4 flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Grand Total Value</span>
                      <span className="text-lg font-black text-orange-600">₹{openingLinesTotalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>

                {/* Posting Status Messages */}
                {postError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl text-sm flex gap-2 shadow-sm animate-in slide-in-from-bottom-2">
                    <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                    <div>
                      <h5 className="font-bold text-rose-900">Post Failed</h5>
                      <p className="text-xs mt-0.5 text-rose-700">{postError}</p>
                    </div>
                  </div>
                )}
                {postSuccess && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-105 text-emerald-850 rounded-xl text-sm flex gap-2 shadow-sm animate-in slide-in-from-bottom-2">
                    <CheckCircle2 className="shrink-0 mt-0.5" size={16} />
                    <div>
                      <h5 className="font-bold text-emerald-900">Success</h5>
                      <p className="text-xs mt-0.5 text-emerald-700">Opening stock posted. Dr Inventory and Cr Equity Ledger records generated!</p>
                    </div>
                  </div>
                )}

                {openingLines.length > 0 && (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handlePostOpeningStock}
                      disabled={postingStock}
                      className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      {postingStock ? 'Posting Inventory...' : 'Post Opening Stock to GL'}
                      <ChevronRight size={16} />
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
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md transition-opacity" onClick={() => setShowConfigModal(false)}></div>
          <div className="bg-white border border-gray-100 rounded-2xl max-w-md w-full relative z-10 p-6 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Ambient background glows inside modal */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex justify-between items-center mb-5 relative z-10">
              <h2 className="text-lg font-extrabold text-gray-900">Threshold Setup</h2>
              <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-50 transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-orange-850 bg-orange-50/50 p-3.5 border border-orange-100 rounded-xl mb-4 relative z-10">
              Setting custom replenishment parameters for:<br />
              <strong className="text-gray-900 text-sm mt-1 block">{configItem.name}</strong>
            </div>

            <form onSubmit={handleConfigSubmit} className="space-y-4 relative z-10">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Par Level</label>
                  <input
                    type="number"
                    value={parLevel}
                    onChange={(e) => setParLevel(parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-955 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Reorder Pt</label>
                  <input
                    type="number"
                    value={reorderPoint}
                    onChange={(e) => setReorderPoint(parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-955 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Max Level</label>
                  <input
                    type="number"
                    value={maxLevel}
                    onChange={(e) => setMaxLevel(parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-955 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="autoIndent"
                  checked={autoIndent}
                  onChange={(e) => setAutoIndent(e.target.checked)}
                  className="w-4.5 h-4.5 text-orange-600 bg-white border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                />
                <label htmlFor="autoIndent" className="text-xs font-semibold text-gray-700 cursor-pointer select-none leading-normal">
                  Auto-trigger purchase requisition or internal indent when stock falls below reorder point
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-5">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingConfig}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition shadow-md"
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
