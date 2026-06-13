import { NextResponse } from 'next/server';
import { prisma } from '@/backend/db';
import { REGISTRY } from '@/lib/mis/runner';
import { generateExcelBuffer } from '@/lib/mis/exporter';
import { uploadToS3 } from '@/lib/mis/s3-uploader';

export const dynamic = 'force-dynamic';

export async function GET() {
  // 1. Fetch the oldest ReportJob where status === 'Queued'
  const job = await prisma.reportJob.findFirst({
    where: { status: 'Queued' },
    orderBy: { createdAt: 'asc' },
  });

  // 2. If no jobs are found, return a 200 JSON response
  if (!job) {
    return NextResponse.json({ message: 'Queue is empty' }, { status: 200 });
  }

  // 3. Immediately update the job's status to 'Running' and set started_at
  await prisma.reportJob.update({
    where: { id: job.id },
    data: {
      status: 'Running',
      started_at: new Date(),
    },
  });

  // 4. Wrap the next steps in a try/catch block
  try {
    // 5. Retrieve the actual report definition from our registry
    const reportDef = REGISTRY[job.report_id];
    if (!reportDef) {
      throw new Error(`Report definition not found for ID: ${job.report_id}`);
    }

    // 6. Execute the report's queryFn
    // Note: Prisma Json type is passed as unknown or specific type in the queryFn
    const { rows, totals } = await reportDef.queryFn(job.filters_json as any, job.organizationId);

    // 7. Pass the resulting rows, totals, and columns into generateExcelBuffer
    const buffer = await generateExcelBuffer(
      reportDef.columns,
      rows ?? [],
      totals ?? {}
    );

    // Generate a unique filename
    const dateSuffix = new Date().toISOString().split('T')[0];
    const safeName = reportDef.name.replace(/[^a-zA-Z0-9]+/g, '_');
    const filename = `${safeName}_${job.id}_${dateSuffix}.xlsx`;

    // 8. Call our mock uploadToS3 with the buffer
    const fileKey = await uploadToS3(buffer, filename);

    // 9. Update the ReportJob status to 'Completed', setting finished_at, row_count, and file_key
    await prisma.reportJob.update({
      where: { id: job.id },
      data: {
        status: 'Completed',
        finished_at: new Date(),
        row_count: rows.length,
        file_key: fileKey,
      },
    });

    // 11. Return a JSON success response
    return NextResponse.json({
      message: 'Job processed successfully',
      jobId: job.id,
      status: 'Completed',
    });
  } catch (error: any) {
    // 10. If an error is caught, update the ReportJob status to 'Failed' and save the error.message
    await prisma.reportJob.update({
      where: { id: job.id },
      data: {
        status: 'Failed',
        finished_at: new Date(),
        error: error.message || 'An unknown error occurred during report generation',
      },
    });

    return NextResponse.json(
      { message: 'Job failed', jobId: job.id, error: error.message },
      { status: 500 }
    );
  }
}
