import { generateReport } from './app/actions/mis-report-actions';
import { GET } from './app/api/cron/mis-jobs/route';
import { prisma } from './backend/db';

async function main() {
  try {
    console.log('0. Clearing existing ReportJob queue to ensure a clean test...');
    await prisma.reportJob.deleteMany({});

    console.log('1. Calling generateReport for billing-revenue-daily');
    const result = await generateReport('billing-revenue-daily', {
      date_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      date_end: new Date().toISOString(),
    });
    
    console.log('generateReport result:', result);
    
    if (!result.async) {
      console.log('Expected async result but got sync. Exiting.');
      return;
    }
    
    const jobId = result.jobId as string;
    console.log('Job inserted with ID:', jobId);

    console.log('\n2. Invoking CRON handler to process queue...');
    // Create a mock request object if GET accepts it, but our GET takes 0 args
    const req = new Request('http://localhost/api/cron/mis-jobs');
    // We pass req just in case, but TS might complain if GET() is strictly 0 args.
    // Let's type-cast GET to any to allow passing req if we want, or just call GET().
    const response = await (GET as any)(req);
    
    const data = await response.json();
    console.log('Cron Response:', response.status, data);

    console.log('\n3. Querying Prisma for final job state...');
    const finalJob = await prisma.reportJob.findUnique({
      where: { id: jobId }
    });
    
    console.log('Final Job Record:', finalJob);
  } catch (error) {
    console.error('Error in test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
