/**
 * Add a test job to the worker queue for testing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addTestWorkerJob() {
  try {
    // Find a user with a profile
    const user = await prisma.user.findFirst({
      where: { profile: { isNot: null } },
      include: { profile: true }
    });

    if (!user) {
      console.log('No user with profile found.');
      return;
    }

    console.log(`Using user: ${user.email}`);

    // Find an existing AggregatedJob with greenhouse
    let job = await prisma.aggregatedJob.findFirst({
      where: {
        applyUrl: { contains: 'greenhouse' },
        isActive: true
      }
    });

    if (!job) {
      // Try to find any active job
      job = await prisma.aggregatedJob.findFirst({
        where: { isActive: true }
      });
    }

    if (!job) {
      // Create a test job
      job = await prisma.aggregatedJob.create({
        data: {
          externalId: `test-job-${Date.now()}`,
          source: 'test',
          title: 'Software Engineer - Test',
          company: 'Test Company',
          location: 'Remote',
          description: 'This is a test job for worker-assisted apply testing. We are looking for a talented engineer to join our team.',
          applyUrl: 'https://boards.greenhouse.io/testcompany/jobs/12345',
          atsType: 'greenhouse',
          atsComplexity: 'simple',
          atsConfidence: 0.9,
          aiApplyable: true,
          postedDate: new Date(),
          isActive: true
        }
      });
      console.log('Created test job:', job.id);
    } else {
      console.log('Using existing job:', job.title, 'at', job.company);
    }

    // Check if AutoApplication already exists for this user+job
    const existingApp = await prisma.autoApplication.findUnique({
      where: {
        userId_jobId: {
          userId: user.id,
          jobId: job.id
        }
      },
      include: { workerSession: true }
    });

    if (existingApp) {
      if (existingApp.workerSession) {
        console.log('\n⚠️ Job already in worker queue!');
        console.log('   Session ID:', existingApp.workerSession.id);
        console.log('   Status:', existingApp.workerSession.status);
        return;
      }
      // Has auto-application but no worker session - add one
      const session = await prisma.workerSession.create({
        data: {
          autoApplicationId: existingApp.id,
          status: 'QUEUED'
        }
      });
      console.log('\n✅ Added existing application to worker queue!');
      console.log('   Session ID:', session.id);
      return;
    }

    // Create an AutoApplication
    const autoApp = await prisma.autoApplication.create({
      data: {
        userId: user.id,
        jobId: job.id,
        status: 'QUEUED',
        method: 'WORKER_SUBMIT'
      }
    });

    console.log('Created AutoApplication:', autoApp.id);

    // Create WorkerSession (queued)
    const session = await prisma.workerSession.create({
      data: {
        autoApplicationId: autoApp.id,
        status: 'QUEUED'
      }
    });

    console.log('Created WorkerSession:', session.id);
    console.log('\n✅ Test job added to worker queue!');
    console.log('   Session ID:', session.id);
    console.log('   Job:', job.title, 'at', job.company);
    console.log('   Apply URL:', job.applyUrl);
    console.log('\nRefresh the worker dashboard to see it in the queue.');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

addTestWorkerJob();
