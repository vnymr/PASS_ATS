/**
 * Jobs API Routes
 *
 * Endpoints for browsing aggregated jobs and triggering job sync.
 */

import express from 'express';
import { prisma } from '../lib/prisma-client.js';
import jobSyncService from '../lib/job-sync-service.js';
import jobRecommendationEngine from '../lib/job-recommendation-engine.js';
import jobProfileMatcher from '../lib/job-profile-matcher.js';
import logger from '../lib/logger.js';
import cacheManager from '../lib/cache-manager.js';

const router = express.Router();

function respondWithJobsError(res, error, fallbackMessage) {
  if (error?.code === 'P2021') {
    return res.status(500).json({
      error: 'Job data is unavailable. Run the latest database migrations to create the required tables.',
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

/**
 * GET /api/jobs
 * Get all jobs with filtering
 * Optionally uses personalized recommendations if ?personalized=true
 */
router.get('/jobs', async (req, res) => {
  try {
    const {
      filter = 'all',          // 'all', 'ai_applyable', 'manual'
      atsType,                  // Filter by specific ATS
      company,                  // Filter by company
      source,                   // Filter by source (greenhouse, lever, etc.)
      search,                   // Search in title/description
      personalized = 'false',   // Use personalized recommendations
      limit = '50',
      offset = '0'
    } = req.query;

    // Check if personalized recommendations requested
    if (personalized === 'true' && req.userId) {
      // Create cache key from parameters
      const cacheKey = `${filter}-${atsType || 'all'}-${company || 'all'}-${source || 'all'}-${search || 'all'}-${limit}-${offset}`;

      // Try cache first
      const cached = await cacheManager.getRecommendations(req.userId, cacheKey);
      if (cached) {
        logger.debug({ userId: req.userId, cacheKey }, 'Recommendations loaded from cache');
        // Allow short-term browser caching (60 seconds)
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.json({
          ...cached,
          fromCache: true
        });
      }

      // Use recommendation engine
      const result = await jobRecommendationEngine.getRecommendations(req.userId, {
        filter,
        atsType,
        company,
        source,
        search,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Cache the result
      const response = {
        jobs: result.jobs,
        total: result.total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: result.hasMore,
        personalized: true
      };
      await cacheManager.setRecommendations(req.userId, cacheKey, response);

      // Allow short-term browser caching (60 seconds)
      res.setHeader('Cache-Control', 'public, max-age=60');

      return res.json(response);
    }

    // Otherwise, use default (chronological) listing
    const where = { isActive: true };

    // Apply filters
    if (filter === 'ai_applyable') {
      where.aiApplyable = true;
    } else if (filter === 'manual') {
      where.aiApplyable = false;
    }

    if (atsType) {
      where.atsType = atsType;
    }

    if (company) {
      where.company = {
        contains: company,
        mode: 'insensitive'
      };
    }

    if (source) {
      where.source = source;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Create cache key from parameters
    const cacheKey = `${filter}-${atsType || 'all'}-${company || 'all'}-${source || 'all'}-${search || 'all'}-${limit}-${offset}`;

    // Try cache first
    const cached = await cacheManager.getJobList(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, 'Job list loaded from cache');
      // Allow short-term browser caching (60 seconds)
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.json({
        ...cached,
        fromCache: true
      });
    }

    // Get jobs with pagination
    const [jobs, total] = await Promise.all([
      prisma.aggregatedJob.findMany({
        where,
        orderBy: { postedDate: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          salary: true,
          description: true,
          requirements: true,
          applyUrl: true,
          atsType: true,
          atsComplexity: true,
          aiApplyable: true,
          postedDate: true,
          source: true,
          // Include extracted metadata
          extractedSkills: true,
          extractedExperience: true,
          extractedEducation: true,
          extractedJobLevel: true,
          extractedKeywords: true,
          extractedBenefits: true,
          extractionConfidence: true,
          _count: {
            select: { applications: true }
          }
        }
      }),
      prisma.aggregatedJob.count({ where })
    ]);

    // Cache the result
    const response = {
      jobs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: total > (parseInt(offset) + parseInt(limit)),
      personalized: false
    };
    await cacheManager.setJobList(cacheKey, response);

    // Allow short-term browser caching (60 seconds)
    res.setHeader('Cache-Control', 'public, max-age=60');

    res.json(response);

  } catch (error) {
    logger.error({ error: error.message, code: error.code }, 'Failed to fetch jobs');
    return respondWithJobsError(res, error, 'Failed to fetch jobs');
  }
});

/**
 * GET /api/jobs/:id
 * Get a specific job by ID
 */
router.get('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const job = await prisma.aggregatedJob.findUnique({
      where: { id },
      include: {
        applications: {
          select: {
            id: true,
            status: true,
            submittedAt: true,
            userId: true
          }
        }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ job });

  } catch (error) {
    logger.error({ error: error.message, code: error.code, jobId: req.params.id }, 'Failed to fetch job');
    return respondWithJobsError(res, error, 'Failed to fetch job');
  }
});

/**
 * GET /api/jobs/stats
 * Get job statistics
 */
router.get('/jobs/stats', async (req, res) => {
  try {
    const stats = await jobSyncService.getJobCounts();
    const syncStats = jobSyncService.getStats();

    res.json({
      jobs: stats,
      sync: syncStats
    });

  } catch (error) {
    logger.error({ error: error.message, code: error.code }, 'Failed to fetch stats');
    return respondWithJobsError(res, error, 'Failed to fetch stats');
  }
});

/**
 * POST /api/jobs/sync
 * Manually trigger job sync
 */
router.post('/jobs/sync', async (req, res) => {
  try {
    logger.info('Manual job sync triggered via API');

    // Start sync in background
    jobSyncService.syncNow(req.body).then(result => {
      logger.info({ result }, 'Job sync completed');
    }).catch(error => {
      logger.error({ error: error.message }, 'Job sync failed');
    });

    res.json({
      success: true,
      message: 'Job sync started in background'
    });

  } catch (error) {
    logger.error({ error: error.message, code: error.code }, 'Failed to trigger sync');
    return respondWithJobsError(res, error, 'Failed to trigger sync');
  }
});

/**
 * GET /api/jobs/recommendations
 * Get personalized job recommendations for the authenticated user
 */
router.get('/jobs/recommendations', async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required for personalized recommendations' });
    }

    const {
      filter = 'all',
      limit = '50',
      offset = '0',
      includeScores = 'false'  // Debug flag to see recommendation scores
    } = req.query;

    const result = await jobRecommendationEngine.getRecommendations(req.userId, {
      filter,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Optionally include score breakdowns for debugging
    if (includeScores === 'true') {
      res.json({
        jobs: result.jobs,
        total: result.total,
        hasMore: result.hasMore
      });
    } else {
      // Remove score data for cleaner response
      const cleanedJobs = result.jobs.map(job => {
        const { scoreBreakdown, ...cleanJob } = job;
        return cleanJob;
      });

      res.json({
        jobs: cleanedJobs,
        total: result.total,
        hasMore: result.hasMore
      });
    }

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId }, 'Failed to get recommendations');
    return respondWithJobsError(res, error, 'Failed to get recommendations');
  }
});

