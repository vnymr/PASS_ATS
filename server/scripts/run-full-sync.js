/**
 * Run Full Job Sync
 *
 * Fetches jobs from all 550 companies and saves to database
 */

import jobSyncService from '../lib/job-sync-service.js';
import { prisma } from '../lib/prisma-client.js';
import logger from '../lib/logger.js';

async function runFullSync() {
  console.log('🚀 RUNNING FULL JOB SYNC FROM 550 COMPANIES');
  console.log('='.repeat(70));
  console.log('\nThis will:');
  console.log('  1. Fetch jobs from all 550 companies');
  console.log('  2. Save them to the database');
  console.log('  3. Mark old jobs as inactive');
  console.log('  4. Expected: 20,000-25,000 NEW jobs\n');

  // Show current database stats
  console.log('📊 Current database stats:');
  try {
    const current = await prisma.aggregatedJob.count({ where: { isActive: true } });
    const bySource = await prisma.aggregatedJob.groupBy({
      by: ['source'],
      where: { isActive: true },
      _count: true
    });

    console.log(`  Total active jobs: ${current}`);
    bySource.forEach(s => {
      console.log(`    ${s.source}: ${s._count}`);
    });
  } catch (error) {
    console.log('  (Database not accessible for pre-check)');
  }

  console.log('\n⏳ Starting sync... (this may take 2-5 minutes)\n');

  const startTime = Date.now();

  try {
    // Run the sync
    const result = await jobSyncService.syncNow({
      forceDiscovery: false,  // Use our 550 companies
      discoveryPages: 0       // Don't use JSearch (we have enough companies!)
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(70));
    console.log('✅ SYNC COMPLETE!');
    console.log('='.repeat(70));

    console.log(`\n📈 RESULTS:`);
    console.log(`  New jobs added: ${result.saved}`);
    console.log(`  Jobs updated: ${result.updated}`);
    console.log(`  Jobs skipped: ${result.skipped}`);
    console.log(`  Old jobs deactivated: ${result.deactivated}`);
    console.log(`  Duration: ${duration}s`);
    console.log(`  Companies tracked: ${result.companies}`);

    console.log(`\n🎯 JOB STATISTICS:`);
    console.log(`  Total jobs: ${result.stats.total}`);
    console.log(`  AI-applyable: ${result.stats.aiApplyable} (${result.stats.aiApplyablePercent}%)`);

    console.log(`\n📊 Jobs by ATS type:`);
    Object.entries(result.stats.byATS || {}).forEach(([ats, count]) => {
      console.log(`    ${ats}: ${count}`);
    });

    // Show final database stats
    console.log('\n📊 Final database stats:');
    const final = await prisma.aggregatedJob.count({ where: { isActive: true } });
    const finalBySource = await prisma.aggregatedJob.groupBy({
      by: ['source'],
      where: { isActive: true },
      _count: true
    });

    console.log(`  Total active jobs: ${final}`);
    finalBySource.forEach(s => {
      console.log(`    ${s.source}: ${s._count}`);
    });

    console.log('\n✅ SUCCESS!');
    console.log(`\n🎉 Your database now has ${final.toLocaleString()} jobs from ${result.companies} companies!`);
    console.log('   All with direct URLs, ready for AI auto-apply! 🚀');

    return result;

  } catch (error) {
    console.error('\n❌ SYNC FAILED:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
runFullSync()
  .then(() => {
    console.log('\n✅ Full sync completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  });
