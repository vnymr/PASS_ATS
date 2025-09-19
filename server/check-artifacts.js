import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkArtifacts() {
  // Check recent jobs
  const recentJobs = await prisma.job.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      artifacts: true
    }
  });

  console.log('\n=== Recent Jobs and Artifacts ===\n');

  for (const job of recentJobs) {
    console.log(`Job ID: ${job.id}`);
    console.log(`Status: ${job.status}`);
    console.log(`Created: ${job.createdAt}`);
    console.log(`Artifacts:`);

    if (job.artifacts.length === 0) {
      console.log('  ❌ NO ARTIFACTS FOUND');
    } else {
      for (const artifact of job.artifacts) {
        console.log(`  - ${artifact.type}: ${artifact.content ? artifact.content.length + ' bytes' : 'NULL'}`);
      }
    }
    console.log('---');
  }

  // Check specific job from error
  const problemJob = await prisma.job.findUnique({
    where: { id: 'job-1758248057025-p44ur9hvc' },
    include: { artifacts: true }
  });

  if (problemJob) {
    console.log('\n=== Problem Job ===');
    console.log(`Job ID: ${problemJob.id}`);
    console.log(`Status: ${problemJob.status}`);
    console.log(`Artifacts: ${problemJob.artifacts.length}`);
    problemJob.artifacts.forEach(a => {
      console.log(`  - ${a.type}: ${a.content ? a.content.length + ' bytes' : 'NULL'}`);
    });
  }

  await prisma.$disconnect();
}

checkArtifacts().catch(console.error);