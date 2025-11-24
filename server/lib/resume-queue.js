import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import ResumeParser from './resume-parser.js';
import { prisma } from './prisma-client.js';
import logger from './logger.js';

// Track Redis availability
let redisAvailable = false;
let connection = null;
let resumeQueue = null;
let resumeWorker = null;

// Maximum retry attempts before giving up on Redis
const MAX_REDIS_RETRIES = 5;
let redisRetryCount = 0;

// Check if Redis URL is an internal Railway URL that might not be accessible
function isInternalRedisUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.railway.internal');
  } catch {
    return false;
  }
}

// Initialize Redis connection with retry limit
function initializeRedis() {
  const redisUrl = process.env.REDIS_URL;

  // In production without REDIS_URL, don't try to connect to localhost
  if (!redisUrl) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('REDIS_URL not set in production, running without Redis queue');
      return null;
    }
    // In development, use localhost
  }

  const finalUrl = redisUrl || 'redis://localhost:6379';

  // Skip if we've exceeded retries
  if (redisRetryCount >= MAX_REDIS_RETRIES) {
    logger.warn('Redis max retries exceeded, running without Redis queue');
    return null;
  }

  try {
    const conn = new Redis(finalUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 5000, // 5 second timeout
      lazyConnect: true, // Don't connect immediately
      retryStrategy(times) {
        redisRetryCount = times;
        if (times > MAX_REDIS_RETRIES) {
          logger.warn({ attempt: times }, 'Redis max retries exceeded, stopping reconnection');
          redisAvailable = false;
          return null; // Stop retrying
        }
        const delay = Math.min(times * 500, 3000);
        logger.warn({ attempt: times, delay, maxRetries: MAX_REDIS_RETRIES }, 'Redis retry attempt');
        return delay;
      }
    });

    conn.on('connect', () => {
      redisAvailable = true;
      redisRetryCount = 0;
      logger.info('Redis connected for resume queue');
    });

    conn.on('ready', () => {
      redisAvailable = true;
      logger.info('Redis ready for resume queue');
    });

    conn.on('error', (error) => {
      redisAvailable = false;
      // Only log once per error type to avoid spam
      if (redisRetryCount <= MAX_REDIS_RETRIES) {
        logger.error({ error: error.message }, 'Redis connection error');
      }
      // Don't rethrow - let retry strategy handle it
    });

    conn.on('close', () => {
      redisAvailable = false;
      if (redisRetryCount <= MAX_REDIS_RETRIES) {
        logger.warn('Redis connection closed');
      }
    });

    conn.on('end', () => {
      redisAvailable = false;
      logger.warn('Redis connection ended, queue features disabled');
    });

    return conn;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create Redis connection');
    return null;
  }
}

// Initialize queue and worker if Redis is available
function initializeQueueAndWorker() {
  if (!connection) {
    connection = initializeRedis();
  }

  if (!connection) {
    logger.warn('Redis not available, resume queue disabled');
    return;
  }

  try {
    // Create resume parsing queue
    resumeQueue = new Queue('resume-parsing', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: {
          count: 100,
          age: 24 * 3600
        },
        removeOnFail: {
          count: 50
        }
      }
    });

    // Worker to process resume parsing jobs
    resumeWorker = new Worker(
      'resume-parsing',
      async (job) => {
        const { userId, buffer, mimeType, filename, mergeWithProfile } = job.data;

        logger.info({
          jobId: job.id,
          userId,
          filename,
          mimeType
        }, 'Starting resume parsing job');

        try {
          await job.updateProgress(10);
          const parser = new ResumeParser();
          const bufferData = Buffer.from(buffer, 'base64');
          await job.updateProgress(30);
          const { text, extractedData } = await parser.parseResume(bufferData, mimeType);
          await job.updateProgress(70);

          const resumeData = {
            resumeText: text,
            savedResumeBuffer: buffer,
            savedResumeMimeType: mimeType,
            savedResumeFilename: filename,
            extractedData
          };

          if (mergeWithProfile) {
            const existingProfile = await prisma.profile.findUnique({
              where: { userId }
            });

            let finalData = resumeData;

            if (existingProfile?.data) {
              finalData = {
                ...existingProfile.data,
                ...resumeData,
                skills: [
                  ...(existingProfile.data.skills || []),
                  ...(extractedData.skills || [])
                ].filter((v, i, a) => a.indexOf(v) === i),
                experience: [
                  ...(existingProfile.data.experience || []),
                  ...(extractedData.experience || [])
                ],
                education: [
                  ...(existingProfile.data.education || []),
                  ...(extractedData.education || [])
                ],
                projects: [
                  ...(existingProfile.data.projects || []),
                  ...(extractedData.projects || [])
                ]
              };
            }

            await prisma.profile.upsert({
              where: { userId },
              update: { data: finalData, updatedAt: new Date() },
              create: { userId, data: finalData }
            });
          } else {
            await prisma.profile.upsert({
              where: { userId },
              update: { data: resumeData, updatedAt: new Date() },
              create: { userId, data: resumeData }
            });
          }

          await job.updateProgress(100);

          logger.info({
            jobId: job.id,
            userId,
            textLength: text.length
          }, 'Resume parsing completed successfully');

          return { success: true, extractedData, resumeText: text, textLength: text.length };

        } catch (error) {
          logger.error({ jobId: job.id, userId, error: error.message }, 'Resume parsing job failed');
          throw error;
        }
      },
      {
        connection,
        concurrency: 10,
        limiter: { max: 100, duration: 60000 }
      }
    );

    resumeWorker.on('completed', (job, result) => {
      logger.info({ jobId: job.id, userId: job.data.userId }, 'Resume parsing job completed');
    });

    resumeWorker.on('failed', (job, err) => {
      logger.error({ jobId: job.id, userId: job.data?.userId, error: err.message }, 'Resume parsing job failed');
    });

    resumeWorker.on('error', (err) => {
      // Only log if we haven't exceeded retries
      if (redisRetryCount <= MAX_REDIS_RETRIES) {
        logger.error({ error: err.message }, 'Resume worker error');
      }
    });

    logger.info('Resume queue and worker initialized');
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to initialize resume queue');
  }
}

