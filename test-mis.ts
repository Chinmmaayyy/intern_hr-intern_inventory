import { listCatalogue, generateReport } from './app/actions/mis-report-actions';

async function runTest() {
  console.log("1. Fetching Report Catalogue...");
  const catalogue = await listCatalogue();
  console.log(JSON.stringify(catalogue, null, 2));

  console.log("\n2. Testing Daily Revenue Report Generation...");
  // We pass dates that will definitely catch some data (adjust these if needed)
  const filters = {
    date_start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString(), // 30 days ago
    date_end: new Date().toISOString(), // today
  };

  try {
    const result = await generateReport('billing-revenue-daily', filters);
    console.log("Report Result:");
    console.log(JSON.stringify(result, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value, 2));
  } catch (error) {
    console.error("Error generating report:", error);
  }
}

runTest();
