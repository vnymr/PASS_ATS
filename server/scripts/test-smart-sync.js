/**
 * Test script for Smart Job Sync
 * Tests the tiered sync strategy
 */

import smartJobSync from '../lib/smart-job-sync.js';

async function testSmartSync() {
  console.log('='.repeat(60));
  console.log('SMART JOB SYNC TEST');
  console.log('='.repeat(60));
  console.log('');

  // Test 1: High-priority sync
  console.log('⚡ TEST 1: High-Priority Sync');
  console.log('-'.repeat(40));
  try {
    const result = await smartJobSync.syncHighPriority();
    console.log(`   Result: ${JSON.stringify(result, null, 2)}`);
  } catch (error) {
    console.log(`   ERROR: ${error.message}`);
  }
  console.log('');

  // Test 2: Get stats
  console.log('📊 TEST 2: Get Stats');
  console.log('-'.repeat(40));
  const stats = smartJobSync.getStats();
  console.log(`   Stats: ${JSON.stringify(stats, null, 2)}`);
  console.log('');

  console.log('='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));

  // Exit
  process.exit(0);
}

testSmartSync().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
