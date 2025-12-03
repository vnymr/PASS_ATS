/**
 * Test Smart Aggregator
 * Tests the new self-learning job aggregation system
 */

import smartAggregator from '../lib/job-sources/smart-aggregator.js';
import logger from '../lib/logger.js';

async function testSmartAggregator() {
  console.log('🧪 Testing Smart Job Aggregator\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Discovery via Remotive (no API key needed)
    console.log('\n📋 Test 1: Fetch from Remotive (free, no auth)');
    console.log('-'.repeat(60));

    const remotiveJobs = await smartAggregator.fetchFromRemotive();
    console.log(`✅ Fetched ${remotiveJobs.length} remote jobs`);

    if (remotiveJobs.length > 0) {
      const sample = remotiveJobs[0];
      console.log('\nSample job:');
      console.log(`  Title: ${sample.title}`);
      console.log(`  Company: ${sample.company}`);
      console.log(`  ATS Type: ${sample.atsType}`);
      console.log(`  ATS Company: ${sample.atsCompany || 'N/A'}`);
      console.log(`  AI Applyable: ${sample.aiApplyable}`);
      console.log(`  Apply URL: ${sample.applyUrl}`);
    }

    // Test 2: Check discovered companies
    console.log('\n📋 Test 2: Check discovered companies');
    console.log('-'.repeat(60));

    const greenhouse = Array.from(smartAggregator.discoveredCompanies.greenhouse);
    const lever = Array.from(smartAggregator.discoveredCompanies.lever);
    const ashby = Array.from(smartAggregator.discoveredCompanies.ashby);

    console.log(`Greenhouse companies discovered: ${greenhouse.length}`);
    if (greenhouse.length > 0) {
      console.log(`  Examples: ${greenhouse.slice(0, 5).join(', ')}`);
    }

    console.log(`Lever companies discovered: ${lever.length}`);
    if (lever.length > 0) {
      console.log(`  Examples: ${lever.slice(0, 5).join(', ')}`);
    }

    console.log(`Ashby companies discovered: ${ashby.length}`);
    if (ashby.length > 0) {
      console.log(`  Examples: ${ashby.slice(0, 5).join(', ')}`);
    }

    // Test 3: Fetch from Greenhouse (if we discovered any companies)
    if (greenhouse.length > 0) {
      console.log('\n📋 Test 3: Fetch from Greenhouse companies');
      console.log('-'.repeat(60));

      const testCompanies = greenhouse.slice(0, 5); // Test first 5
      console.log(`Testing ${testCompanies.length} companies: ${testCompanies.join(', ')}`);

      const greenhouseJobs = await smartAggregator.fetchFromGreenhouse(testCompanies);
      console.log(`✅ Fetched ${greenhouseJobs.length} jobs from Greenhouse`);

      if (greenhouseJobs.length > 0) {
        const sample = greenhouseJobs[0];
        console.log('\nSample Greenhouse job:');
        console.log(`  Title: ${sample.title}`);
        console.log(`  Company: ${sample.company}`);
        console.log(`  Apply URL: ${sample.applyUrl}`);
        console.log(`  ATS Confidence: ${sample.atsConfidence}`);
      }
    } else {
      console.log('\n⚠️  Test 3: Skipped (no Greenhouse companies discovered)');
    }

    // Test 4: Fetch from Lever (if we discovered any companies)
    if (lever.length > 0) {
      console.log('\n📋 Test 4: Fetch from Lever companies');
      console.log('-'.repeat(60));

      const testCompanies = lever.slice(0, 5); // Test first 5
      console.log(`Testing ${testCompanies.length} companies: ${testCompanies.join(', ')}`);

      const leverJobs = await smartAggregator.fetchFromLever(testCompanies);
      console.log(`✅ Fetched ${leverJobs.length} jobs from Lever`);

      if (leverJobs.length > 0) {
        const sample = leverJobs[0];
        console.log('\nSample Lever job:');
        console.log(`  Title: ${sample.title}`);
        console.log(`  Company: ${sample.company}`);
        console.log(`  Apply URL: ${sample.applyUrl}`);
        console.log(`  ATS Confidence: ${sample.atsConfidence}`);
      }
    } else {
      console.log('\n⚠️  Test 4: Skipped (no Lever companies discovered)');
    }

    // Test 5: Full aggregation (if JSearch API key is available)
    if (process.env.RAPIDAPI_KEY) {
      console.log('\n📋 Test 5: Full aggregation with JSearch discovery');
      console.log('-'.repeat(60));

      const result = await smartAggregator.aggregateAll({
        forceDiscovery: true,
        jsearch: {
          keywords: 'software engineer',
          pages: 2 // Just 2 pages for testing
        }
      });

      console.log('\nAggregation Results:');
      console.log(`  Total jobs: ${result.jobs.length}`);
      console.log(`  AI-applyable: ${result.stats.aiApplyable} (${result.stats.aiApplyablePercent}%)`);
      console.log(`  Greenhouse companies: ${result.companies.greenhouse.length}`);
      console.log(`  Lever companies: ${result.companies.lever.length}`);

      // Show breakdown by ATS
      console.log('\nJobs by ATS type:');
      Object.entries(result.stats.byATS).forEach(([ats, count]) => {
        console.log(`  ${ats}: ${count}`);
      });

    } else {
      console.log('\n⚠️  Test 5: Skipped (no RAPIDAPI_KEY - set to test JSearch)');
      console.log('     Get free key at: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(60));

    console.log('\nNext steps:');
    console.log('1. Set RAPIDAPI_KEY to enable JSearch discovery (optional)');
    console.log('2. Run job sync service to build company list over time');
    console.log('3. Watch as system discovers 100+ companies automatically');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testSmartAggregator()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
