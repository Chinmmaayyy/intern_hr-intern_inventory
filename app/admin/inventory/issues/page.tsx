'use client';
import { useEffect, useState } from 'react';
import { listStockIssues } from '@/app/actions/indent-actions';
import { AdminPage } from '@/app/admin/components/AdminPage';
import { Package, RefreshCw } from 'lucide-react';

export default function StockIssuesPage() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await listStockIssues({ limit: 50 });
    if (res.success) setIssues(res.data?.issues || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <AdminPage pageTitle="Stock Issues" pageIcon={<Package className="h-5 w-5" />} onRefresh={load} refreshing={loading}>
      <p className="text-sm text-gray-500 mb-4">All material issues dispatched against indents or emergency requests.</p>
      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="animate-spin text-indigo-500" /></div>
      ) : issues.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 border rounded-xl text-gray-500">No stock issues recorded yet.</div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-[11px] font-bold text-gray-500 uppercase">
                <th className="py-3 px-4 text-left">Issue No</th>
                <th className="py-3 px-4 text-left">From → To</th>
                <th className="py-3 px-4 text-left">Indent</th>
                <th className="py-3 px-4 text-left">Lines</th>
                <th className="py-3 px-4 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {issues.map(iss => (
                <tr key={iss.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono font-bold text-indigo-600">{iss.issue_number}</td>
                  <td className="py-3 px-4">{iss.from_store?.name} → {iss.to_store?.name || '—'}</td>
                  <td className="py-3 px-4">{iss.indent?.indent_number || 'Direct'}</td>
                  <td className="py-3 px-4">{iss.items?.length ?? 0} item(s)</td>
                  <td className="py-3 px-4 text-gray-500">{new Date(iss.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPage>
  );
}
