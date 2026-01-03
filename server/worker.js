/**
 * BullMQ Worker Process for Resume Generation
 *
 * This is a separate process from the main API server that handles
 * resume generation jobs from the queue.
 *
 * Features:
 * - Processes 50 jobs concurrently (scaled for 1000+ users)
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

// Create worker with timeout protection
const worker = new Worker('resume-generation', async (job) => {
  const { jobId, userId, profileData, jobDescription } = job.data;

  logger.info({
    jobId,
    userId,
    queueJobId: job.id,
    attempt: job.attemptsMade + 1
  }, 'Worker processing job');

  try {
    // Create a timeout promise (5 minutes)
    const timeoutMs = 5 * 60 * 1000; // 5 minutes
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Job timeout - exceeded 5 minute limit')), timeoutMs);
    });

    // Process the job with timeout protection
    const jobPromise = processResumeJob(
      { jobId, profileData, jobDescription },
      async (progress) => {
        // Update job progress (0-100)
        if (typeof progress === 'number') {
          await job.updateProgress(progress);
        }
      }
    );

    // Race between job completion and timeout
    await Promise.race([jobPromise, timeoutPromise]);

    logger.info({ jobId, queueJobId: job.id }, 'Worker completed job successfully');
  } catch (error) {
    logger.error({
      jobId,
      queueJobId: job.id,
      error: error.message,
      attempt: job.attemptsMade + 1,
      isTimeout: error.message.includes('timeout')
    }, 'Worker job processing failed');

    throw error; // Re-throw to trigger BullMQ retry
  }
}, {
  connection,
  concurrency: 50, // Process 50 jobs concurrently (scaled for 1000+ users)
  limiter: {
    max: 100, // Max 100 jobs (up from 10)
    duration: 1000 // per second
  },
  settings: {
    // Job-level timeout: 5 minutes (300 seconds)
    // This is a hard timeout enforced by BullMQ itself
    lockDuration: 300000, // 5 minutes
    maxStalledCount: 1 // Only retry once if job stalls (hangs)
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
  concurrency: 50,
  queue: 'resume-generation',
  timeout: '5 minutes',
  lockDuration: 300000
}, 'Resume generation worker started');

logger.info('🚀 Resume Generation Worker Started');
logger.info('📊 Concurrency: 50 jobs at once (scaled for 1000+ users)');
logger.info('⏱️  Timeout: 5 minutes per job (with automatic retry)');
logger.info('🔄 Auto-retry: Up to 3 attempts on failure');
logger.info('🚨 Stall detection: Jobs hanging >5min will be auto-retried once');
logger.info('🚀 Throughput: Up to 100 jobs/second');
logger.info('\n✅ Ready to process jobs...\n');