/**
 * POST /api/jobs/discover
 * Manually trigger company discovery (finds new companies automatically)
 */
router.post('/jobs/discover', async (req, res) => {
  try {
    logger.info('Manual company discovery triggered via API');

    // Start discovery in background
    jobSyncService.discoverNewCompanies().then(result => {
      logger.info({ result }, 'Company discovery completed');
    }).catch(error => {
      logger.error({ error: error.message }, 'Company discovery failed');
    });

    res.json({
      success: true,
      message: 'Company discovery started in background. This will find hundreds of new companies!'
    });

  } catch (error) {
    logger.error({ error: error.message, code: error.code }, 'Failed to trigger discovery');
    return respondWithJobsError(res, error, 'Failed to trigger discovery');
  }
});

/**
 * GET /api/jobs/:id/match-analysis
 * Get detailed match analysis between user profile and specific job
 */
router.get('/jobs/:id/match-analysis', async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required for match analysis' });
    }

    const { id: jobId } = req.params;

    logger.info({ userId: req.userId, jobId }, 'Analyzing job-profile match');

    const analysis = await jobProfileMatcher.analyzeMatch(req.userId, jobId);

    if (analysis.error) {
      return res.status(400).json(analysis);
    }

    res.json({
      success: true,
      analysis
    });

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId, jobId: req.params.id }, 'Failed to analyze match');
    return respondWithJobsError(res, error, 'Failed to analyze job match');
  }
});

export default router;
