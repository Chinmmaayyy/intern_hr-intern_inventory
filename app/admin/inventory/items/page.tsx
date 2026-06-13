'use client';
import { useEffect, useState, useCallback } from 'react';
import { listItems, listItemCategories, approveItem, discontinueItem, createItem } from '@/app/actions/item-master-actions';
import MasterImportButton from '@/app/components/master/MasterImportButton';
import { AdminPage } from '@/app/admin/components/AdminPage';
import {
  Search, Plus, Filter, Package, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Edit, RefreshCw, Download, X, AlertCircle
} from 'lucide-react';
import Link from 'next/link';

const ITEM_TYPES = ['CONSUMABLE','REAGENT','IMPLANT','LINEN','STATIONERY','MAINTENANCE','EQUIPMENT_SPARE','FOOD_DIETARY','OTHER'];
const STATUS_OPTS = ['Active','Draft','Discontinued'];
const ABC_OPTS = ['A','B','C'];

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Draft: 'bg-amber-100 text-amber-700 border-amber-200',
  Discontinued: 'bg-gray-100 text-gray-600 border-gray-200',
};

const EMPTY_FORM = {
  name: '',
  description: '',
  category_id: '',
  item_type: 'CONSUMABLE',
  base_uom: 'EA',
  purchase_uom: 'EA',
  uom_conversion: 1,
  hsn_sac_code: '',
  gst_rate: 0,
  std_purchase_price: 0,
  selling_price: 0,
  mrp: 0,
  is_batch_tracked: false,
  is_expiry_tracked: false,
  is_patient_chargeable: false,
  is_returnable: true,
  is_cold_chain: false,
  min_level: 0,
  max_level: 0,
  reorder_point: 0,
  lead_time_days: 0,
  status: 'Draft' as const,
};

export default function ItemsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [itemType, setItemType] = useState('');
  const [status, setStatus] = useState('');
  const [abcClass, setAbcClass] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listItems({
      search, page, limit: 20,
      category_id: categoryId ? parseInt(categoryId) : undefined,
      item_type: itemType || undefined,
      status: status || undefined,
      abc_class: abcClass || undefined,
    });
    if (res.success) {
      setItems(res.data.items);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    }
    setLoading(false);
  }, [search, page, categoryId, itemType, status, abcClass]);

  useEffect(() => { listItemCategories().then(r => { if (r.success) setCategories(r.data); }); }, []);
  useEffect(() => { setPage(1); }, [search, categoryId, itemType, status, abcClass]);
  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: number) => {
    setActionLoading(id);
    await approveItem(id);
    await load();
    setActionLoading(null);
  };

  const handleDiscontinue = async (id: number) => {
    const reason = window.prompt('Reason for discontinuation:');
    if (!reason) return;
    setActionLoading(id);
    await discontinueItem(id, reason);
    await load();
    setActionLoading(null);
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim() || !form.category_id) {
      setFormError('Name and category are required.');
      return;
    }
    setSubmitting(true);
    const itemCode = `ITM-${Date.now().toString(36).toUpperCase()}`;
    const res = await createItem({
      ...form,
      item_code: itemCode,
      category_id: parseInt(form.category_id),
      uom_conversion: Number(form.uom_conversion),
      gst_rate: Number(form.gst_rate),
      std_purchase_price: Number(form.std_purchase_price),
      selling_price: Number(form.selling_price),
      mrp: Number(form.mrp),
      min_level: Number(form.min_level),
      max_level: Number(form.max_level),
      reorder_point: Number(form.reorder_point),
      lead_time_days: Number(form.lead_time_days),
    });
    setSubmitting(false);
    if (res.success) {
      setShowCreateModal(false);
      setForm(EMPTY_FORM);
      await load();
    } else {
      setFormError(res.error || 'Failed to create item.');
    }
  };

  return (
    <AdminPage 
      pageTitle="Item Catalog" 
      pageIcon={<Package className="h-5 w-5" />} 
      onRefresh={load} 
      refreshing={loading}
    >
      {/* Header overrides */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-500 text-sm mt-0.5">{total.toLocaleString('en-IN')} items</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm transition-colors">
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <MasterImportButton type="item_master" onImportComplete={load} />
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors">
            <Plus className="h-4 w-4" />
            New Item
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, code or barcode…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              className="bg-white text-gray-900 rounded-lg px-3 py-2 text-sm border border-gray-200 focus:outline-none focus:border-blue-500">
              <option value="">All Categories</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={itemType} onChange={e => setItemType(e.target.value)}
              className="bg-white text-gray-900 rounded-lg px-3 py-2 text-sm border border-gray-200 focus:outline-none focus:border-blue-500">
              <option value="">All Types</option>
              {ITEM_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="bg-white text-gray-900 rounded-lg px-3 py-2 text-sm border border-gray-200 focus:outline-none focus:border-blue-500">
              <option value="">All Status</option>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={abcClass} onChange={e => setAbcClass(e.target.value)}
              className="bg-white text-gray-900 rounded-lg px-3 py-2 text-sm border border-gray-200 focus:outline-none focus:border-blue-500">
              <option value="">All ABC</option>
              {ABC_OPTS.map(a => <option key={a} value={a}>{a}-Class</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Code</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Category</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Type</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Stock</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">ABC</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No items found
                  </td>
                </tr>
              ) : items.map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-blue-600 text-xs">{item.item_code}</td>
                  <td className="px-4 py-3">
                    <span className="text-gray-900 font-medium">{item.name}</span>
                    {item.is_cold_chain && <span className="ml-1 text-xs text-cyan-600">❄</span>}
                    {item.is_batch_tracked && <span className="ml-1 text-xs text-amber-600">B</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{item.category?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{item.item_type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${item.total_stock === 0 ? 'text-rose-600' : item.total_stock <= item.reorder_point ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {item.total_stock}
                    </span>
                    <span className="text-gray-500 text-xs ml-1">{item.base_uom}</span>
                  </td>
                  <td className="px-4 py-3">
                    {item.abc_class ? (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${item.abc_class === 'A' ? 'bg-red-100 text-red-700' : item.abc_class === 'B' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>
                        {item.abc_class}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {item.status === 'Draft' && (
                        <button onClick={() => handleApprove(item.id)} disabled={actionLoading === item.id}
                          className="p-1 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                          <CheckCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {item.status === 'Active' && (
                        <button onClick={() => handleDiscontinue(item.id)} disabled={actionLoading === item.id}
                          className="p-1 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-gray-500 text-xs">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="bg-white border border-gray-200 rounded-xl max-w-lg w-full relative z-10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">New Item</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-900"><X size={20} /></button>
            </div>
            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
                <AlertCircle size={16} /> {formError}
              </div>
            )}
            <form onSubmit={handleCreateItem} className="space-y-3">
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Item name" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <select required value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Select category</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={form.item_type} onChange={e => setForm({ ...form, item_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {ITEM_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.base_uom} onChange={e => setForm({ ...form, base_uom: e.target.value })}
                  placeholder="Base UOM" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                <input type="number" min="0" step="0.01" value={form.std_purchase_price}
                  onChange={e => setForm({ ...form, std_purchase_price: Number(e.target.value) })}
                  placeholder="Purchase price" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_batch_tracked} onChange={e => setForm({ ...form, is_batch_tracked: e.target.checked })} /> Batch tracked</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_expiry_tracked} onChange={e => setForm({ ...form, is_expiry_tracked: e.target.checked })} /> Expiry tracked</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_patient_chargeable} onChange={e => setForm({ ...form, is_patient_chargeable: e.target.checked })} /> Patient chargeable</label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                  {submitting ? 'Creating...' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
