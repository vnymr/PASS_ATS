/**
 * Clean Adzuna Jobs from Database
 *
 * Removes all old Adzuna jobs since we no longer use that source
 */

import { prisma } from '../lib/prisma-client.js';
import logger from '../lib/logger.js';

async function cleanAdzunaJobs() {
  console.log('🧹 Cleaning Adzuna jobs from database...\n');

  try {
    // Count Adzuna jobs
    const count = await prisma.aggregatedJob.count({
      where: { source: 'adzuna' }
    });

    console.log(`Found ${count} Adzuna jobs to remove`);

    if (count === 0) {
      console.log('✅ No Adzuna jobs found - database is clean!');
      return;
    }

    // Show confirmation
    console.log('\n⚠️  This will DELETE all Adzuna jobs from the database.');
    console.log('   (Jobs from other sources will be preserved)\n');

    // Delete all Adzuna jobs
    console.log('Deleting...');
    const result = await prisma.aggregatedJob.deleteMany({
      where: { source: 'adzuna' }
    });

    console.log(`\n✅ Deleted ${result.count} Adzuna jobs`);

    // Show remaining jobs
    const remaining = await prisma.aggregatedJob.groupBy({
      by: ['source'],
      where: { isActive: true },
      _count: true
    });

    console.log('\n📊 Remaining jobs by source:');
    remaining.forEach(s => {
      console.log(`  ${s.source}: ${s._count} jobs`);
    });

    const total = remaining.reduce((sum, s) => sum + s._count, 0);
    console.log(`\nTotal active jobs: ${total}`);

  } catch (error) {
    console.error('❌ Error cleaning Adzuna jobs:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanAdzunaJobs()
  .then(() => {
    console.log('\n✅ Cleanup complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
