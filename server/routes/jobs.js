/**
 * Jobs API Routes
 *
 * Endpoints for browsing aggregated jobs and triggering job sync.
 */

import express from 'express';
import { prisma } from '../lib/prisma-client.js';
import jobSyncService from '../lib/job-sync-service.js';
import logger from '../lib/logger.js';

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
 */
router.get('/jobs', async (req, res) => {
  try {
    const {
      filter = 'all',          // 'all', 'ai_applyable', 'manual'
      atsType,                  // Filter by specific ATS
      company,                  // Filter by company
      source,                   // Filter by source (greenhouse, lever, etc.)
      search,                   // Search in title/description
      limit = '50',
      offset = '0'
    } = req.query;

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

    // Prevent caching issues
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      jobs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: total > (parseInt(offset) + parseInt(limit))
    });

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

export default router;
