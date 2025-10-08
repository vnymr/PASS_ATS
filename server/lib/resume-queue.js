import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import ResumeParser from './resume-parser.js';
import { prisma } from './prisma-client.js';
import logger from './logger.js';

// Create Redis connection
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

// Create resume parsing queue
export const resumeQueue = new Queue('resume-parsing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600 // Remove completed jobs after 24 hours
    },
    removeOnFail: {
      count: 50 // Keep last 50 failed jobs
    }
  }
});

// Worker to process resume parsing jobs
export const resumeWorker = new Worker(
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
      // Update job progress
      await job.updateProgress(10);

      // Parse the resume
      const parser = new ResumeParser();
      const bufferData = Buffer.from(buffer, 'base64');

      await job.updateProgress(30);

      const { text, extractedData } = await parser.parseResume(bufferData, mimeType);

      await job.updateProgress(70);

      // Prepare data to save
      const resumeData = {
        resumeText: text,
        savedResumeBuffer: buffer,
        savedResumeMimeType: mimeType,
        savedResumeFilename: filename,
        extractedData
      };

      // If mergeWithProfile is true, merge with existing profile
      if (mergeWithProfile) {
        const existingProfile = await prisma.profile.findUnique({
          where: { userId }
        });

        let finalData = resumeData;

        if (existingProfile?.data) {
          // Merge: keep existing data, add resume data
          finalData = {
            ...existingProfile.data,
            ...resumeData,
            // Merge arrays intelligently
            skills: [
              ...(existingProfile.data.skills || []),
              ...(extractedData.skills || [])
            ].filter((v, i, a) => a.indexOf(v) === i), // Remove duplicates

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

        // Update profile in database
        await prisma.profile.upsert({
          where: { userId },
          update: {
            data: finalData,
            updatedAt: new Date()
          },
          create: {
            userId,
            data: finalData
          }
        });
      } else {
        // Just store resume data without merging
        await prisma.profile.upsert({
          where: { userId },
          update: {
            data: resumeData,
            updatedAt: new Date()
          },
          create: {
            userId,
            data: resumeData
          }
        });
      }

      await job.updateProgress(100);

      logger.info({
        jobId: job.id,
        userId,
        textLength: text.length
      }, 'Resume parsing completed successfully');

      return {
        success: true,
        extractedData,
        resumeText: text,
        textLength: text.length
      };

    } catch (error) {
      logger.error({
        jobId: job.id,
        userId,
        error: error.message
      }, 'Resume parsing job failed');

      throw error;
    }
  },
  {
    connection,
    concurrency: 10, // Process up to 10 resumes concurrently
    limiter: {
      max: 100, // Max 100 jobs
      duration: 60000 // per 60 seconds (to respect OpenAI rate limits)
    }
  }
);

// Event listeners
resumeWorker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, userId: job.data.userId }, 'Resume parsing job completed');
});

resumeWorker.on('failed', (job, err) => {
  logger.error({
    jobId: job.id,
    userId: job.data?.userId,
    error: err.message
  }, 'Resume parsing job failed');
});

resumeWorker.on('error', (err) => {
  logger.error({ error: err.message }, 'Resume worker error');
});

// Helper function to add resume to queue
export async function queueResumeForParsing(userId, buffer, mimeType, filename, mergeWithProfile = true) {
  try {
    const job = await resumeQueue.add('parse-resume', {
      userId,
      buffer: buffer.toString('base64'), // Convert buffer to base64 for Redis
      mimeType,
      filename,
      mergeWithProfile
    }, {
      jobId: `resume-${userId}-${Date.now()}` // Unique job ID
    });

    logger.info({
      jobId: job.id,
      userId,
      filename
    }, 'Resume queued for parsing');

    return {
      jobId: job.id,
      status: 'queued'
    };
  } catch (error) {
    logger.error({
      userId,
      filename,
      error: error.message
    }, 'Failed to queue resume for parsing');
    throw error;
  }
}

// Helper function to get job status
export async function getResumeParsingStatus(jobId) {
  try {
    const job = await resumeQueue.getJob(jobId);

    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const progress = job.progress;

    let result = null;
    if (state === 'completed') {
      result = job.returnvalue;
    }

    let error = null;
    if (state === 'failed') {
      error = job.failedReason;
    }

    return {
      jobId: job.id,
      status: state,
      progress,
      result,
      error
    };
  } catch (error) {
    logger.error({ jobId, error: error.message }, 'Failed to get job status');
    throw error;
  }
}

export default {
  resumeQueue,
  resumeWorker,
  queueResumeForParsing,
  getResumeParsingStatus
};
