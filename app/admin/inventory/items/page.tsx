'use client';
import { useEffect, useState, useCallback } from 'react';
import { listItems, listItemCategories, approveItem, discontinueItem } from '@/app/actions/item-master-actions';
import { AdminPage } from '@/app/admin/components/AdminPage';
import {
  Search, Plus, Filter, Package, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Edit, RefreshCw, Download
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
          <Link href="/inventory/items/import"
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm transition-colors">
            <Download className="h-4 w-4" />
            Import
          </Link>
          <Link href="/inventory/items/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors">
            <Plus className="h-4 w-4" />
            New Item
          </Link>
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
                    <Link href={`/inventory/items/${item.id}`} className="text-gray-900 hover:text-blue-600 font-medium transition-colors">
                      {item.name}
                    </Link>
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
                      <Link href={`/inventory/items/${item.id}/edit`}
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                        <Edit className="h-3.5 w-3.5" />
                      </Link>
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
    </AdminPage>
  );
}
