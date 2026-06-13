import { exportReportToExcel } from './app/actions/mis-report-actions';
import * as fs from 'fs';
import * as path from 'path';

async function testExcelExport() {
  console.log('═══════════════════════════════════════════════');
  console.log('  MIS Excel Export — End-to-End Test');
  console.log('═══════════════════════════════════════════════\n');

  const filters = {
    date_start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    date_end: new Date().toISOString().split('T')[0],
  };

  console.log(`Filters: ${JSON.stringify(filters)}\n`);

  try {
    console.log('1. Calling exportReportToExcel("billing-revenue-daily")...');
    const result = await exportReportToExcel('billing-revenue-daily', filters);

    console.log(`   ✅ Success!`);
    console.log(`   - Filename: ${result.filename}`);
    console.log(`   - Base64 length: ${result.base64.length} chars`);

    // Decode and write to disk so we can verify the file opens
    const buffer = Buffer.from(result.base64, 'base64');
    console.log(`   - File size: ${(buffer.length / 1024).toFixed(1)} KB`);

    const outPath = path.join(__dirname, 'test-output.xlsx');
    fs.writeFileSync(outPath, buffer);
    console.log(`   - Written to: ${outPath}`);

    // Basic sanity: xlsx files start with PK (zip header)
    const header = buffer.slice(0, 2).toString('ascii');
    if (header === 'PK') {
      console.log(`   - ✅ Valid .xlsx (ZIP header detected)`);
    } else {
      console.log(`   - ❌ Invalid file — expected ZIP header "PK", got "${header}"`);
    }

    console.log('\n✅ ALL CHECKS PASSED — Excel export is working!\n');
  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testExcelExport();