// Initialize on module load
initializeQueueAndWorker();

// Helper function to add resume to queue (with fallback)
export async function queueResumeForParsing(userId, buffer, mimeType, filename, mergeWithProfile = true) {
  // If Redis isn't available, process synchronously
  if (!redisAvailable || !resumeQueue) {
    logger.info({ userId, filename }, 'Redis not available, processing resume synchronously');
    return await processResumeSynchronously(userId, buffer, mimeType, filename, mergeWithProfile);
  }

  try {
    const job = await resumeQueue.add('parse-resume', {
      userId,
      buffer: buffer.toString('base64'),
      mimeType,
      filename,
      mergeWithProfile
    }, {
      jobId: `resume-${userId}-${Date.now()}`
    });

    logger.info({ jobId: job.id, userId, filename }, 'Resume queued for parsing');
    return { jobId: job.id, status: 'queued' };
  } catch (error) {
    logger.warn({ userId, filename, error: error.message }, 'Queue failed, processing synchronously');
    return await processResumeSynchronously(userId, buffer, mimeType, filename, mergeWithProfile);
  }
}

// Synchronous fallback when Redis is unavailable
async function processResumeSynchronously(userId, buffer, mimeType, filename, mergeWithProfile) {
  try {
    const parser = new ResumeParser();
    const { text, extractedData } = await parser.parseResume(buffer, mimeType);

    const resumeData = {
      resumeText: text,
      savedResumeBuffer: buffer.toString('base64'),
      savedResumeMimeType: mimeType,
      savedResumeFilename: filename,
      extractedData
    };

    if (mergeWithProfile) {
      const existingProfile = await prisma.profile.findUnique({ where: { userId } });
      let finalData = resumeData;

      if (existingProfile?.data) {
        finalData = {
          ...existingProfile.data,
          ...resumeData,
          skills: [...(existingProfile.data.skills || []), ...(extractedData.skills || [])].filter((v, i, a) => a.indexOf(v) === i),
          experience: [...(existingProfile.data.experience || []), ...(extractedData.experience || [])],
          education: [...(existingProfile.data.education || []), ...(extractedData.education || [])],
          projects: [...(existingProfile.data.projects || []), ...(extractedData.projects || [])]
        };
      }

      await prisma.profile.upsert({
        where: { userId },
        update: { data: finalData, updatedAt: new Date() },
        create: { userId, data: finalData }
      });
    } else {
      await prisma.profile.upsert({
        where: { userId },
        update: { data: resumeData, updatedAt: new Date() },
        create: { userId, data: resumeData }
      });
    }

    logger.info({ userId, filename, textLength: text.length }, 'Resume parsed synchronously');
    return { jobId: `sync-${userId}-${Date.now()}`, status: 'completed', result: { success: true, extractedData } };
  } catch (error) {
    logger.error({ userId, filename, error: error.message }, 'Synchronous resume parsing failed');
    throw error;
  }
}

// Helper function to get job status
export async function getResumeParsingStatus(jobId) {
  // Handle synchronous jobs
  if (jobId.startsWith('sync-')) {
    return { jobId, status: 'completed', progress: 100 };
  }

  if (!redisAvailable || !resumeQueue) {
    return { status: 'redis_unavailable', message: 'Queue not available' };
  }

  try {
    const job = await resumeQueue.getJob(jobId);
    if (!job) return { status: 'not_found' };

    const state = await job.getState();
    const progress = job.progress;
    let result = state === 'completed' ? job.returnvalue : null;
    let error = state === 'failed' ? job.failedReason : null;

    return { jobId: job.id, status: state, progress, result, error };
  } catch (error) {
    logger.error({ jobId, error: error.message }, 'Failed to get job status');
    throw error;
  }
}

export { resumeQueue, resumeWorker };

export default {
  resumeQueue,
  resumeWorker,
  queueResumeForParsing,
  getResumeParsingStatus
};
