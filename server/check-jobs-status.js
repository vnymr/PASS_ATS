/**
 * Check Jobs Database Status
 */

import { prisma } from './lib/prisma-client.js';

async function checkJobsStatus() {
  try {
    console.log('Checking jobs database status...\n');

    // Get total jobs
    const totalJobs = await prisma.aggregatedJob.count();
    const activeJobs = await prisma.aggregatedJob.count({ where: { isActive: true } });

    // Get latest job (by postedDate since no createdAt)
    const latestJob = await prisma.aggregatedJob.findFirst({
      orderBy: { postedDate: 'desc' },
      select: {
        title: true,
        company: true,
        source: true,
        postedDate: true,
        lastChecked: true
      }
    });

    // Get jobs by source
    const jobsBySource = await prisma.$queryRaw`
      SELECT source, COUNT(*)::int as count
      FROM "AggregatedJob"
      WHERE "isActive" = true
      GROUP BY source
      ORDER BY count DESC
    `;

    // Get recent additions (using postedDate as proxy)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const jobsLast24h = await prisma.aggregatedJob.count({
      where: {
        postedDate: { gte: last24h }
      }
    });

    const last7days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const jobsLast7days = await prisma.aggregatedJob.count({
      where: {
        postedDate: { gte: last7days }
      }
    });

    // Get AI applyable stats
    const aiApplyable = await prisma.aggregatedJob.count({
      where: { aiApplyable: true, isActive: true }
    });

    // Display results
    console.log('═══════════════════════════════════════════════');
    console.log('📊 JOBS DATABASE STATUS');
    console.log('═══════════════════════════════════════════════\n');

    console.log('📈 Total Jobs:');
    console.log(`   Total:  ${totalJobs.toLocaleString()}`);
    console.log(`   Active: ${activeJobs.toLocaleString()}`);
    console.log(`   AI-Applyable: ${aiApplyable.toLocaleString()} (${Math.round(aiApplyable/activeJobs*100)}%)\n`);

    console.log('📅 Recent Activity:');
    console.log(`   Last 24 hours: ${jobsLast24h.toLocaleString()} new jobs`);
    console.log(`   Last 7 days:   ${jobsLast7days.toLocaleString()} new jobs\n`);

    if (latestJob) {
      console.log('🆕 Latest Job Added:');
      console.log(`   Title:   ${latestJob.title}`);
      console.log(`   Company: ${latestJob.company}`);
      console.log(`   Source:  ${latestJob.source}`);
      console.log(`   Posted:  ${latestJob.postedDate?.toLocaleDateString() || 'N/A'}`);
      console.log(`   Last Checked: ${latestJob.lastChecked.toLocaleString()}\n`);
    }

    console.log('📦 Jobs by Source:');
    jobsBySource.forEach(row => {
      console.log(`   ${row.source}: ${row.count.toLocaleString()}`);
    });

    console.log('\n═══════════════════════════════════════════════');

    // Check if syncing is needed (using postedDate)
    const hoursSinceLastJob = latestJob
      ? (Date.now() - latestJob.postedDate.getTime()) / (1000 * 60 * 60)
      : 999;

    console.log('\n🔍 Analysis:');
    if (jobsLast24h === 0) {
      console.log('   ⚠️  WARNING: No jobs added in last 24 hours');
      console.log('   ⚠️  Job syncing may not be running!');
    } else if (jobsLast24h < 100) {
      console.log('   ⚠️  Low job growth (< 100 jobs/day)');
      console.log('   💡 Consider running aggressive discovery');
    } else {
      console.log('   ✅ Job syncing appears active');
    }

    if (activeJobs < 10000) {
      console.log(`   📊 Current: ${activeJobs.toLocaleString()} jobs`);
      console.log('   🎯 Target: 50,000-100,000 jobs for competitive advantage');
      console.log('   📈 Growth needed: ' + Math.round((50000 - activeJobs) / activeJobs * 100) + '%');
    }

    console.log('\n💡 To trigger job sync:');
    console.log('   curl -X POST http://localhost:5050/api/jobs/sync');
    console.log('\n💡 To discover new companies:');
    console.log('   curl -X POST http://localhost:5050/api/jobs/discover');

  } catch (error) {
    console.error('Error checking jobs status:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkJobsStatus();
