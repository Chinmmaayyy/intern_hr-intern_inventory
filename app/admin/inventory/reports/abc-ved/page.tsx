'use client';
import { useEffect, useState } from 'react';
import { computeAbcVedMatrix } from '@/app/actions/inventory-analytics-actions';
import { listItems } from '@/app/actions/item-master-actions';
import {
  PieChart, RefreshCw, BarChart3, HelpCircle, Eye, ShieldAlert,
  ArrowRight, CheckCircle2, Award, Info
} from 'lucide-react';
import { AdminPage } from '@/app/admin/components/AdminPage';

export default function AbcVedAnalyticsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const loadData = async () => {
    setLoadingItems(true);
    const res = await listItems({ limit: 100 });
    if (res.success) {
      setItems(res.data?.items || []);
    }
    setLoadingItems(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecompute = async () => {
    setCalculating(true);
    const res = await computeAbcVedMatrix();
    setCalculating(false);
    if (res.success) {
      setStats(res.data);
      alert('ABC/VED Matrix recomputed successfully! Item classifications updated.');
      loadData();
    } else {
      alert(res.error || 'Failed to calculate ABC/VED matrix.');
    }
  };

  // Group items by classifications for local counts
  const aItems = items.filter(i => i.abc_class === 'A');
  const bItems = items.filter(i => i.abc_class === 'B');
  const cItems = items.filter(i => i.abc_class === 'C');

  const vItems = items.filter(i => i.ved_class === 'V');
  const eItems = items.filter(i => i.ved_class === 'E');
  const dItems = items.filter(i => i.ved_class === 'D');

  return (
    <AdminPage 
      pageTitle="ABC/VED Analytics" 
      pageIcon={<PieChart className="h-5 w-5" />} 
      onRefresh={loadData} 
      refreshing={loadingItems}
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <p className="text-gray-500 text-sm">
          Categorize products by annual consumption value (ABC) and clinical criticality (VED) to optimize safety stock.
        </p>
        <button
          onClick={handleRecompute}
          disabled={calculating}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${calculating ? 'animate-spin' : ''}`} />
          {calculating ? 'Recomputing Matrix...' : 'Recompute ABC/VED Matrix'}
        </button>
      </div>

      {/* Info Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="text-indigo-600" size={18} /> ABC Value Classification
          </h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Classify material lines based on cumulative annual purchase/consumption expenditure value.
          </p>
          <ul className="text-xs space-y-2 pt-1">
            <li className="flex justify-between items-center bg-gray-50 p-2 rounded">
              <span className="font-bold text-gray-900">Class A (High Value)</span>
              <span className="text-gray-500">70% cumulative value</span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-200 font-bold font-mono text-[10px]">{aItems.length} SKUs</span>
            </li>
            <li className="flex justify-between items-center bg-gray-50 p-2 rounded">
              <span className="font-bold text-gray-900">Class B (Medium Value)</span>
              <span className="text-gray-500">20% cumulative value</span>
              <span className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded border border-violet-200 font-bold font-mono text-[10px]">{bItems.length} SKUs</span>
            </li>
            <li className="flex justify-between items-center bg-gray-50 p-2 rounded">
              <span className="font-bold text-gray-900">Class C (Low Value)</span>
              <span className="text-gray-500">10% cumulative value</span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-bold font-mono text-[10px]">{cItems.length} SKUs</span>
            </li>
          </ul>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="text-amber-500" size={18} /> VED Criticality Classification
          </h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Categorize items based on operational criticality to avoid life-safety hospital shutdowns.
          </p>
          <ul className="text-xs space-y-2 pt-1">
            <li className="flex justify-between items-center bg-gray-50 p-2 rounded">
              <span className="font-bold text-gray-900">Vital (V)</span>
              <span className="text-gray-500">Life saving, high priority</span>
              <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded border border-rose-200 font-bold font-mono text-[10px]">{vItems.length} SKUs</span>
            </li>
            <li className="flex justify-between items-center bg-gray-50 p-2 rounded">
              <span className="font-bold text-gray-900">Essential (E)</span>
              <span className="text-gray-500">Moderate priority, standard stock</span>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded border border-amber-200 font-bold font-mono text-[10px]">{eItems.length} SKUs</span>
            </li>
            <li className="flex justify-between items-center bg-gray-50 p-2 rounded">
              <span className="font-bold text-gray-900">Desirable (D)</span>
              <span className="text-gray-500">Optional items, low priority</span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-bold font-mono text-[10px]">{dItems.length} SKUs</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Stats Summary from compute */}
      {stats && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl flex items-center gap-3">
          <CheckCircle2 size={20} className="text-emerald-600" />
          <div>
            <span className="font-bold">Matrix Recomputed:</span> Analyzed {stats.itemCount} active catalog items. Cumulative annual consumption valuation is ₹{stats.totalValue.toLocaleString('en-IN')}.
          </div>
        </div>
      )}

      {/* Item Master Class List */}
      <div className="space-y-3 mt-6">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Catalog Classifications Directory</h3>
        {loadingItems ? (
          <div className="flex justify-center items-center py-10">
            <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 bg-white border border-gray-200 rounded-xl text-gray-500">
            No items registered in catalog.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Item Code</th>
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Standard Price</th>
                  <th className="py-2.5 px-3 text-center">ABC Class</th>
                  <th className="py-2.5 px-3 text-center">VED Class</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-700">
                {items.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">{i.item_code}</td>
                    <td className="py-2.5 px-3 font-semibold text-gray-900">{i.name}</td>
                    <td className="py-2.5 px-3 text-gray-500">{i.category?.name || 'N/A'}</td>
                    <td className="py-2.5 px-3 text-right text-gray-500 font-medium">₹{Number(i.std_purchase_price || 0).toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded font-bold font-mono text-[10px] ${
                        i.abc_class === 'A' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                        i.abc_class === 'B' ? 'bg-violet-50 text-violet-600 border border-violet-200' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {i.abc_class || 'C'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded font-bold font-mono text-[10px] ${
                        i.ved_class === 'V' ? 'bg-rose-50 text-rose-600 border border-rose-200' :
                        i.ved_class === 'E' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {i.ved_class || 'D'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
