'use client';
import { useEffect, useState } from 'react';
import { getInventoryDashboardSummary } from '@/app/actions/inventory-analytics-actions';
import { getSlowMovingStocks } from '@/app/actions/inventory-analytics-actions';
import { getExpiryForecast } from '@/app/actions/inventory-analytics-actions';
import {
  TrendingUp, TrendingDown, Clock, AlertTriangle, AlertCircle, RefreshCw, BarChart3,
  Calendar, FileText, ChevronRight, Package, Landmark
} from 'lucide-react';
import { AdminPage } from '@/app/admin/components/AdminPage';

export default function ReportsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [slowMoving, setSlowMoving] = useState<any[]>([]);
  const [nearExpiry, setNearExpiry] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [sumRes, slowRes, expRes] = await Promise.all([
      getInventoryDashboardSummary(),
      getSlowMovingStocks(90),
      getExpiryForecast(90)
    ]);
    if (sumRes.success) setSummary(sumRes.data);
    if (slowRes.success) setSlowMoving(slowRes.data?.slow_moving || []);
    if (expRes.success) setNearExpiry(expRes.data?.near_expiry || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AdminPage 
      pageTitle="Inventory Reports & Valuations" 
      pageIcon={<FileText className="h-5 w-5" />} 
      onRefresh={loadData} 
      refreshing={loading}
    >
      <div className="mb-6">
        <p className="text-gray-500 text-sm">
          Analyze slow-moving items, track batch expiration risk windows, and review double-entry GL reconciliation details.
        </p>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Book Valuation</span>
            <span className="block text-2xl font-black text-gray-900 mt-1">
              ₹{Number(summary?.totalStockValue || 0).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-gray-500 mt-1 block">Tied up in {summary?.totalItems || 0} active SKUs</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <BarChart3 size={24} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Expiry Threat (90d)</span>
            <span className="block text-2xl font-black text-amber-600 mt-1">
              {summary?.expiringIn90Days || 0} Batches
            </span>
            <span className="text-[10px] text-gray-500 mt-1 block">Expiring within 3 months</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock size={24} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Zero Stock SKUs</span>
            <span className="block text-2xl font-black text-rose-600 mt-1">
              {summary?.zeroStockCount || 0} SKUs
            </span>
            <span className="text-[10px] text-gray-500 mt-1 block">Out of stock globally</span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <TrendingDown size={24} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Expiry Risk Analysis */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-md font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={18} /> Near-Expiry Materials Forecast
          </h3>
          <p className="text-xs text-gray-500">
            Batches expiring soon. Coordinate with ward nursing stations to utilize these before write-off triggers.
          </p>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Item / Batch</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3 text-right">Available Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-700">
                {nearExpiry.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-gray-500">No batches expiring in the next 90 days.</td>
                  </tr>
                ) : (
                  nearExpiry.map((x, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-gray-900">{x.item_name}</div>
                        <div className="text-[10px] text-gray-500">Batch: {x.batch_no}</div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-amber-600">{new Date(x.expiry_date).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-gray-900">{x.quantity_on_hand}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Slow Moving Items Analysis */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-md font-bold text-gray-900 flex items-center gap-2">
            <TrendingDown className="text-rose-500" size={18} /> Slow-Moving Items (90d Audit)
          </h3>
          <p className="text-xs text-gray-500">
            SKUs with zero movement or consumption logged in the last 90 days. Review holding costs and reorder thresholds.
          </p>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">SKU Details</th>
                  <th className="py-2.5 px-3 text-right">Current Stock</th>
                  <th className="py-2.5 px-3 text-right">Standard Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-700">
                {slowMoving.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-gray-500">No slow-moving items found.</td>
                  </tr>
                ) : (
                  slowMoving.map((x, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-gray-900">{x.name}</div>
                        <div className="text-[10px] text-gray-500">Code: {x.item_code} | UOM: {x.base_uom}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-gray-900">{x.total_stock}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-indigo-600">₹{Number(x.std_purchase_price).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminPage>
  );
}
