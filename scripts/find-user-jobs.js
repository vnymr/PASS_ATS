#!/usr/bin/env node

const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function findUserJobs() {
  try {
    const userId = parseInt(process.argv[2]) || 19;

    console.log(`🔍 Finding jobs for user ID: ${userId}\n`);

    const jobs = await prisma.job.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        _count: {
          select: { artifacts: true }
        }
      }
    });

    if (jobs.length === 0) {
      console.log('❌ No jobs found for this user');
      process.exit(0);
    }

    console.log(`Found ${jobs.length} job(s):\n`);

    jobs.forEach((job, index) => {
      console.log(`${index + 1}. Job ID: ${job.id}`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Created: ${job.createdAt}`);
      console.log(`   Updated: ${job.updatedAt}`);
      console.log(`   Artifacts: ${job._count.artifacts}`);
      console.log(`   Progress: ${job.progress || 0}%`);
      if (job.error) {
        console.log(`   Error: ${job.error.substring(0, 100)}...`);
      }
      console.log('');
    });

    // Find completed jobs with PDFs
    const completedJobs = jobs.filter(j => j.status === 'completed' && j._count.artifacts > 0);

    if (completedJobs.length > 0) {
      console.log(`✅ ${completedJobs.length} completed job(s) with artifacts:`);
      completedJobs.forEach(job => {
        console.log(`   - ${job.id} (${job._count.artifacts} artifact(s))`);
      });

      console.log(`\n\nUse this job ID for testing:`);
      console.log(`export JOB_ID="${completedJobs[0].id}"`);
    } else {
      console.log('⚠️  No completed jobs with artifacts found for this user');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

findUserJobs();
