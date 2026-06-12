/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import { listCatalogue } from '@/app/actions/mis-report-actions';
import { DynamicReportViewer } from '@/components/mis/DynamicReportViewer';
import { AdminPage } from '@/app/admin/components/AdminPage';
import { notFound } from 'next/navigation';
import { BarChart3 } from 'lucide-react';

interface DynamicPageProps {
  params: Promise<{ reportId: string }>;
}

export default async function DynamicReportPage({ params }: DynamicPageProps) {
  const catalogue = await listCatalogue();
  const { reportId } = await params;
  
  let reportMetadata = null;
  for (const category in catalogue) {
    const found = catalogue[category].find((r: any) => r.id === reportId);
    if (found) {
      reportMetadata = found;
      break;
    }
  }
  
  if (!reportMetadata) {
    notFound();
  }
  
  return (
    <AdminPage 
        pageTitle={`MIS — ${reportMetadata.name}`}
        pageIcon={<BarChart3 className="h-5 w-5" />}
    >
      <DynamicReportViewer 
        reportId={reportId} 
        reportDescription={reportMetadata.description} 
        columns={reportMetadata.columns}
      />
    </AdminPage>
  );
}
