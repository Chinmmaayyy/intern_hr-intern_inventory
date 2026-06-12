/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import Link from 'next/link';
import { listCatalogue } from '@/app/actions/mis-report-actions';
import { BarChart3 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MISLayout({ children }: { children: React.ReactNode }) {
  const catalogue = await listCatalogue();
  
  return (
    <div className="flex bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden h-[calc(100vh-8rem)]">
      {/* Sub-Sidebar for MIS Reports */}
      <aside className="w-72 bg-gray-50/50 border-r border-gray-100 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-100 bg-white">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            Report Catalogue
          </h2>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-8 mt-2">
          {Object.entries(catalogue).map(([category, reports]) => (
            <div key={category}>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-3">
                {category}
              </h3>
              <ul className="space-y-1">
                {reports.map((report: any) => (
                  <li key={report.id}>
                    <Link
                      href={`/admin/mis/${report.id}`}
                      className="block px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                    >
                      {report.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto p-8 bg-white">
        {children}
      </main>
    </div>
  );
}
