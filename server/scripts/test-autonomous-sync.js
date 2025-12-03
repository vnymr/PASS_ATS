/**
 * Test Autonomous Job Sync System
 *
 * This script tests that the job sync system:
 * 1. Starts the cron jobs correctly
 * 2. Runs the sync on schedule (or immediately for testing)
 * 3. Saves jobs to the database
 * 4. Reports stats correctly
 */

import smartJobSync from '../lib/smart-job-sync.js';
import jobSyncService from '../lib/job-sync-service.js';
import { prisma } from '../lib/prisma-client.js';

async function testAutonomousSync() {
  console.log('='.repeat(70));
  console.log('AUTONOMOUS JOB SYNC SYSTEM TEST');
  console.log('='.repeat(70));
  console.log('');

  // Test 1: Check database connection
  console.log('1️⃣  Testing Database Connection');
  console.log('-'.repeat(50));
  try {
    const jobCount = await prisma.aggregatedJob.count();
    const activeJobs = await prisma.aggregatedJob.count({ where: { isActive: true } });
    const freshJobs = await prisma.aggregatedJob.count({
      where: {
        isActive: true,
        postedDate: { gte: new Date(Date.now() - 72 * 60 * 60 * 1000) }
      }
    });
    console.log(`   ✅ Database connected`);
    console.log(`   📊 Total jobs in DB: ${jobCount}`);
    console.log(`   📊 Active jobs: ${activeJobs}`);
    console.log(`   📊 Fresh jobs (72h): ${freshJobs}`);
  } catch (error) {
    console.log(`   ❌ Database error: ${error.message}`);
    process.exit(1);
  }
  console.log('');

  // Test 2: Verify smart sync stats
  console.log('2️⃣  Smart Job Sync Status');
  console.log('-'.repeat(50));
  const stats = smartJobSync.getStats();
  console.log(`   📊 Stats: ${JSON.stringify(stats, null, 2)}`);
  console.log('');

  // Test 3: Run a quick high-priority sync
  console.log('3️⃣  Running High-Priority Sync (limited companies)');
  console.log('-'.repeat(50));
  console.log('   ⏳ This will fetch fresh jobs from top companies...');
  const startTime = Date.now();

  try {
    const result = await smartJobSync.syncHighPriority();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`   ✅ Sync completed in ${duration}s`);
    console.log(`   📥 Jobs fetched:`);
    console.log(`      - Greenhouse: ${result.stats?.greenhouse || 0}`);
    console.log(`      - Ashby: ${result.stats?.ashby || 0}`);
    console.log(`      - Lever: ${result.stats?.lever || 0}`);
    console.log(`      - Workable: ${result.stats?.workable || 0}`);
    console.log(`   💾 Database operations:`);
    console.log(`      - New jobs saved: ${result.saved || 0}`);
    console.log(`      - Existing updated: ${result.updated || 0}`);
    console.log(`      - Errors/skipped: ${result.errors || 0}`);
  } catch (error) {
    console.log(`   ❌ Sync failed: ${error.message}`);
  }
  console.log('');

  // Test 4: Verify jobs were saved
  console.log('4️⃣  Verifying Database After Sync');
  console.log('-'.repeat(50));
  try {
    const newJobCount = await prisma.aggregatedJob.count();
    const newActiveJobs = await prisma.aggregatedJob.count({ where: { isActive: true } });
    const newFreshJobs = await prisma.aggregatedJob.count({
      where: {
        isActive: true,
        postedDate: { gte: new Date(Date.now() - 72 * 60 * 60 * 1000) }
      }
    });

    // Get recent jobs
    const recentJobs = await prisma.aggregatedJob.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { title: true, company: true, atsType: true, postedDate: true }
    });

    console.log(`   📊 Total jobs: ${newJobCount}`);
    console.log(`   📊 Active jobs: ${newActiveJobs}`);
    console.log(`   📊 Fresh jobs (72h): ${newFreshJobs}`);
    console.log('');
    console.log('   📋 Most Recent Jobs:');
    recentJobs.forEach((job, i) => {
      const posted = new Date(job.postedDate).toLocaleDateString();
      console.log(`      ${i + 1}. ${job.title} @ ${job.company} (${job.atsType}) - ${posted}`);
    });
  } catch (error) {
    console.log(`   ❌ Database error: ${error.message}`);
  }
  console.log('');

  // Test 5: Show cron schedules
  console.log('5️⃣  Cron Schedule Configuration');
  console.log('-'.repeat(50));
  console.log('   📅 Smart Job Sync Schedules:');
  console.log('      - High Priority:  Every hour (0 * * * *)');
  console.log('      - Medium Priority: Every 3 hours (0 */3 * * *)');
  console.log('      - Low Priority:   Every 6 hours (0 */6 * * *)');
  console.log('      - Job Closures:   Every 12 hours (0 */12 * * *)');
  console.log('');
  console.log('   📅 Job Sync Service Schedules:');
  console.log('      - Full Sync:      Every 6 hours (0 */6 * * *)');
  console.log('      - Discovery:      Every 6 hours (30 */6 * * *)');
  console.log('');

  // Test 6: Start the autonomous system (short demo)
  console.log('6️⃣  Starting Autonomous System (10-second demo)');
  console.log('-'.repeat(50));
  console.log('   ⏳ Starting cron jobs for demonstration...');

  // Start the smart sync service
  smartJobSync.start();
  console.log('   ✅ Smart Job Sync cron jobs started');

  // Wait 10 seconds to show it's running
  await new Promise(resolve => setTimeout(resolve, 10000));

  const finalStats = smartJobSync.getStats();
  console.log(`   📊 System Status: ${JSON.stringify(finalStats, null, 2)}`);

  // Stop for test cleanup
  smartJobSync.stop();
  console.log('   🛑 Stopped cron jobs (test complete)');
  console.log('');

  console.log('='.repeat(70));
  console.log('TEST COMPLETE');
  console.log('='.repeat(70));
  console.log('');
  console.log('To run the system in production:');
  console.log('  1. Import smartJobSync in your server startup');
  console.log('  2. Call smartJobSync.start() to begin autonomous syncing');
  console.log('  3. Jobs will be fetched automatically on schedule');
  console.log('');
  console.log('Example:');
  console.log('  import smartJobSync from "./lib/smart-job-sync.js";');
  console.log('  smartJobSync.start(); // Start autonomous job syncing');
  console.log('');

  // Cleanup
  await prisma.$disconnect();
  process.exit(0);
}

testAutonomousSync().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
