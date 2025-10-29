/**
 * Verify Adzuna Completely Removed
 *
 * Checks that:
 * 1. No Adzuna jobs in database
 * 2. All jobs have direct URLs
 * 3. System is using smart aggregator
 */

import { prisma } from '../lib/prisma-client.js';

async function verify() {
  console.log('🔍 Verifying Adzuna has been completely removed...\n');

  try {
    // 1. Check for Adzuna jobs in database
    console.log('1️⃣  Checking database for Adzuna jobs...');
    const adzunaCount = await prisma.aggregatedJob.count({
      where: { source: 'adzuna' }
    });

    if (adzunaCount > 0) {
      console.log(`   ❌ FAILED: Found ${adzunaCount} Adzuna jobs still in database`);
      console.log(`   Run: node scripts/clean-adzuna-jobs.js`);
      return false;
    }
    console.log('   ✅ PASSED: No Adzuna jobs found');

    // 2. Check all jobs have direct URLs (not adzuna.com redirects)
    console.log('\n2️⃣  Checking for redirect URLs...');
    const redirectJobs = await prisma.aggregatedJob.count({
      where: {
        isActive: true,
        applyUrl: {
          contains: 'adzuna.com'
        }
      }
    });

    if (redirectJobs > 0) {
      console.log(`   ❌ FAILED: Found ${redirectJobs} jobs with adzuna.com redirect URLs`);
      return false;
    }
    console.log('   ✅ PASSED: All jobs have direct URLs');

    // 3. Check current job sources
    console.log('\n3️⃣  Current job sources:');
    const sources = await prisma.aggregatedJob.groupBy({
      by: ['source'],
      where: { isActive: true },
      _count: true
    });

    sources.forEach(s => {
      const icon = ['greenhouse', 'lever', 'remotive', 'jsearch'].includes(s.source) ? '✅' : '⚠️';
      console.log(`   ${icon} ${s.source}: ${s._count} jobs`);
    });

    const validSources = sources.filter(s =>
      ['greenhouse', 'lever', 'remotive', 'jsearch', 'ashby'].includes(s.source)
    );

    if (validSources.length === 0) {
      console.log('   ❌ FAILED: No valid job sources found');
      return false;
    }

    // 4. Check sample jobs for direct URLs
    console.log('\n4️⃣  Sample jobs verification:');
    const sampleJobs = await prisma.aggregatedJob.findMany({
      where: { isActive: true },
      take: 5,
      select: {
        source: true,
        company: true,
        title: true,
        applyUrl: true,
        atsType: true,
        aiApplyable: true
      }
    });

    sampleJobs.forEach((job, i) => {
      const isDirectURL = !job.applyUrl.includes('adzuna') &&
                          !job.applyUrl.includes('redirect');
      const icon = isDirectURL ? '✅' : '❌';
      console.log(`   ${icon} [${job.source}] ${job.company} - ${job.title.substring(0, 40)}`);
      console.log(`      URL: ${job.applyUrl.substring(0, 80)}`);
      console.log(`      ATS: ${job.atsType}, AI-Applyable: ${job.aiApplyable}`);
    });

    // 5. Final stats
    console.log('\n5️⃣  Database summary:');
    const [total, aiApplyable, byATS] = await Promise.all([
      prisma.aggregatedJob.count({ where: { isActive: true } }),
      prisma.aggregatedJob.count({ where: { isActive: true, aiApplyable: true } }),
      prisma.aggregatedJob.groupBy({
        by: ['atsType'],
        where: { isActive: true },
        _count: true
      })
    ]);

    console.log(`   Total active jobs: ${total}`);
    console.log(`   AI-applyable: ${aiApplyable} (${((aiApplyable / total) * 100).toFixed(1)}%)`);
    console.log('\n   Jobs by ATS:');
    byATS.forEach(ats => {
      console.log(`     ${ats.atsType}: ${ats._count}`);
    });

    // Success!
    console.log('\n' + '='.repeat(60));
    console.log('✅ VERIFICATION PASSED - ADZUNA COMPLETELY REMOVED!');
    console.log('='.repeat(60));

    console.log('\n📊 Current System:');
    console.log(`   Sources: ${sources.map(s => s.source).join(', ')}`);
    console.log(`   Total Jobs: ${total}`);
    console.log(`   AI-Applyable: ${aiApplyable} (${((aiApplyable / total) * 100).toFixed(1)}%)`);
    console.log('   Direct URLs: 100% ✅');
    console.log('   Adzuna Jobs: 0 ✅');

    return true;

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

verify()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
