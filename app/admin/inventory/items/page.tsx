'use client';
import { useEffect, useState, useCallback } from 'react';
<<<<<<< HEAD
import { listItems, listItemCategories, approveItem, discontinueItem, createItem, createItemCategory } from '@/app/actions/item-master-actions';
import { AdminPage } from '@/app/admin/components/AdminPage';
import {
  Search, Plus, Filter, Package, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Edit, RefreshCw, Download, X, AlertCircle
=======
import { listItems, listItemCategories, approveItem, discontinueItem } from '@/app/actions/item-master-actions';
import { AdminPage } from '@/app/admin/components/AdminPage';
import {
  Search, Plus, Filter, Package, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Edit, RefreshCw, Download
>>>>>>> ac65a1c0df7665e61b0298cf6a76384e7d1a588a
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

<<<<<<< HEAD
const EMPTY_FORM = {
  item_code: '',
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
  abc_class: '',
  ved_class: '',
  min_level: 0,
  max_level: 0,
  reorder_point: 0,
  lead_time_days: 0,
  barcode: '',
  status: 'Active',
};

=======
>>>>>>> ac65a1c0df7665e61b0298cf6a76384e7d1a588a
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
  const [status, setStatus] = useState('Active');
  const [abcClass, setAbcClass] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

<<<<<<< HEAD
  // New Item Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // New Category Modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', item_type: 'CONSUMABLE' });
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryError, setCategoryError] = useState('');

=======
>>>>>>> ac65a1c0df7665e61b0298cf6a76384e7d1a588a
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

<<<<<<< HEAD
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formData.item_code.trim() || !formData.name.trim()) {
      setFormError('Item code and name are required.');
      return;
    }
    if (!formData.category_id) {
      setFormError('Category is required.');
      return;
    }

    setSubmitting(true);
    const res = await createItem({
      ...formData,
      category_id: parseInt(formData.category_id),
      abc_class: formData.abc_class || null,
      ved_class: formData.ved_class || null,
      description: formData.description || null,
      hsn_sac_code: formData.hsn_sac_code || null,
      barcode: formData.barcode || null,
    });
    setSubmitting(false);

    if (res.success) {
      setShowCreateModal(false);
      setFormData({ ...EMPTY_FORM });
      load();
    } else {
      setFormError(res.error || 'Failed to create item.');
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError('');
    if (!categoryForm.name.trim()) {
      setCategoryError('Category name is required.');
      return;
    }
    setCategorySubmitting(true);
    const res = await createItemCategory(categoryForm);
    setCategorySubmitting(false);
    if (res.success) {
      listItemCategories().then(r => { if (r.success) setCategories(r.data); });
      setFormData(prev => ({ ...prev, category_id: String(res.data.id) }));
      setShowCategoryModal(false);
      setCategoryForm({ name: '', item_type: 'CONSUMABLE' });
    } else {
      setCategoryError(res.error || 'Failed to create category.');
    }
  };

=======
>>>>>>> ac65a1c0df7665e61b0298cf6a76384e7d1a588a
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
<<<<<<< HEAD
          <Link href="/admin/inventory/items/import"
=======
          <Link href="/inventory/items/import"
>>>>>>> ac65a1c0df7665e61b0298cf6a76384e7d1a588a
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm transition-colors">
            <Download className="h-4 w-4" />
            Import
          </Link>
