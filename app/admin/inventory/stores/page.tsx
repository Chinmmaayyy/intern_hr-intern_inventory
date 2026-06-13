'use client';
import { useEffect, useState } from 'react';
import { listStores, createStore } from '@/app/actions/store-actions';
import { AdminPage } from '@/app/admin/components/AdminPage';
import {
  Store, Search, Plus, Filter, MapPin, User, CheckCircle2, XCircle,
  Eye, RefreshCw, X, AlertCircle
} from 'lucide-react';
import Link from 'next/link';

export default function StoresListPage() {
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

  return (
    <AdminPage 
      pageTitle="Stores & Stock Locations" 
      pageIcon={<Store className="h-5 w-5" />} 
      onRefresh={loadStores} 
      refreshing={loading}
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <p className="text-gray-500 text-sm mt-1">
            Manage hospital main stores, sub-stores, wards, and cost centers.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium px-4 py-2.5 rounded-lg shadow-md transition-all cursor-pointer"
        >
          <Plus size={18} />
          Create Store
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
        <form onSubmit={handleSearch} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search store name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button type="submit" className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer">
            Search
          </button>
        </form>

        <div className="flex w-full md:w-auto items-center gap-4">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter size={16} className="text-gray-500" />
            <select
              value={storeType}
              onChange={(e) => setStoreType(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg text-sm text-gray-700 px-3 py-2 focus:outline-none focus:border-indigo-500 w-full"
            >
              <option value="">All Store Types</option>
              {storeTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <button
            onClick={loadStores}
            className="p-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg transition"
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : stores.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 border border-gray-200 rounded-xl">
          <Store size={48} className="text-gray-400 mx-auto mb-3" />
          <p className="text-gray-900 text-lg font-medium">No stores found</p>
          <p className="text-gray-500 text-sm">Create a new store location to begin posting opening stock or indents.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-200 transition flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Store Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <span className="inline-flex text-[10px] font-bold tracking-wider text-indigo-600 uppercase bg-indigo-100 px-2 py-0.5 rounded mb-1">
                      {s.store_type}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 leading-tight">{s.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Code: {s.store_code}</p>
                  </div>
                  {s.is_active ? (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={12} /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-rose-700 font-semibold bg-rose-100 px-2 py-0.5 rounded-full">
                      <XCircle size={12} /> Inactive
                    </span>
                  )}
                </div>

                {/* Specs */}
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-gray-400" />
                    <span>Cost Center: {s.cost_center || 'Not Configured'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-gray-400" />
                    <span>In-charge: {s.incharge_user?.name || 'Unassigned'}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="border-t border-gray-100 pt-4 mt-5 flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  {s._count?.store_stocks || 0} Distinct SKUs
                </span>
                <Link
                  href={`/admin/inventory/stores/${s.id}`}
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-500 font-medium transition"
                >
                  <Eye size={15} />
                  View Stock & Config
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full relative z-10 p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-900">Create Store Location</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-900 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateStore} className="space-y-4">
              {formError && (
                <div className="flex items-start gap-2 bg-rose-50 text-rose-700 text-sm p-3 rounded-lg border border-rose-200">
                  <AlertCircle className="shrink-0 mt-0.5" size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Store Code</label>
                <input
                  type="text"
                  placeholder="e.g. ST-WARD-A"
                  value={storeCode}
                  onChange={(e) => setStoreCode(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Store Name</label>
                <input
                  type="text"
                  placeholder="e.g. ICU Ward A Substore"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Store Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-gray-900 focus:outline-none focus:border-indigo-500"
                >
                  {storeTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Cost Center Code</label>
                <input
                  type="text"
                  placeholder="e.g. CC-ICU"
                  value={costCenter}
                  onChange={(e) => setCostCenter(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4.5 h-4.5 text-indigo-600 bg-white border-gray-300 rounded focus:ring-indigo-500 focus:ring-2"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700 cursor-pointer">Set store as Active</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
