/**
 * Get a test job from the database
 */

import 'dotenv/config';
import { prisma } from '../lib/prisma-client.js';

async function getTestJob() {
  try {
    console.log('🔍 Fetching AI-applyable jobs from database...\n');

    const jobs = await prisma.aggregatedJob.findMany({
      where: {
        aiApplyable: true,
        isActive: true
      },
      select: {
        id: true,
        title: true,
        company: true,
        applyUrl: true,
        atsType: true,
        atsComplexity: true,
        aiApplyable: true,
        location: true,
        description: true,
        postedDate: true
      },
      orderBy: {
        postedDate: 'desc'
      },
      take: 5
    });

    if (jobs.length === 0) {
      console.log('❌ No AI-applyable jobs found in database');
      console.log('   Run job sync to populate jobs first');
      return;
    }

    console.log(`✅ Found ${jobs.length} AI-applyable jobs:\n`);
    console.log('='.repeat(80));

    jobs.forEach((job, i) => {
      console.log(`\n${i + 1}. ${job.title}`);
      console.log(`   Company: ${job.company}`);
      console.log(`   Location: ${job.location || 'Not specified'}`);
      console.log(`   ATS: ${job.atsType} (${job.atsComplexity})`);
      console.log(`   URL: ${job.applyUrl}`);
      console.log(`   Posted: ${job.postedDate ? new Date(job.postedDate).toISOString().split('T')[0] : 'Not specified'}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n📋 First job details for testing:\n');
    console.log(JSON.stringify(jobs[0], null, 2));

    console.log('\n💡 To test this job, run:');
    console.log(`   node scripts/test-real-job.js "${jobs[0].applyUrl}"`);

    return jobs[0];

  } catch (error) {
    console.error('❌ Error fetching jobs:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

getTestJob()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