<<<<<<< HEAD
          <button
            onClick={() => { setFormData({ ...EMPTY_FORM }); setFormError(''); setShowCreateModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors">
            <Plus className="h-4 w-4" />
            New Item
          </button>
=======
          <Link href="/inventory/items/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors">
            <Plus className="h-4 w-4" />
            New Item
          </Link>
>>>>>>> ac65a1c0df7665e61b0298cf6a76384e7d1a588a
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
<<<<<<< HEAD
                    <span className="text-gray-900 font-medium">
                      {item.name}
                    </span>
=======
                    <Link href={`/inventory/items/${item.id}`} className="text-gray-900 hover:text-blue-600 font-medium transition-colors">
                      {item.name}
                    </Link>
>>>>>>> ac65a1c0df7665e61b0298cf6a76384e7d1a588a
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
<<<<<<< HEAD
=======
                      <Link href={`/inventory/items/${item.id}/edit`}
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                        <Edit className="h-3.5 w-3.5" />
                      </Link>
>>>>>>> ac65a1c0df7665e61b0298cf6a76384e7d1a588a
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
<<<<<<< HEAD

      {/* New Item Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-xl max-w-2xl w-full relative z-10 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-900">Create New Item</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-900 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex gap-2">
                  <AlertCircle className="shrink-0 mt-0.5" size={16} />
                  <span>{formError}</span>
                </div>
              )}

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Item Code *</label>
                  <input type="text" value={formData.item_code} onChange={e => updateField('item_code', e.target.value)}
                    placeholder="e.g. CON-001" required
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Item Name *</label>
                  <input type="text" value={formData.name} onChange={e => updateField('name', e.target.value)}
                    placeholder="e.g. Surgical Gloves" required
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Category *</label>
                    <button type="button" onClick={() => setShowCategoryModal(true)} className="text-xs text-blue-600 hover:text-blue-500 font-semibold flex items-center gap-1">
                      <Plus size={12} /> New
                    </button>
                  </div>
                  <select value={formData.category_id} onChange={e => updateField('category_id', e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" required>
                    <option value="">Select category...</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Item Type *</label>
                  <select value={formData.item_type} onChange={e => updateField('item_type', e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900">
                    {ITEM_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>

              {/* UOM & Pricing */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Base UOM</label>
                  <input type="text" value={formData.base_uom} onChange={e => updateField('base_uom', e.target.value)}
                    placeholder="EA" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Purchase UOM</label>
                  <input type="text" value={formData.purchase_uom} onChange={e => updateField('purchase_uom', e.target.value)}
                    placeholder="BOX" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">UOM Conversion</label>
                  <input type="number" min="0.01" step="0.01" value={formData.uom_conversion} onChange={e => updateField('uom_conversion', parseFloat(e.target.value) || 1)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Purchase Price (₹)</label>
                  <input type="number" min="0" step="0.01" value={formData.std_purchase_price} onChange={e => updateField('std_purchase_price', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Selling Price (₹)</label>
                  <input type="number" min="0" step="0.01" value={formData.selling_price} onChange={e => updateField('selling_price', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">GST Rate (%)</label>
                  <input type="number" min="0" step="0.01" value={formData.gst_rate} onChange={e => updateField('gst_rate', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
              </div>

              {/* Stock Levels */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Min Level</label>
                  <input type="number" min="0" value={formData.min_level} onChange={e => updateField('min_level', parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Reorder Point</label>
                  <input type="number" min="0" value={formData.reorder_point} onChange={e => updateField('reorder_point', parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Max Level</label>
                  <input type="number" min="0" value={formData.max_level} onChange={e => updateField('max_level', parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
              </div>

              {/* Flags */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={formData.is_batch_tracked} onChange={e => updateField('is_batch_tracked', e.target.checked)} className="rounded" />
                  Batch Tracked
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={formData.is_expiry_tracked} onChange={e => updateField('is_expiry_tracked', e.target.checked)} className="rounded" />
                  Expiry Tracked
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={formData.is_patient_chargeable} onChange={e => updateField('is_patient_chargeable', e.target.checked)} className="rounded" />
                  Patient Chargeable
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={formData.is_cold_chain} onChange={e => updateField('is_cold_chain', e.target.checked)} className="rounded" />
                  Cold Chain
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={formData.is_returnable} onChange={e => updateField('is_returnable', e.target.checked)} className="rounded" />
                  Returnable
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-5">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-sm transition disabled:opacity-50">
                  {submitting ? 'Creating...' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* New Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCategoryModal(false)}></div>
          <div className="bg-white border border-gray-200 rounded-xl max-w-sm w-full relative z-10 p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-gray-900">Create Category</h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-gray-500 hover:text-gray-900 transition">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              {categoryError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex gap-2">
                  <AlertCircle className="shrink-0 mt-0.5" size={14} />
                  <span>{categoryError}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category Name *</label>
                <input type="text" value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="e.g. Surgical Equipment" required
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Default Item Type *</label>
                <select value={categoryForm.item_type} onChange={e => setCategoryForm({ ...categoryForm, item_type: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" required>
                  {ITEM_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-5">
                <button type="button" onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={categorySubmitting}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-sm transition disabled:opacity-50">
                  {categorySubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
=======
>>>>>>> ac65a1c0df7665e61b0298cf6a76384e7d1a588a
    </AdminPage>
  );
}
