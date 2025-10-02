/**
 * BullMQ Worker Process for Resume Generation
 *
 * This is a separate process from the main API server that handles
 * resume generation jobs from the queue.
 *
 * Features:
 * - Processes 5 jobs concurrently
 * - Automatic retries with exponential backoff
 * - Progress reporting (0-100%)
 * - Graceful shutdown
 *
 * Usage:
 *   node worker.js
 */

import { Worker } from 'bullmq';
import { createRedisConnection } from './lib/redis-connection.js';
import { processResumeJob } from './lib/job-processor.js';
import logger from './lib/logger.js';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Create Redis connection for worker
const connection = createRedisConnection();

// Create worker
const worker = new Worker('resume-generation', async (job) => {
  const { jobId, userId, profileData, jobDescription } = job.data;

  logger.info({
    jobId,
    userId,
    queueJobId: job.id,
    attempt: job.attemptsMade + 1
  }, 'Worker processing job');

  try {
    // Process the job with progress reporting
    await processResumeJob(
      { jobId, profileData, jobDescription },
      (progress) => {
        // Update job progress (0-100)
        if (typeof progress === 'number') {
          job.updateProgress(progress);
        }
      }
    );

    logger.info({ jobId, queueJobId: job.id }, 'Worker completed job successfully');
  } catch (error) {
    logger.error({
      jobId,
      queueJobId: job.id,
      error: error.message,
      attempt: job.attemptsMade + 1
    }, 'Worker job processing failed');

    throw error; // Re-throw to trigger BullMQ retry
  }
}, {
  connection,
  concurrency: 5, // Process 5 jobs concurrently
  limiter: {
    max: 10, // Max 10 jobs
    duration: 1000 // per second
  }
});

// Worker event handlers
worker.on('completed', (job) => {
  logger.info({
    jobId: job.data.jobId,
    queueJobId: job.id,
    duration: job.finishedOn - job.processedOn
  }, 'Job completed');
});

worker.on('failed', (job, error) => {
  logger.error({
    jobId: job?.data?.jobId,
    queueJobId: job?.id,
    error: error.message,
    attemptsMade: job?.attemptsMade
  }, 'Job failed');
});

worker.on('error', (error) => {
  logger.error({ error: error.message }, 'Worker error');
});

worker.on('stalled', (jobId) => {
  logger.warn({ jobId }, 'Job stalled - may be taking too long');
});

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down worker...');

  try {
    await worker.close();
    await connection.quit();
    logger.info('Worker shut down gracefully');
    process.exit(0);
  } catch (error) {
    logger.error({ error: error.message }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

logger.info({
  concurrency: 5,
  queue: 'resume-generation'
}, 'Resume generation worker started');

console.log('🚀 Resume Generation Worker Started');
console.log('📊 Concurrency: 5 jobs at once');
console.log('⏱️  Timeout: 2 minutes per job');
console.log('🔄 Auto-retry: Up to 3 attempts');
console.log('\n✅ Ready to process jobs...\n');
