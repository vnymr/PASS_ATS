/**
 * Auto-Apply API Routes
 *
 * Endpoints for auto-applying to jobs and tracking applications.
 */

import express from 'express';
import { prisma } from '../lib/prisma-client.js';
import logger from '../lib/logger.js';
import { queueAutoApply, getQueueStats, getJobStatus, isQueueAvailable } from '../lib/auto-apply-queue.js';
import { rateLimitMiddleware } from '../lib/rate-limiter.js';
import { validateJobUrl } from '../lib/url-validator.js';
import { processAutoApplyDirect } from '../lib/direct-auto-apply.js';

const router = express.Router();

// Rate limiter for auto-apply endpoints to prevent abuse
// Limits both AI usage costs and CAPTCHA credit depletion
const autoApplyLimiter = rateLimitMiddleware();

// Daily application limit per user
const DAILY_APPLICATION_LIMIT = 10;

/**
 * Check if user has exceeded daily application limit
 * Returns { allowed: boolean, remaining: number, resetAt: Date }
 */
async function checkDailyApplicationLimit(userId) {
  // Get start of today (midnight UTC)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Get end of today (for reset time)
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  // Count applications submitted today
  const applicationsToday = await prisma.autoApplication.count({
    where: {
      userId,
      createdAt: {
        gte: today
      },
      // Don't count cancelled applications against the limit
      status: {
        not: 'CANCELLED'
      }
    }
  });

  const remaining = Math.max(0, DAILY_APPLICATION_LIMIT - applicationsToday);
  const allowed = applicationsToday < DAILY_APPLICATION_LIMIT;

  return {
    allowed,
    remaining,
    used: applicationsToday,
    limit: DAILY_APPLICATION_LIMIT,
    resetAt: tomorrow
  };
}

function respondWithAutoApplyError(res, error, fallbackMessage) {
  if (error?.code === 'P2021') {
    return res.status(500).json({
      error: 'Auto-apply data is unavailable. Run the latest database migrations to create the required tables.',
      code: 'SCHEMA_MISSING'
    });
  }

  const payload = {
    error: fallbackMessage
  };

  if (error?.code) {
    payload.code = error.code;
  }

  if (process.env.NODE_ENV !== 'production') {
    payload.details = error.message;
  }

  return res.status(500).json(payload);
}

// Note: Authentication is handled at the router level in server.js
// All routes in this file assume req.userId is set by authenticateToken middleware

/**
 * POST /api/auto-apply
 * Submit auto-apply for a job
 *
 * Rate limited to prevent:
 * - Excessive AI API costs
 * - CAPTCHA credit depletion
 * - System abuse
 */
