/**
 * Diagnostic endpoint to check extraction status
 */

import express from 'express';
import { prisma } from '../lib/prisma-client.js';
import { extractJobMetadata } from '../lib/job-metadata-extractor.js';
import logger from '../lib/logger.js';

const router = express.Router();

/**
 * GET /api/diagnostics/extraction-status
 * Check if extraction fields exist and are being populated
 */
router.get('/diagnostics/extraction-status', async (req, res) => {
  try {
    // Try to query extraction fields
    const sampleJobs = await prisma.aggregatedJob.findMany({
      where: { isActive: true },
      take: 5,
      select: {
        id: true,
        title: true,
        company: true,
        extractedSkills: true,
        extractedExperience: true,
        extractedJobLevel: true,
        lastExtractedAt: true
      },
      orderBy: { postedDate: 'desc' }
    });

    // Count extraction stats
    const stats = await prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE "lastExtractedAt" IS NOT NULL) as extracted,
        COUNT(*) FILTER (WHERE "lastExtractedAt" IS NULL) as not_extracted,
        COUNT(*) as total
      FROM "AggregatedJob"
      WHERE "isActive" = true
    `;

    res.json({
      success: true,
      fieldsExist: true,
      stats: stats[0],
      sampleJobs: sampleJobs.map(j => ({
        id: j.id,
        title: j.title,
        company: j.company,
        hasSkills: (j.extractedSkills?.length || 0) > 0,
        hasExperience: !!j.extractedExperience,
        lastExtracted: j.lastExtractedAt
      }))
    });

  } catch (error) {
    if (error.code === 'P2021' || error.message.includes('column')) {
      return res.json({
        success: false,
        fieldsExist: false,
        message: 'Extraction fields do not exist in database. Migration not applied yet.',
        migrationNeeded: true
      });
    }

    logger.error({ error: error.message }, 'Diagnostics failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/diagnostics/extract-job/:jobId
 * Manually trigger extraction for a specific job (for testing)
 */
router.post('/diagnostics/extract-job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    // Get job
    const job = await prisma.aggregatedJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        company: true,
        description: true,
        requirements: true
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    logger.info(`🤖 Manual extraction triggered for: ${job.title} at ${job.company}`);

    // Extract metadata
    const metadata = await extractJobMetadata(
      job.title,
      job.description,
      job.requirements
    );

    logger.info('✅ Extraction complete', metadata);

    // Update job
    await prisma.aggregatedJob.update({
      where: { id: jobId },
      data: metadata
    });

    res.json({
      success: true,
      jobId,
      title: job.title,
      company: job.company,
      extracted: metadata
    });

  } catch (error) {
    if (error.code === 'P2021' || error.message.includes('column')) {
      return res.status(400).json({
        success: false,
        error: 'Extraction fields do not exist. Run migration first.',
        migrationNeeded: true
      });
    }

    logger.error({ error: error.message }, 'Manual extraction failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/diagnostics/extract-all
 * Trigger extraction for all jobs without extraction (admin only, use with caution)
 */
router.post('/diagnostics/extract-all', async (req, res) => {
  try {
    const { limit = 10 } = req.body;

    // Get jobs without extraction
    const jobs = await prisma.aggregatedJob.findMany({
      where: {
        isActive: true,
        lastExtractedAt: null
      },
      take: parseInt(limit),
      select: {
        id: true,
        title: true,
        company: true,
        description: true,
        requirements: true
      }
    });

    logger.info(`🚀 Batch extraction started for ${jobs.length} jobs`);

    const results = [];

    for (const job of jobs) {
      try {
        logger.info(`🤖 Extracting: ${job.title} at ${job.company}`);

        const metadata = await extractJobMetadata(
          job.title,
          job.description,
          job.requirements
        );

        await prisma.aggregatedJob.update({
          where: { id: job.id },
          data: metadata
        });

        results.push({
          jobId: job.id,
          title: job.title,
          success: true,
          extracted: metadata
        });

        logger.info(`✅ Extracted: ${job.title}`);

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        logger.error(`❌ Failed to extract ${job.title}: ${error.message}`);
        results.push({
          jobId: job.id,
          title: job.title,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      total: jobs.length,
      succeeded: successCount,
      failed: failCount,
      results
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Batch extraction failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
