/**
 * Auto-Apply Queue Worker
 * Processes queued job applications in the background
 *
 * Run this in a separate process:
 *   node auto-apply-worker.js
 *
 * Or with PM2:
 *   pm2 start auto-apply-worker.js --name auto-apply-worker
 */

import autoApplyQueue from './lib/auto-apply-queue.js';
import logger from './lib/logger.js';

logger.info('🔧 Starting auto-apply worker...');
logger.info(`   Redis: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
logger.info(`   Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
logger.info(`   BrowserUse: ${process.env.BROWSERUSE_API_KEY ? 'Configured' : 'Not configured'}`);

// The queue processor is already set up in auto-apply-queue.js
// It will automatically start processing jobs

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker gracefully...');
  await autoApplyQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing worker gracefully...');
  await autoApplyQueue.close();
  process.exit(0);
});

// Log queue events
autoApplyQueue.on('waiting', (jobId) => {
  logger.debug({ jobId }, 'Job waiting in queue');
});

autoApplyQueue.on('active', (job) => {
  logger.info({ jobId: job.id, applicationId: job.data.applicationId }, 'Processing job...');
});

autoApplyQueue.on('progress', (job, progress) => {
  logger.debug({ jobId: job.id, progress }, 'Job progress update');
});

logger.info('✅ Auto-apply worker ready to process jobs');
logger.info('   Queue: auto-apply');
logger.info('   Press Ctrl+C to stop');

// Keep process alive and log stats
setInterval(async () => {
  try {
    // Use getJobCounts from Bull queue directly
    const waiting = await autoApplyQueue.getWaitingCount();
    const active = await autoApplyQueue.getActiveCount();
    const completed = await autoApplyQueue.getCompletedCount();
    const failed = await autoApplyQueue.getFailedCount();

    const counts = { waiting, active, completed, failed };

    if (waiting > 0 || active > 0) {
      logger.info({ counts }, 'Queue status');
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get queue stats');
  }
}, 5 * 60 * 1000); // Every 5 minutes
