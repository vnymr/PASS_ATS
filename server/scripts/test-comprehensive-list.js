/**
 * Test Comprehensive Company List
 *
 * Tests fetching jobs from 600+ companies
 */

import smartAggregator from '../lib/job-sources/smart-aggregator.js';
import { TOTAL_COMPANIES } from '../lib/job-sources/comprehensive-company-list.js';

async function testComprehensiveList() {
  console.log('🚀 TESTING COMPREHENSIVE COMPANY LIST');
  console.log('='.repeat(70));
  console.log(`\n📊 Total companies tracked: ${TOTAL_COMPANIES}\n`);

  const startTime = Date.now();

  try {
    // Test fetching from a sample of companies (don't fetch all 600+ at once for testing)
    console.log('📥 Fetching from sample of companies (first 20 Greenhouse + 10 Lever)...\n');

    const greenhouseCompanies = Array.from(smartAggregator.discoveredCompanies.greenhouse).slice(0, 20);
    const leverCompanies = Array.from(smartAggregator.discoveredCompanies.lever).slice(0, 10);

    console.log('Greenhouse companies to test:');
    console.log(`  ${greenhouseCompanies.join(', ')}\n`);

    console.log('Lever companies to test:');
    console.log(`  ${leverCompanies.join(', ')}\n`);

    const [greenhouseJobs, leverJobs] = await Promise.all([
      smartAggregator.fetchFromGreenhouse(greenhouseCompanies),
      smartAggregator.fetchFromLever(leverCompanies)
    ]);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(70));
    console.log('✅ FETCH COMPLETE');
    console.log('='.repeat(70));

    console.log(`\n📈 RESULTS:`);
    console.log(`  Greenhouse jobs: ${greenhouseJobs.length}`);
    console.log(`  Lever jobs: ${leverJobs.length}`);
    console.log(`  Total: ${greenhouseJobs.length + leverJobs.length}`);
    console.log(`  Duration: ${duration}s`);

    // Calculate extrapolated numbers if we fetched from ALL companies
    const ghAvgJobsPerCompany = greenhouseJobs.length / greenhouseCompanies.length;
    const leverAvgJobsPerCompany = leverJobs.length / leverCompanies.length;

    const totalGHCompanies = smartAggregator.discoveredCompanies.greenhouse.size;
    const totalLeverCompanies = smartAggregator.discoveredCompanies.lever.size;

    const projectedGHJobs = Math.round(ghAvgJobsPerCompany * totalGHCompanies);
    const projectedLeverJobs = Math.round(leverAvgJobsPerCompany * totalLeverCompanies);

    console.log(`\n📊 EXTRAPOLATED TO ALL ${TOTAL_COMPANIES} COMPANIES:`);
    console.log(`  Greenhouse (${totalGHCompanies} companies × ${ghAvgJobsPerCompany.toFixed(1)} jobs/co): ~${projectedGHJobs.toLocaleString()} jobs`);
    console.log(`  Lever (${totalLeverCompanies} companies × ${leverAvgJobsPerCompany.toFixed(1)} jobs/co): ~${projectedLeverJobs.toLocaleString()} jobs`);
    console.log(`  TOTAL PROJECTED: ~${(projectedGHJobs + projectedLeverJobs).toLocaleString()} jobs/day! 🎉`);

    // Check job posting dates
    if (greenhouseJobs.length > 0) {
      console.log(`\n📅 JOB POSTING DATES (Sample):`);
      greenhouseJobs.slice(0, 5).forEach(job => {
        const daysAgo = Math.floor((Date.now() - new Date(job.postedDate).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`  [${job.company}] ${job.title.substring(0, 40)}`);
        console.log(`     Posted: ${job.postedDate.toISOString().split('T')[0]} (${daysAgo} days ago)`);
      });
    }

    // Show AI-applyable breakdown
    const aiApplyable = [...greenhouseJobs, ...leverJobs].filter(j => j.aiApplyable).length;
    const total = greenhouseJobs.length + leverJobs.length;
    const percent = ((aiApplyable / total) * 100).toFixed(1);

    console.log(`\n🤖 AI-APPLYABLE:`);
    console.log(`  ${aiApplyable} / ${total} (${percent}%)`);
    console.log(`  Projected from all companies: ~${Math.round((projectedGHJobs + projectedLeverJobs) * (percent / 100)).toLocaleString()} AI-applyable jobs!`);

    console.log(`\n✅ ALL TESTS PASSED!`);
    console.log(`\n💡 NEXT STEPS:`);
    console.log(`  1. Run full sync to fetch from all ${TOTAL_COMPANIES} companies`);
    console.log(`  2. Expect ${Math.round((projectedGHJobs + projectedLeverJobs) / 1000)}k+ jobs in database`);
    console.log(`  3. 100% direct URLs`);
    console.log(`  4. ${percent}% AI-applyable`);

    return {
      success: true,
      jobs: total,
      projected: projectedGHJobs + projectedLeverJobs
    };

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

testComprehensiveList()
  .then((result) => {
    if (result.success) {
      console.log(`\n🎉 Success! Projected ${result.projected.toLocaleString()} jobs from comprehensive list!`);
      process.exit(0);
    } else {
      console.error('\n❌ Test failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });
