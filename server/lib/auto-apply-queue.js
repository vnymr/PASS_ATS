/**
 * Auto-Apply Queue Worker
 * Processes queued job applications using AI (primary) or recipe engine (fallback)
 */

import Queue from 'bull';
import recipeEngine from './recipe-engine.js';
import { prisma } from './prisma-client.js';
import logger from './logger.js';
import AIFormFiller from './ai-form-filler.js';
import puppeteer from 'puppeteer';

const aiFormFiller = new AIFormFiller();

// Strategy selector: AI first, then recipes
const APPLY_STRATEGY = process.env.APPLY_STRATEGY || 'AI_FIRST'; // AI_FIRST, RECIPE_ONLY, AI_ONLY

const redisUrl = process.env.REDIS_URL || '';

if (!redisUrl && process.env.NODE_ENV === 'production') {
  throw new Error('REDIS_URL environment variable is required in production. Set REDIS_URL to a reachable Redis instance.');
}

function parseRedisConfig(url) {
  if (!url) {
    return { host: '127.0.0.1', port: 6379 };
  }
  try {
    const parsed = new URL(url);
    const config = {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 6379
    };
    if (parsed.password) {
      config.password = parsed.password;
    }
    if (parsed.protocol === 'rediss:') {
      config.tls = { rejectUnauthorized: false };
    }
    return config;
  } catch (error) {
    logger.error({ error: error.message }, 'Invalid REDIS_URL value');
    throw error;
  }
}

const redisConfig = parseRedisConfig(redisUrl);
if (!redisUrl) {
  logger.warn('REDIS_URL not set; defaulting to redis://127.0.0.1:6379 for auto-apply queue');
} else {
  logger.info({ host: redisConfig.host, port: redisConfig.port }, 'Auto-apply queue using configured Redis');
}

/**
 * Apply to job using AI-powered form filling
 */
async function applyWithAI(jobUrl, user, jobData) {
  let browser;

  try {
    logger.info('🚀 Launching browser for AI application...');

    browser = await puppeteer.launch({
      headless: process.env.PUPPETEER_HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Navigate to job application page
    logger.info(`📄 Navigating to ${jobUrl}...`);
    await page.goto(jobUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait a bit for dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Prepare user profile data
    const userProfile = {
      fullName: user.profile.data?.applicationData?.personalInfo?.fullName ||
                `${user.profile.data?.firstName || ''} ${user.profile.data?.lastName || ''}`.trim(),
      email: user.email,
      phone: user.profile.data?.applicationData?.personalInfo?.phone || '',
      location: user.profile.data?.applicationData?.personalInfo?.location || '',
      linkedIn: user.profile.data?.applicationData?.personalInfo?.linkedin || '',
      portfolio: user.profile.data?.applicationData?.personalInfo?.website || '',
      experience: user.profile.data?.applicationData?.experience || [],
      education: user.profile.data?.applicationData?.education || [],
      skills: user.profile.data?.applicationData?.skills || []
    };

    // Use AI to fill the form
    logger.info('🤖 AI analyzing and filling form...');
    const fillResult = await aiFormFiller.fillFormIntelligently(page, userProfile, jobData);

    if (!fillResult.success) {
      logger.error('❌ AI form filling failed:', fillResult.errors);
      await browser.close();
      return {
        success: false,
        error: fillResult.errors.join('; '),
        method: 'AI_AUTO',
        cost: fillResult.cost,
        details: fillResult
      };
    }

    // Take final screenshot
    const screenshot = await page.screenshot({
      encoding: 'base64',
      fullPage: false
    });

    logger.info('✅ AI successfully filled form!');
    logger.info(`   Fields filled: ${fillResult.fieldsFilled}/${fillResult.fieldsExtracted}`);
    logger.info(`   Cost: $${fillResult.cost.toFixed(4)}`);

    await browser.close();

    return {
      success: true,
      method: 'AI_AUTO',
      cost: fillResult.cost,
      screenshot: `data:image/png;base64,${screenshot}`,
      confirmationData: {
        fieldsExtracted: fillResult.fieldsExtracted,
        fieldsFilled: fillResult.fieldsFilled,
        aiCost: fillResult.cost,
        complexity: fillResult.complexity,
        learningRecorded: fillResult.learningRecorded
      }
    };

  } catch (error) {
    logger.error('❌ AI application error:', error);

    if (browser) {
      await browser.close();
    }

    return {
      success: false,
      error: error.message,
      method: 'AI_AUTO',
      cost: 0
    };
  }
}

// Create auto-apply queue
const autoApplyQueue = new Queue('auto-apply', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: false // Keep failed jobs for debugging
  }
});

/**
 * Process an auto-apply job
 * Concurrency limited to 2 to prevent OOM (each browser ~300MB RAM)
 */
autoApplyQueue.process(2, async (job) => {
  const { applicationId, jobUrl, atsType, userId } = job.data;

  logger.info({
    applicationId,
    jobUrl,
    atsType,
    userId
  }, 'Processing auto-apply job');

  try {
    // Update status to APPLYING
    await prisma.autoApplication.update({
      where: { id: applicationId },
      data: {
        status: 'APPLYING',
        startedAt: new Date()
      }
    });

    // Get user data from profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user || !user.profile) {
      throw new Error('User or profile not found');
    }

    // Check if user has required application data
    const applicationData = user.profile.data?.applicationData;

    if (!applicationData || !applicationData.personalInfo) {
      throw new Error('User profile missing application data. Please complete profile setup.');
    }

    // Apply using AI-first strategy
    logger.info(`Applying with strategy: ${APPLY_STRATEGY}`);

    let result;

    if (APPLY_STRATEGY === 'AI_FIRST' || APPLY_STRATEGY === 'AI_ONLY') {
      // Try AI-powered application first
      logger.info('🤖 Attempting AI-powered application...');
      result = await applyWithAI(jobUrl, user, job.data);

      // If AI fails and we're in AI_FIRST mode, fall back to recipes
      if (!result.success && APPLY_STRATEGY === 'AI_FIRST') {
        logger.warn('AI application failed, falling back to recipe engine...');
        result = await recipeEngine.applyToJob(
          jobUrl,
          atsType,
          user.profile.data
        );
      }
    } else {
      // RECIPE_ONLY mode
      logger.info('📜 Using recipe engine...');
      result = await recipeEngine.applyToJob(
        jobUrl,
        atsType,
        user.profile.data
      );
    }

    if (result.success) {
      // Application submitted successfully
      await prisma.autoApplication.update({
        where: { id: applicationId },
        data: {
          status: 'SUBMITTED',
          method: result.method || 'AI_AUTO',
          submittedAt: new Date(),
          completedAt: new Date(),
          confirmationUrl: result.screenshot,
          confirmationId: result.confirmationId,
          confirmationData: result.confirmationData || {},
          cost: result.cost,
          retryCount: job.attemptsMade
        }
      });

      logger.info({
        applicationId,
        method: result.method,
        cost: result.cost
      }, '✅ Application submitted successfully');

      return {
        success: true,
        applicationId,
        cost: result.cost,
        method: result.method
      };

    } else {
      // Application failed
      const errorType = result.needsConfiguration ? 'CONFIGURATION_ERROR' :
                       result.needsInstall ? 'DEPENDENCY_ERROR' :
                       result.needsRecording ? 'NO_RECIPE' :
                       'APPLICATION_ERROR';

      await prisma.autoApplication.update({
        where: { id: applicationId },
        data: {
          status: 'FAILED',
          error: result.error,
          errorType,
          completedAt: new Date(),
          cost: result.cost || 0,
          retryCount: job.attemptsMade
        }
      });

      logger.error({
        applicationId,
        error: result.error,
        errorType
      }, '❌ Application failed');

      throw new Error(result.error || 'Application failed');
    }

  } catch (error) {
    // Update application with error
    await prisma.autoApplication.update({
      where: { id: applicationId },
      data: {
        status: 'FAILED',
        error: error.message,
        errorType: 'PROCESSING_ERROR',
        completedAt: new Date(),
        retryCount: job.attemptsMade
      }
    }).catch(err => {
      logger.error({ error: err.message }, 'Failed to update application status');
    });

    logger.error({
      applicationId,
      error: error.message,
      stack: error.stack
    }, '❌ Job processing failed');

    throw error;
  }
});

/**
 * Queue event listeners
 */
autoApplyQueue.on('completed', (job, result) => {
  logger.info({
    jobId: job.id,
    applicationId: job.data.applicationId,
    cost: result.cost
  }, 'Auto-apply job completed');
});

autoApplyQueue.on('failed', (job, error) => {
  logger.error({
    jobId: job.id,
    applicationId: job.data.applicationId,
    error: error.message,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts
  }, 'Auto-apply job failed');
});

autoApplyQueue.on('stalled', (job) => {
  logger.warn({
    jobId: job.id,
    applicationId: job.data.applicationId
  }, 'Auto-apply job stalled');
});

/**
 * Add a job to the queue
 */
export async function queueAutoApply({ applicationId, jobUrl, atsType, userId }) {
  logger.info({
    applicationId,
    jobUrl,
    atsType,
    userId
  }, 'Queueing auto-apply job');

  const job = await autoApplyQueue.add({
    applicationId,
    jobUrl,
    atsType,
    userId
  }, {
    jobId: `auto-apply-${applicationId}`, // Unique job ID
    attempts: 3
  });

  logger.info({ jobId: job.id, applicationId }, 'Auto-apply job queued');

  return job;
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    autoApplyQueue.getWaitingCount(),
    autoApplyQueue.getActiveCount(),
    autoApplyQueue.getCompletedCount(),
    autoApplyQueue.getFailedCount(),
    autoApplyQueue.getDelayedCount()
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed
  };
}

/**
 * Get job status
 */
export async function getJobStatus(jobId) {
  const job = await autoApplyQueue.getJob(jobId);

  if (!job) {
    return { status: 'NOT_FOUND' };
  }

  const state = await job.getState();
  const progress = job.progress();

  return {
    id: job.id,
    state,
    progress,
    attemptsMade: job.attemptsMade,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
    failedReason: job.failedReason,
    returnvalue: job.returnvalue
  };
}

/**
 * Clean up old completed/failed jobs
 */
export async function cleanQueue() {
  const grace = 24 * 60 * 60 * 1000; // 24 hours

  await autoApplyQueue.clean(grace, 'completed');
  await autoApplyQueue.clean(grace, 'failed');

  logger.info('Queue cleaned');
}

export async function checkAutoApplyQueueConnection() {
  // Wait for queue to be ready
  await new Promise((resolve) => {
    if (autoApplyQueue.isReady()) {
      resolve();
    } else {
      autoApplyQueue.on('ready', resolve);
    }
  });
  
  const client = await autoApplyQueue.client;
  await client.ping();
}

export default autoApplyQueue;