router.post('/auto-apply', autoApplyLimiter, async (req, res) => {
  try {
    const { jobId } = req.body;
    const userId = req.userId;

    logger.info({ userId, jobId }, 'Auto-apply requested');

    // Check daily application limit (10 per user per day)
    const dailyLimit = await checkDailyApplicationLimit(userId);

    if (!dailyLimit.allowed) {
      logger.warn({
        userId,
        used: dailyLimit.used,
        limit: dailyLimit.limit,
        resetAt: dailyLimit.resetAt
      }, 'Daily auto-apply limit exceeded');

      return res.status(429).json({
        error: 'Daily application limit reached',
        message: `You have reached your daily limit of ${dailyLimit.limit} auto-applications. This helps ensure quality applications and prevents system abuse.`,
        limit: dailyLimit.limit,
        used: dailyLimit.used,
        remaining: 0,
        resetAt: dailyLimit.resetAt.toISOString(),
        suggestion: 'Your limit resets at midnight UTC. You can still apply manually to jobs.'
      });
    }

    // Validate job exists and is AI-applyable
    const job = await prisma.aggregatedJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Validate job URL for security
    const urlValidation = validateJobUrl(job.applyUrl);
    if (!urlValidation.valid) {
      logger.warn({
        userId,
        jobId,
        url: job.applyUrl,
        error: urlValidation.error
      }, 'Job URL validation failed');

      return res.status(400).json({
        error: 'Invalid or untrusted job URL',
        reason: urlValidation.error,
        domain: urlValidation.domain
      });
    }

    if (!job.aiApplyable) {
      return res.status(400).json({
        error: 'This job cannot be auto-applied',
        reason: `ATS platform ${job.atsType} is ${job.atsComplexity} - requires manual application`,
        applyUrl: job.applyUrl
      });
    }

    if (!job.isActive) {
      return res.status(400).json({
        error: 'This job is no longer active',
        suggestion: 'Try searching for similar jobs'
      });
    }

    // Check if user has profile data with applicationData
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user.profile) {
      return res.status(400).json({
        error: 'Profile not found',
        message: 'Please complete your profile first',
        setupUrl: '/setup/profile'
      });
    }

    const profileData = user.profile.data;

    // Transform profile data to applicationData format if needed (backwards compatibility)
    let applicationData = profileData.applicationData;

    if (!applicationData) {
      // Check if we have the old profile structure
      if (profileData.name || profileData.email || profileData.experiences) {
        // Transform old structure to new applicationData format
        applicationData = {
          personalInfo: {
            fullName: profileData.name || `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim(),
            email: profileData.email || user.email,
            phone: profileData.phone || '',
            location: profileData.location || '',
            linkedin: profileData.linkedin || '',
            website: profileData.website || ''
          },
          experience: profileData.experiences || [],
          education: profileData.education || [],
          skills: profileData.skills || []
        };

        logger.info({ userId: user.id }, 'Transformed legacy profile structure to applicationData format');
      } else {
        // No profile data at all
        return res.status(400).json({
          error: 'Application data not configured',
          message: 'Please complete your profile first',
          setupUrl: '/profile'
        });
      }
    }

    // Validate essential fields
    if (!applicationData.personalInfo || !applicationData.personalInfo.fullName || !applicationData.personalInfo.email) {
      return res.status(400).json({
        error: 'Incomplete application data',
        message: 'Please add your name and email to your profile',
        setupUrl: '/profile'
      });
    }

    // Check if user already applied to this job
    const existingApplication = await prisma.autoApplication.findUnique({
      where: {
        userId_jobId: {
          userId,
          jobId
        }
      }
    });

    if (existingApplication) {
      return res.status(400).json({
        error: 'Already applied',
        message: 'You have already applied to this job',
        application: {
          id: existingApplication.id,
          status: existingApplication.status,
          submittedAt: existingApplication.submittedAt
        }
      });
    }

    // Create application record
    const application = await prisma.autoApplication.create({
      data: {
        userId,
        jobId,
        status: 'QUEUED',
        method: 'AI_AUTO'
      }
    });

    logger.info({ applicationId: application.id }, 'Auto-application created');

    // Check if Redis queue is available
    const queueAvailable = isQueueAvailable();

    if (queueAvailable) {
      // Queue for processing with recipe engine
      await queueAutoApply({
        applicationId: application.id,
        jobUrl: job.applyUrl,
        atsType: job.atsType,
        userId
      });

      res.json({
        success: true,
        applicationId: application.id,
        status: 'QUEUED',
        message: 'Application queued - will be submitted automatically',
        estimatedTime: '2-5 minutes',
        estimatedCost: 0.05,
        dailyLimit: {
          remaining: dailyLimit.remaining - 1,
          limit: dailyLimit.limit,
          resetAt: dailyLimit.resetAt.toISOString()
        }
      });
    } else {
      // Direct mode - process immediately using Railway Python browser
      logger.info({ applicationId: application.id }, 'Redis queue unavailable, using direct mode');

      // Respond immediately, process in background
      res.json({
        success: true,
        applicationId: application.id,
        status: 'PROCESSING',
        message: 'Application is being processed directly (no queue)',
        estimatedTime: '1-3 minutes',
        dailyLimit: {
          remaining: dailyLimit.remaining - 1,
          limit: dailyLimit.limit,
          resetAt: dailyLimit.resetAt.toISOString()
        }
      });

      // Process in background (don't await)
      processAutoApplyDirect({
        applicationId: application.id,
        jobUrl: job.applyUrl,
        atsType: job.atsType,
        userId,
        user
      }).catch(error => {
        logger.error({ applicationId: application.id, error: error.message }, 'Direct auto-apply failed');
      });
    }

  } catch (error) {
    logger.error({ error: error.message, code: error.code }, 'Auto-apply failed');
    return respondWithAutoApplyError(res, error, 'Failed to queue application');
  }
});

/**
 * GET /api/my-applications
 * Get current user's applications
 */
router.get('/my-applications', async (req, res) => {
  try {
    const userId = req.userId;
    const { status, limit = '50', offset = '0' } = req.query;

    const where = { userId };

    if (status) {
      where.status = status;
    }

    const [applications, total] = await Promise.all([
      prisma.autoApplication.findMany({
        where,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              company: true,
              location: true,
              applyUrl: true,
              atsType: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.autoApplication.count({ where })
    ]);

    // Get status counts
    const statusCounts = await prisma.autoApplication.groupBy({
      by: ['status'],
      where: { userId },
      _count: true
    });

    res.json({
      applications,
      total,
      statusCounts: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {}),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error({ error: error.message, code: error.code }, 'Failed to fetch applications');
    return respondWithAutoApplyError(res, error, 'Failed to fetch applications');
  }
});

/**
 * GET /api/applications/:id
 * Get specific application details
 */
router.get('/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const application = await prisma.autoApplication.findFirst({
      where: {
        id,
        userId // Ensure user owns this application
      },
      include: {
        job: true
      }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ application });

  } catch (error) {
    logger.error({ error: error.message, code: error.code }, 'Failed to fetch application');
    return respondWithAutoApplyError(res, error, 'Failed to fetch application');
  }
});

/**
 * DELETE /api/applications/:id
 * Cancel a queued application
 */
router.delete('/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const application = await prisma.autoApplication.findFirst({
      where: { id, userId }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Only allow cancellation if still queued
    if (application.status !== 'QUEUED') {
      return res.status(400).json({
        error: 'Cannot cancel application',
        reason: `Application is already ${application.status}`
      });
    }

    // Update status to cancelled
    await prisma.autoApplication.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date()
      }
    });

    logger.info({ applicationId: id }, 'Application cancelled by user');

    res.json({
      success: true,
      message: 'Application cancelled'
    });

  } catch (error) {
    logger.error({ error: error.message, code: error.code }, 'Failed to cancel application');
    return respondWithAutoApplyError(res, error, 'Failed to cancel application');
  }
});

/**
 * GET /api/auto-apply/stats
 * Get user's auto-apply statistics
 */
router.get('/auto-apply/stats', async (req, res) => {
  try {
    const userId = req.userId;

    const [total, submitted, failed, manualRequired, totalCost, dailyLimit] = await Promise.all([
      prisma.autoApplication.count({ where: { userId } }),
      prisma.autoApplication.count({ where: { userId, status: 'SUBMITTED' } }),
      prisma.autoApplication.count({ where: { userId, status: 'FAILED' } }),
      prisma.autoApplication.count({ where: { userId, status: 'MANUAL_REQUIRED' } }),
      prisma.autoApplication.aggregate({
        where: { userId },
        _sum: { cost: true }
      }),
      checkDailyApplicationLimit(userId)
    ]);

    // Get applications this week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = await prisma.autoApplication.count({
      where: {
        userId,
        createdAt: { gte: oneWeekAgo }
      }
    });

    res.json({
      total,
      submitted,
      failed,
      manualRequired,
      pending: total - submitted - failed - manualRequired,
      thisWeek,
      totalCost: totalCost._sum.cost || 0,
      averageCost: total > 0 ? (totalCost._sum.cost || 0) / total : 0,
      dailyLimit: {
        used: dailyLimit.used,
        remaining: dailyLimit.remaining,
        limit: dailyLimit.limit,
        resetAt: dailyLimit.resetAt.toISOString()
      }
    });

  } catch (error) {
    logger.error({ error: error.message, code: error.code }, 'Failed to fetch stats');
    return respondWithAutoApplyError(res, error, 'Failed to fetch stats');
  }
});

/**
 * GET /api/auto-apply/daily-limit
 * Check user's daily application limit status
 */
router.get('/auto-apply/daily-limit', async (req, res) => {
  try {
    const userId = req.userId;
    const dailyLimit = await checkDailyApplicationLimit(userId);

    res.json({
      allowed: dailyLimit.allowed,
      used: dailyLimit.used,
      remaining: dailyLimit.remaining,
      limit: dailyLimit.limit,
      resetAt: dailyLimit.resetAt.toISOString()
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to check daily limit');
    return res.status(500).json({ error: 'Failed to check daily limit' });
  }
});

export default router;
