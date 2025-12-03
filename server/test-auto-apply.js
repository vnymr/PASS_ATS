import 'dotenv/config';
import { prisma } from './lib/prisma-client.js';
import autoApplyQueue from './lib/auto-apply-queue.js';

console.log('Creating test auto-apply job...');

// Find user
const user = await prisma.user.findFirst({
  where: { email: { contains: 'test' } }
});

if (!user) {
  console.error('❌ No test user found.');
  process.exit(1);
}

console.log('✅ Found user:', user.email);

// Find AI-applyable job (simpler query)
const jobs = await prisma.aggregatedJob.findMany({
  where: { aiApplyable: true },
  orderBy: { id: 'desc' },
  take: 10
});

const job = jobs.find(j => j.applyUrl && j.applyUrl.length > 0);

if (!job) {
  console.error('❌ No AI-applyable jobs with apply URL found.');
  console.log('Total AI-applyable jobs:', jobs.length);
  process.exit(1);
}

console.log('✅ Found job:', job.title, 'at', job.company);
console.log('   Apply URL:', job.applyUrl);

// Check if already applied
const existing = await prisma.autoApplication.findFirst({
  where: {
    userId: user.id,
    jobId: job.id
  }
});

if (existing) {
  console.log('⚠️  Already applied to this job.');
  console.log('   Application ID:', existing.id);
  console.log('   Status:', existing.status);

  // Re-queue if not actively processing
  if (['FAILED', 'CANCELLED', 'QUEUED'].includes(existing.status)) {
    console.log('   Updating to QUEUED and re-queueing...');
    await prisma.autoApplication.update({
      where: { id: existing.id },
      data: { status: 'QUEUED', error: null, errorType: null }
    });

    const queueJob = await autoApplyQueue.add({
      applicationId: existing.id,
      userId: user.id,
      jobUrl: job.applyUrl,
      atsType: job.atsType || 'UNKNOWN'
    });

    console.log('✅ Re-queued job:', queueJob.id);
    console.log('');
    console.log('🔄 Job is now queued. Worker should pick it up shortly...');
  }
} else {
  // Create new application
  const application = await prisma.autoApplication.create({
    data: {
      userId: user.id,
      jobId: job.id,
      status: 'QUEUED',
      method: 'AI_AUTO'
    }
  });

  console.log('✅ Created application:', application.id);

  // Queue the job
  const queueJob = await autoApplyQueue.add({
    applicationId: application.id,
    userId: user.id,
    jobUrl: job.applyUrl,
    atsType: job.atsType || 'UNKNOWN'
  });

  console.log('✅ Queued job:', queueJob.id);
}

console.log('');
console.log('🔄 Job is now queued. Worker should pick it up shortly...');

await prisma.$disconnect();
await autoApplyQueue.close();
