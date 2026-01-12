/**
 * BullMQ Queue Configuration for Resume Generation
 *
 * This queue handles asynchronous resume generation with:
 * - Concurrent processing (5 jobs at once)
 * - Automatic retries with exponential backoff
 * - Job timeout protection (2 minutes)
 * - Automatic cleanup of completed jobs
 *
 * Uses lazy initialization to ensure env vars are loaded first
 */

import { Queue } from 'bullmq';
import { createRedisConnection } from './redis-connection.js';
import logger from './logger.js';

// Lazy initialization - queue created on first access
let _resumeQueue = null;
let _connection = null;

/**
 * Get the resume queue (creates it lazily on first access)
 * This ensures env vars are loaded before Redis connection is created
 */
function getResumeQueue() {
  if (!_resumeQueue) {
    _connection = createRedisConnection();

    if (!_connection) {
      logger.warn('Redis not available - queue operations will fail');
      return null;
    }

    _resumeQueue = new Queue('resume-generation', {
      connection: _connection,
      defaultJobOptions: {
        // Retry failed jobs up to 3 times
        attempts: 3,

        // Exponential backoff: 10s, 30s, 90s
        backoff: {
          type: 'exponential',
          delay: 10000 // 10 seconds initial delay
        },

        // Job timeout: 2 minutes
        timeout: 120000,

        // Remove completed jobs after 100 to prevent memory bloat
        removeOnComplete: {
          count: 100,
          age: 3600 // 1 hour
        },

        // Keep failed jobs for debugging
        removeOnFail: false
      }
    });

    // Queue event handlers for monitoring
    _resumeQueue.on('error', (error) => {
      logger.error({ error: error.message }, 'Resume queue error');
    });

    logger.info('Resume generation queue initialized');
  }
  return _resumeQueue;
}

// Export getter for the queue (for backward compatibility)
export const resumeQueue = {
  add: async (...args) => {
    const queue = getResumeQueue();
    if (!queue) throw new Error('Redis queue not available');
    return queue.add(...args);
  },
  getJob: async (...args) => {
    const queue = getResumeQueue();
    if (!queue) throw new Error('Redis queue not available');
    return queue.getJob(...args);
  },
  getWaiting: async () => {
    const queue = getResumeQueue();
    if (!queue) return [];
    return queue.getWaiting();
  },
  getActive: async () => {
    const queue = getResumeQueue();
    if (!queue) return [];
    return queue.getActive();
  },
  getCompleted: async () => {
    const queue = getResumeQueue();
    if (!queue) return [];
    return queue.getCompleted();
  },
  getFailed: async () => {
    const queue = getResumeQueue();
    if (!queue) return [];
    return queue.getFailed();
  },
  close: async () => {
    if (_resumeQueue) {
      await _resumeQueue.close();
      _resumeQueue = null;
    }
  },
  on: (...args) => {
    const queue = getResumeQueue();
    if (queue) queue.on(...args);
  }
};

/**
 * Add a resume generation job to the queue
 *
 * @param {Object} data - Job data
 * @param {string} data.jobId - Database job ID
 * @param {number} data.userId - User ID
 * @param {Object} data.profileData - User profile data
 * @param {string} data.jobDescription - Target job description
 * @param {number} [priority=0] - Job priority (higher = processed first)
 * @returns {Promise<Object>} BullMQ job object
 */
export async function addResumeJob(data, priority = 0) {
  try {
    const job = await resumeQueue.add('generate-resume', data, {
      priority,
      jobId: data.jobId // Use database job ID as queue job ID for tracking
    });

    logger.info({
      jobId: data.jobId,
      queueJobId: job.id,
      priority
    }, 'Job added to queue');

    return job;
  } catch (error) {
    logger.error({
      error: error.message,
      jobId: data.jobId
    }, 'Failed to add job to queue');
    throw error;
  }
}

/**
 * Get job status from queue
 *
 * @param {string} jobId - Database job ID
 * @returns {Promise<Object>} Job status information
 */
export async function getJobStatus(jobId) {
  try {
    const job = await resumeQueue.getJob(jobId);

    if (!job) {
      return { found: false };
    }

    const state = await job.getState();
    const progress = job.progress || 0;

    return {
      found: true,
      state, // 'waiting', 'active', 'completed', 'failed'
      progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn
    };
  } catch (error) {
    logger.error({ error: error.message, jobId }, 'Failed to get job status');
    throw error;
  }
}

/**
 * Get queue metrics for monitoring
 *
 * @returns {Promise<Object>} Queue metrics
 */
export async function getQueueMetrics() {
  try {
    const waiting = await resumeQueue.getWaiting();
    const active = await resumeQueue.getActive();
    const completed = await resumeQueue.getCompleted();
    const failed = await resumeQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get queue metrics');
    throw error;
  }
}

/**
 * Graceful shutdown - close queue connections
 */
export async function closeQueue() {
  logger.info('Closing resume queue...');
  await resumeQueue.close();
  if (_connection) {
    await _connection.quit();
    _connection = null;
  }
  logger.info('Resume queue closed');
}

// Handle process termination
process.on('SIGTERM', closeQueue);
process.on('SIGINT', closeQueue);
