'use client';
import { useEffect, useState } from 'react';
import { listStores, createStore } from '@/app/actions/store-actions';
import { AdminPage } from '@/app/admin/components/AdminPage';
import {
  Store, Search, Plus, Filter, MapPin, User, CheckCircle2, XCircle,
  Eye, RefreshCw, X, AlertCircle, Layers, ChevronRight, ClipboardList
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function StoresListPage() {
  const pathname = usePathname();
  const routePrefix = pathname.startsWith('/admin') ? '/admin/inventory' : '/inventory';

  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [storeType, setStoreType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [storeCode, setStoreCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('WARD');
  const [costCenter, setCostCenter] = useState('');
  const [isActive, setIsActive] = useState(true);

  const loadStores = async () => {
    setLoading(true);
    const res = await listStores({ search, store_type: storeType });
    if (res.success) {
      setStores(res.data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStores();
  }, [storeType]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadStores();
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!storeCode.trim() || !name.trim()) {
      setFormError('Store code and name are required.');
      return;
    }
    setSubmitting(true);
    const res = await createStore({
      store_code: storeCode.trim(),
      name: name.trim(),
      store_type: type,
      cost_center: costCenter.trim() || null,
      is_active: isActive
    });
    setSubmitting(false);
    if (res.success) {
      setShowModal(false);
      loadStores();
      // Clear fields
      setStoreCode('');
      setName('');
      setType('WARD');
      setCostCenter('');
    } else {
      setFormError(res.error || 'Failed to create store.');
    }
  };

  const storeTypes = [
    'CENTRAL', 'PHARMACY', 'WARD', 'OT', 'ER', 'LAB', 'RADIOLOGY',
    'MAINTENANCE', 'HOUSEKEEPING', 'KITCHEN', 'CSSD'
  ];

  // Stats calculation
  const totalStores = stores.length;
  const activeStores = stores.filter(s => s.is_active).length;
  const centralStores = stores.filter(s => s.store_type === 'CENTRAL').length;
  const totalSKUs = stores.reduce((acc, s) => acc + (s._count?.store_stocks || 0), 0);

  // Type theme mapping for UI color accents
  const getTypeTheme = (type: string) => {
    const map: Record<string, { bg: string, text: string, border: string, accent: string, textMuted: string }> = {
      CENTRAL: { bg: 'bg-blue-50 text-blue-700', text: 'text-blue-700', border: 'border-blue-200', accent: 'bg-blue-600', textMuted: 'text-blue-500' },
      PHARMACY: { bg: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-700', border: 'border-emerald-200', accent: 'bg-emerald-600 text-emerald-500', textMuted: 'text-emerald-500' },
      WARD: { bg: 'bg-sky-50 text-sky-700', text: 'text-sky-700', border: 'border-sky-200', accent: 'bg-sky-600', textMuted: 'text-sky-500' },
      OT: { bg: 'bg-rose-50 text-rose-700', text: 'text-rose-700', border: 'border-rose-200', accent: 'bg-rose-600', textMuted: 'text-rose-500' },
      ER: { bg: 'bg-amber-50 text-amber-700', text: 'text-amber-700', border: 'border-amber-200', accent: 'bg-amber-600', textMuted: 'text-amber-500' },
      LAB: { bg: 'bg-violet-50 text-violet-700', text: 'text-violet-700', border: 'border-violet-200', accent: 'bg-violet-600', textMuted: 'text-violet-500' },
    };
    return map[type] || { bg: 'bg-gray-50 text-gray-700', text: 'text-gray-700', border: 'border-gray-200', accent: 'bg-gray-600', textMuted: 'text-gray-500' };
  };

  return (
    <AdminPage 
      pageTitle="Stores & Stock Locations" 
      pageIcon={<Store className="h-5 w-5" />} 
      onRefresh={loadStores} 
      refreshing={loading}
    >
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <p className="text-gray-500 text-sm">
            Manage hospital main stores, sub-stores, wards, and cost centers.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer text-sm"
        >
          <Plus size={18} />
          Create Store
        </button>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200/60 shadow-sm rounded-2xl p-5 hover:border-orange-205 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Locations</span>
            <div className="p-2 bg-orange-50 rounded-xl"><Store className="h-4 w-4 text-orange-500" /></div>
          </div>
          <p className="text-3xl font-black text-gray-900">{totalStores}</p>
          <p className="text-xs text-gray-400 mt-1">Configured store rooms</p>
        </div>

        <div className="bg-white border border-gray-200/60 shadow-sm rounded-2xl p-5 hover:border-emerald-205 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Active Stores</span>
            <div className="p-2 bg-emerald-50 rounded-xl"><CheckCircle2 className="h-4 w-4 text-emerald-500" /></div>
          </div>
          <p className="text-3xl font-black text-gray-900">{activeStores}</p>
          <p className="text-xs text-gray-400 mt-1">Accepting stock issues</p>
        </div>

        <div className="bg-white border border-gray-200/60 shadow-sm rounded-2xl p-5 hover:border-blue-205 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Central Stores</span>
            <div className="p-2 bg-blue-50 rounded-xl"><Layers className="h-4 w-4 text-blue-500" /></div>
          </div>
          <p className="text-3xl font-black text-gray-900">{centralStores}</p>
          <p className="text-xs text-gray-400 mt-1">Main warehouses</p>
        </div>

        <div className="bg-white border border-gray-200/60 shadow-sm rounded-2xl p-5 hover:border-violet-205 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tracked SKUs</span>
            <div className="p-2 bg-violet-50 rounded-xl"><ClipboardList className="h-4 w-4 text-violet-500" /></div>
          </div>
          <p className="text-3xl font-black text-gray-900">{totalSKUs}</p>
          <p className="text-xs text-gray-400 mt-1">Across all store sites</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-gray-200/60 shadow-sm rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
        <form onSubmit={handleSearch} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search store name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-955 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
            />
          </div>
          <button type="submit" className="bg-gray-950 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer shadow-sm">
            Search
          </button>
        </form>

        <div className="flex w-full md:w-auto items-center gap-3">
          <div className="flex items-center gap-2 w-full md:w-auto bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={storeType}
              onChange={(e) => setStoreType(e.target.value)}
              className="bg-transparent border-0 text-sm text-gray-700 font-medium focus:outline-none w-full pr-8 cursor-pointer"
            >
              <option value="">All Store Types</option>
              {storeTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <button
            onClick={loadStores}
            className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700 rounded-xl transition cursor-pointer shadow-sm"
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
        </div>
      ) : stores.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-150 rounded-2xl shadow-sm">
          <Store size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-900 text-lg font-bold">No stores found</p>
          <p className="text-gray-400 text-sm max-w-sm mx-auto mt-1">Create a new store location to begin posting opening stock, internal indents, or procurement receipts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((s) => {
            const theme = getTypeTheme(s.store_type);
            const skuCount = s._count?.store_stocks || 0;
            const skuPercent = Math.min((skuCount / 40) * 100, 100); // Dynamic filling up to 40 items

            return (
              <div
                key={s.id}
                className="group bg-white border border-gray-155 rounded-2xl p-5 hover:shadow-lg hover:border-gray-250 transition-all duration-300 flex flex-col justify-between relative overflow-hidden animate-in fade-in-50 duration-200"
              >
                {/* Decorative background shape */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform duration-300" />
                
                <div className="space-y-4 relative z-10">
                  {/* Store Header */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm uppercase ${theme.bg}`}>
                        {s.store_type.substring(0, 2)}
                      </div>
                      <div>
                        <span className={`inline-flex text-[9px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full ${theme.bg}`}>
                          {s.store_type}
                        </span>
                        <h3 className="text-base font-bold text-gray-900 leading-snug mt-0.5 group-hover:text-orange-600 transition-colors">{s.name}</h3>
                        <p className="text-[10px] text-gray-400 font-semibold tracking-wider uppercase mt-0.5">Code: {s.store_code}</p>
                      </div>
                    </div>

                    {s.is_active ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                        <CheckCircle2 size={10} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-rose-700 font-bold bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full shrink-0">
                        <XCircle size={10} /> Inactive
                      </span>
                    )}
                  </div>

                  {/* Stock Diversity Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <span>Stock Diversity</span>
                      <span className="text-gray-700">{skuCount} SKUs</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-105 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${theme.accent}`} style={{ width: `${skuPercent}%` }} />
                    </div>
                  </div>

                  {/* Metadata Specs */}
                  <div className="space-y-2 pt-1 border-t border-gray-50 text-xs font-medium text-gray-500">
                    <div className="flex items-center gap-2">
                      <MapPin size={13} className="text-gray-400" />
                      <span>Cost Center: <strong className="text-gray-700">{s.cost_center || 'Not Configured'}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User size={13} className="text-gray-400" />
                      <span>In-charge: <strong className="text-gray-700">{s.incharge_user?.name || 'Unassigned'}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="border-t border-gray-100 pt-4 mt-5 flex justify-between items-center relative z-10">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {skuCount > 0 ? `${skuCount} items stocked` : 'Empty store'}
                  </span>
                  
                  <Link
                    href={`${routePrefix}/stores/${s.id}`}
                    className={`group/btn flex items-center gap-1 text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all ${theme.bg} hover:shadow-sm`}
                  >
                    Manage Store
                    <ChevronRight size={13} className="group-hover/btn:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md transition-opacity" onClick={() => setShowModal(false)}></div>
          <div className="bg-white border border-gray-100 rounded-2xl max-w-md w-full relative z-10 p-6 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Ambient background glows inside modal */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex justify-between items-center mb-5 relative z-10">
              <h2 className="text-lg font-extrabold text-gray-900">Create Store Location</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-50 transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStore} className="space-y-4 relative z-10">
              {formError && (
                <div className="flex items-start gap-2 bg-rose-50 text-rose-700 text-sm p-3.5 rounded-xl border border-rose-100 shadow-sm">
                  <AlertCircle className="shrink-0 mt-0.5" size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Store Code</label>
                <input
                  type="text"
                  placeholder="e.g. ST-WARD-A"
                  value={storeCode}
                  onChange={(e) => setStoreCode(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-955 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Store Name</label>
                <input
                  type="text"
                  placeholder="e.g. ICU Ward A Substore"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-955 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Store Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-955 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition cursor-pointer"
                >
                  {storeTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Cost Center Code</label>
                <input
                  type="text"
                  placeholder="e.g. CC-ICU"
                  value={costCenter}
                  onChange={(e) => setCostCenter(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-955 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4.5 h-4.5 text-orange-600 bg-white border-gray-300 rounded focus:ring-orange-500 focus:ring-2 cursor-pointer"
                />
                <label htmlFor="isActive" className="text-sm font-semibold text-gray-700 cursor-pointer select-none">Set store as Active</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-orange-600 hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 cursor-pointer shadow-md"
                >
                  {submitting ? 'Creating...' : 'Create Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
