'use client';
import { useEffect, useState, useCallback } from 'react';
import { getInventoryDashboardSummary, getSlowMovingStocks, getExpiryForecast } from '@/app/actions/inventory-analytics-actions';
import {
    Package, Store, TrendingDown, AlertTriangle, Clock, BarChart3,
    ChevronRight, RefreshCw, Box, ShoppingCart, ClipboardList, PackageOpen, IndianRupee, Truck, Users, LayoutDashboard, Settings2,
    ListOrdered, ArrowLeftRight, ClipboardCheck, ShieldAlert, PieChart, FileText
} from 'lucide-react';
import Link from 'next/link';
import { ModuleHubLayout } from '@/app/admin/components/ModuleHubLayout';

interface DashboardData {
    totalItems: number;
    activeStores: number;
    totalStockValue: number;
    expiringIn30Days: number;
    expiringIn90Days: number;
    zeroStockCount: number;
    autoIndentConfigured: number;
}

const TABS = [
    { key: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { key: 'operations', label: 'Operations', icon: ArrowLeftRight },
    { key: 'procurement', label: 'Procurement', icon: ShoppingCart },
    { key: 'reports', label: 'Reports', icon: BarChart3 },
    { key: 'settings', label: 'Master Data', icon: Settings2 },
];

export default function InventoryDashboardPage() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [data, setData] = useState<DashboardData | null>(null);
    const [slowMoving, setSlowMoving] = useState<any[]>([]);
    const [expiry, setExpiry] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [summary, slow, exp] = await Promise.all([
                getInventoryDashboardSummary(),
                getSlowMovingStocks(90),
                getExpiryForecast(30),
            ]);
            if (summary.success) setData(summary.data as any);
            if (slow.success) setSlowMoving((slow.data as any).slow_moving?.slice(0, 5) || []);
            if (exp.success) setExpiry((exp.data as any).near_expiry?.slice(0, 5) || []);
        } catch (err) {
            console.error('Inventory load error:', err);
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const fmt = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
    const fmtCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

    return (
        <ModuleHubLayout
            moduleKey="inventory"
            moduleTitle="Inventory & Materials Module"
            moduleDescription="Hospital-wide inventory, procurement, and supply chain management"
            moduleIcon={<Package className="h-5 w-5" />}
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onRefresh={activeTab === 'dashboard' ? loadData : undefined}
            refreshing={loading}
        >
            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                    {loading && !data ? (
                        <div className="flex items-center justify-center py-20">
                            <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
                        </div>
                    ) : (
                        <>
                            {/* KPI ROW */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 hover:border-amber-300 transition-all">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Active Items</span>
                                        <div className="p-1.5 bg-amber-50 rounded-lg"><Package className="h-3.5 w-3.5 text-amber-500" /></div>
                                    </div>
                                    <p className="text-3xl font-black text-gray-900">{data ? fmt(data.totalItems) : 0}</p>
                                </div>

                                <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 hover:border-violet-300 transition-all">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Active Stores</span>
                                        <div className="p-1.5 bg-violet-50 rounded-lg"><Store className="h-3.5 w-3.5 text-violet-500" /></div>
                                    </div>
                                    <p className="text-3xl font-black text-gray-900">{data ? fmt(data.activeStores) : 0}</p>
                                </div>

                                <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 hover:border-emerald-300 transition-all">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total Stock Value</span>
                                        <div className="p-1.5 bg-emerald-50 rounded-lg"><IndianRupee className="h-3.5 w-3.5 text-emerald-500" /></div>
                                    </div>
                                    <p className="text-3xl font-black text-gray-900">{data ? fmtCurrency(data.totalStockValue) : '₹0'}</p>
                                </div>

                                <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 hover:border-rose-300 transition-all">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Expiring in 30d</span>
                                        <div className="p-1.5 bg-rose-50 rounded-lg"><AlertTriangle className="h-3.5 w-3.5 text-rose-500" /></div>
                                    </div>
                                    <p className="text-3xl font-black text-gray-900">{data ? fmt(data.expiringIn30Days) : 0}</p>
                                </div>
                            </div>

                            {/* SPLIT LAYOUT: ACTIONS & ALERTS */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* PENDING WORKLOAD / QUICK LINKS */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900">Zero Stock Alerts</h3>
                                            <p className="text-3xl font-black text-gray-900 mt-2">{data ? fmt(data.zeroStockCount) : 0}</p>
                                            <p className="text-xs text-gray-400 mt-1">items are currently out of stock</p>
                                        </div>
                                        <Link href="/admin/inventory/reports" className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 transition-colors">
                                            View Report
                                            <ChevronRight className="h-4 w-4" />
                                        </Link>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <button onClick={() => setActiveTab('operations')} className="group bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl p-4 flex items-center justify-between transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-amber-50 rounded-xl">
                                                        <Box className="h-5 w-5 text-amber-500" />
                                                    </div>
                                                    <div className="text-left">
                                                        <h4 className="text-sm font-bold text-gray-900">Issue Stock</h4>
                                                        <p className="text-xs text-gray-400">Process indents & issues</p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-amber-500" />
                                            </button>

                                            <button onClick={() => setActiveTab('procurement')} className="group bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl p-4 flex items-center justify-between transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-50 rounded-xl">
                                                        <ShoppingCart className="h-5 w-5 text-blue-500" />
                                                    </div>
                                                    <div className="text-left">
                                                        <h4 className="text-sm font-bold text-gray-900">Procurement</h4>
                                                        <p className="text-xs text-gray-400">Purchase orders & invoices</p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* ALERTS PANEL */}
                                <div className="lg:col-span-1 space-y-6">
                                    <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5">
                                        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center justify-between">
                                            Near Expiry (30d)
                                            <Clock className="h-4 w-4 text-rose-500" />
                                        </h3>
                                        {expiry.length === 0 ? (
                                            <p className="text-gray-400 text-xs text-center py-4">No items expiring soon</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {expiry.map((e, i) => (
                                                    <div key={i} className="flex items-center justify-between pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-gray-900 text-xs font-bold truncate">{e.item_name}</p>
                                                            <p className="text-gray-500 text-[10px]">Batch: {e.batch_no} · Exp: {new Date(e.expiry_date).toLocaleDateString('en-IN')}</p>
                                                        </div>
                                                        <span className="ml-2 bg-rose-50 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                                                            {e.total_qty}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5">
                                        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center justify-between">
                                            Slow Moving
                                            <TrendingDown className="h-4 w-4 text-amber-500" />
                                        </h3>
                                        {slowMoving.length === 0 ? (
                                            <p className="text-gray-400 text-xs text-center py-4">No slow moving items detected</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {slowMoving.map((s, i) => (
                                                    <div key={i} className="flex items-center justify-between pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-gray-900 text-xs font-bold truncate">{s.item_name}</p>
                                                            <p className="text-gray-500 text-[10px]">{s.store} · {s.abc_class ?? '–'}-class</p>
                                                        </div>
                                                        <div className="ml-2 text-right shrink-0">
                                                            <p className="text-gray-900 text-xs font-bold">{s.quantity_on_hand}</p>
                                                            <p className="text-gray-400 text-[10px]">₹{Math.round(s.stock_value).toLocaleString('en-IN')}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeTab === 'operations' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link href="/admin/inventory/indents" className="group bg-white border border-gray-200 shadow-sm rounded-2xl p-6 flex items-center justify-between hover:border-amber-300 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-50 rounded-xl">
                                <ListOrdered className="h-6 w-6 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Indents & Issues</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Department requests and stock issuance with FEFO</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-amber-500 transition-colors" />
                    </Link>
                    
                    <Link href="/admin/inventory/transfers" className="group bg-white border border-gray-200 shadow-sm rounded-2xl p-6 flex items-center justify-between hover:border-blue-300 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 rounded-xl">
                                <ArrowLeftRight className="h-6 w-6 text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Stock Transfers</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Inter-store and inter-branch movements</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                    </Link>

                    <Link href="/admin/inventory/stock-counts" className="group bg-white border border-gray-200 shadow-sm rounded-2xl p-6 flex items-center justify-between hover:border-emerald-300 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 rounded-xl">
                                <ClipboardCheck className="h-6 w-6 text-emerald-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Physical Counts</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Cycle counting, audits and variance tracking</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
                    </Link>

                    <Link href="/admin/inventory/adjustments" className="group bg-white border border-gray-200 shadow-sm rounded-2xl p-6 flex items-center justify-between hover:border-rose-300 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-rose-50 rounded-xl">
                                <ShieldAlert className="h-6 w-6 text-rose-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Adjustments & Quarantine</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Write-offs, expiries, damage, and stock corrections</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-rose-500 transition-colors" />
                    </Link>
                </div>
            )}

            {activeTab === 'procurement' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link href="/admin/inventory/requisitions" className="group bg-white border border-gray-200 shadow-sm rounded-2xl p-6 flex items-center justify-between hover:border-blue-300 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 rounded-xl">
                                <ListOrdered className="h-6 w-6 text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Purchase Requisitions</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Auto-indents and manual PRs</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                    </Link>
                    
                    <Link href="/admin/inventory/procurement" className="group bg-white border border-gray-200 shadow-sm rounded-2xl p-6 flex items-center justify-between hover:border-indigo-300 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 rounded-xl">
                                <ShoppingCart className="h-6 w-6 text-indigo-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Purchase Orders</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Vendor orders, tracking and approvals</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                    </Link>

                    <Link href="/admin/inventory/procurement/grn" className="group bg-white border border-gray-200 shadow-sm rounded-2xl p-6 flex items-center justify-between hover:border-emerald-300 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 rounded-xl">
                                <Package className="h-6 w-6 text-emerald-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Goods Receipt (GRN)</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Receive goods, batch/expiry capture, QC</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
                    </Link>

                    <Link href="/admin/inventory/procurement/invoices" className="group bg-white border border-gray-200 shadow-sm rounded-2xl p-6 flex items-center justify-between hover:border-violet-300 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-violet-50 rounded-xl">
                                <FileText className="h-6 w-6 text-violet-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Purchase Invoices</h3>
                                <p className="text-xs text-gray-400 mt-0.5">3-way matching and accounts payable handoff</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-violet-500 transition-colors" />
                    </Link>
                </div>
            )}

            {activeTab === 'reports' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link href="/admin/inventory/reports" className="group bg-white border border-gray-200 shadow-sm rounded-2xl p-6 flex items-center justify-between hover:border-emerald-300 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 rounded-xl">
                                <BarChart3 className="h-6 w-6 text-emerald-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Stock & Valuation Reports</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Stock on hand, moving average, expiry registers</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
                    </Link>
                    
                    <Link href="/admin/inventory/reports/abc-ved" className="group bg-white border border-gray-200 shadow-sm rounded-2xl p-6 flex items-center justify-between hover:border-blue-300 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 rounded-xl">
                                <PieChart className="h-6 w-6 text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">ABC/VED Analytics</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Classification matrix and turnover performance</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                    </Link>
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link href="/admin/inventory/items" className="group bg-white border border-gray-200 shadow-sm rounded-2xl p-6 flex items-center justify-between hover:border-violet-300 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-violet-50 rounded-xl">
                                <ClipboardList className="h-6 w-6 text-violet-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Item Catalog</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Master items, categories, pricing & ABC/VED config</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-violet-500 transition-colors" />
                    </Link>
                    
                    <Link href="/admin/inventory/stores" className="group bg-white border border-gray-200 shadow-sm rounded-2xl p-6 flex items-center justify-between hover:border-amber-300 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-50 rounded-xl">
                                <Store className="h-6 w-6 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Stores & Locations</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Manage store hierarchy, departments, and sub-stores</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-amber-500 transition-colors" />
                    </Link>
                </div>
            )}
        </ModuleHubLayout>
    );
}
