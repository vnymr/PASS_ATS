/**
 * Test script for fresh job fetching (72-hour filter)
 * Tests: Greenhouse, Lever, Ashby, Workable with freshness filter
 */

import smartAggregator from '../lib/job-sources/smart-aggregator.js';

const testCompanies = {
  greenhouse: ['stripe', 'anthropic', 'figma', 'datadog', 'mongodb'],
  ashby: ['linear', 'ramp', 'vanta'],
  lever: ['spotify'],
  workable: ['zapier']
};

async function testFreshJobFetching() {
  console.log('='.repeat(60));
  console.log('FRESH JOB FETCHING TEST (72-hour filter)');
  console.log('='.repeat(60));
  console.log('');

  // Test 1: Greenhouse with freshness filter
  console.log('📗 TEST 1: Greenhouse API (fresh only)');
  console.log('-'.repeat(40));
  try {
    const greenhouseJobs = await smartAggregator.fetchFromGreenhouse(
      testCompanies.greenhouse,
      { freshOnly: true }
    );
    console.log(`   Total fresh jobs: ${greenhouseJobs.length}`);
    if (greenhouseJobs.length > 0) {
      console.log(`   Sample: ${greenhouseJobs[0].title} @ ${greenhouseJobs[0].company}`);
      console.log(`   Posted: ${greenhouseJobs[0].postedDate}`);
    }
  } catch (error) {
    console.log(`   ERROR: ${error.message}`);
  }
  console.log('');

  // Test 2: Ashby with freshness filter
  console.log('📘 TEST 2: Ashby API (fresh only)');
  console.log('-'.repeat(40));
  try {
    const ashbyJobs = await smartAggregator.fetchFromAshby(
      testCompanies.ashby,
      { freshOnly: true }
    );
    console.log(`   Total fresh jobs: ${ashbyJobs.length}`);
    if (ashbyJobs.length > 0) {
      console.log(`   Sample: ${ashbyJobs[0].title} @ ${ashbyJobs[0].company}`);
      console.log(`   Posted: ${ashbyJobs[0].postedDate}`);
    }
  } catch (error) {
    console.log(`   ERROR: ${error.message}`);
  }
  console.log('');

  // Test 3: Lever with freshness filter
  console.log('📙 TEST 3: Lever API (fresh only)');
  console.log('-'.repeat(40));
  try {
    const leverJobs = await smartAggregator.fetchFromLever(
      testCompanies.lever,
      { freshOnly: true }
    );
    console.log(`   Total fresh jobs: ${leverJobs.length}`);
    if (leverJobs.length > 0) {
      console.log(`   Sample: ${leverJobs[0].title} @ ${leverJobs[0].company}`);
    }
  } catch (error) {
    console.log(`   ERROR: ${error.message}`);
  }
  console.log('');

  // Test 4: Workable with freshness filter
  console.log('📕 TEST 4: Workable API (fresh only)');
  console.log('-'.repeat(40));
  try {
    const workableJobs = await smartAggregator.fetchFromWorkable(
      testCompanies.workable,
      { freshOnly: true }
    );
    console.log(`   Total fresh jobs: ${workableJobs.length}`);
    if (workableJobs.length > 0) {
      console.log(`   Sample: ${workableJobs[0].title} @ ${workableJobs[0].company}`);
    }
  } catch (error) {
    console.log(`   ERROR: ${error.message}`);
  }
  console.log('');

  // Test 5: Compare fresh vs all jobs
  console.log('📊 TEST 5: Fresh vs All Jobs Comparison');
  console.log('-'.repeat(40));
  try {
    const freshJobs = await smartAggregator.fetchFromGreenhouse(
      ['stripe'],
      { freshOnly: true }
    );
    const allJobs = await smartAggregator.fetchFromGreenhouse(
      ['stripe'],
      { freshOnly: false }
    );
    console.log(`   Stripe - All jobs: ${allJobs.length}`);
    console.log(`   Stripe - Fresh jobs (72h): ${freshJobs.length}`);
    console.log(`   Freshness ratio: ${((freshJobs.length / allJobs.length) * 100).toFixed(1)}%`);
  } catch (error) {
    console.log(`   ERROR: ${error.message}`);
  }
  console.log('');

  console.log('='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

testFreshJobFetching().catch(console.error);
