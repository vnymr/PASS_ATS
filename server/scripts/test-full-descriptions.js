/**
 * Test script to verify full job descriptions are being fetched
 */

import smartAggregator from '../lib/job-sources/smart-aggregator.js';
import logger from '../lib/logger.js';

async function testFullDescriptions() {
  console.log('\n=======================================================================');
  console.log('🧪 TESTING FULL JOB DESCRIPTION FETCHING');
  console.log('=======================================================================\n');

  console.log('Testing with a few known companies...\n');

  // Test Greenhouse (should have full descriptions)
  console.log('📥 Testing Greenhouse API (stripe)...');
  const greenhouseJobs = await smartAggregator.fetchFromGreenhouse(['stripe']);

  if (greenhouseJobs.length > 0) {
    const job = greenhouseJobs[0];
    console.log('\n✅ Sample Greenhouse Job:');
    console.log(`   Title: ${job.title}`);
    console.log(`   Company: ${job.company}`);
    console.log(`   Apply URL: ${job.applyUrl}`);
    console.log(`   Description length: ${job.description.length} characters`);
    console.log(`   Requirements length: ${job.requirements ? job.requirements.length : 0} characters`);

    if (job.description.length > 500) {
      console.log('\n   ✅ Full description fetched successfully!');
      console.log(`   Description preview: ${job.description.substring(0, 200)}...`);
    } else {
      console.log('\n   ⚠️  Description seems short, may not be complete');
    }

    if (job.requirements) {
      console.log(`\n   ✅ Requirements extracted!`);
      console.log(`   Requirements preview: ${job.requirements.substring(0, 200)}...`);
    } else {
      console.log(`\n   ⚠️  No requirements extracted`);
    }
  } else {
    console.log('❌ No jobs found from Stripe');
  }

  // Test Lever (should have full descriptions)
  console.log('\n\n📥 Testing Lever API (netflix)...');
  const leverJobs = await smartAggregator.fetchFromLever(['netflix']);

  if (leverJobs.length > 0) {
    const job = leverJobs[0];
    console.log('\n✅ Sample Lever Job:');
    console.log(`   Title: ${job.title}`);
    console.log(`   Company: ${job.company}`);
    console.log(`   Apply URL: ${job.applyUrl}`);
    console.log(`   Description length: ${job.description.length} characters`);
    console.log(`   Requirements length: ${job.requirements ? job.requirements.length : 0} characters`);

    if (job.description.length > 500) {
      console.log('\n   ✅ Full description fetched successfully!');
      console.log(`   Description preview: ${job.description.substring(0, 200)}...`);
    } else {
      console.log('\n   ⚠️  Description seems short, may not be complete');
    }

    if (job.requirements) {
      console.log(`\n   ✅ Requirements extracted!`);
      console.log(`   Requirements preview: ${job.requirements.substring(0, 200)}...`);
    } else {
      console.log(`\n   ⚠️  No requirements extracted`);
    }
  } else {
    console.log('❌ No jobs found from Netflix (may not be hiring currently)');
  }

  console.log('\n\n=======================================================================');
  console.log('✅ TEST COMPLETE!');
  console.log('=======================================================================\n');

  process.exit(0);
}

testFullDescriptions().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
