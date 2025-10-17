/**
 * Job Sync Service - V2 with Smart Aggregator
 *
 * Uses self-learning company discovery to fetch jobs from:
 * - Greenhouse API (direct, free, unlimited)
 * - Lever API (direct, free, unlimited)
 * - Remotive API (remote jobs, free)
 * - JSearch API (optional discovery, free tier 1000/month)
 *
 * NO MORE ADZUNA - we fetch directly from ATS platforms!
 */

import smartAggregator from './job-sources/smart-aggregator.js';
import { prisma } from './prisma-client.js';
import logger from './logger.js';
import cron from 'node-cron';

class JobSyncService {
  constructor() {
    this.isRunning = false;
    this.lastSync = null;
    this.stats = {
      totalSynced: 0,
      lastRunDate: null,
      lastRunDuration: 0,
      companiesDiscovered: 0
    };

    // Initialize cron job (disabled by default - call start() to enable)
    this.cronJob = null;
  }

  /**
   * Start the cron job
   * Runs every 6 hours by default (to fetch fresh jobs)
   */
  start(schedule = '0 */6 * * *') {
    if (this.cronJob) {
      logger.warn('Job sync cron already running');
      return;
    }

    this.cronJob = cron.schedule(schedule, () => {
      this.syncJobs();
    });

    logger.info(`✅ Job sync cron started (schedule: ${schedule})`);
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Job sync cron stopped');
    }
  }

  /**
   * Sync jobs from all sources using smart aggregator
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Sync results
   */
  async syncJobs(options = {}) {
    if (this.isRunning) {
      logger.warn('Job sync already in progress, skipping');
      return { skipped: true };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('🔄 Starting smart job sync...');

      // Use smart aggregator to fetch jobs
      const result = await smartAggregator.aggregateAll({
        // Force discovery on first run or if requested
        forceDiscovery: this.stats.totalSynced === 0 || options.forceDiscovery,

        // JSearch discovery options (only if API key is set)
        jsearch: {
          keywords: options.keywords || '',  // Empty = ALL jobs
          pages: options.discoveryPages || 5  // 5 requests per sync (conservative)
        }
      });

      logger.info(`📊 Fetched ${result.jobs.length} jobs from APIs`);
      logger.info(`  - AI-applyable: ${result.stats.aiApplyable} (${result.stats.aiApplyablePercent}%)`);
      logger.info(`  - Greenhouse companies: ${result.companies.greenhouse.length}`);
      logger.info(`  - Lever companies: ${result.companies.lever.length}`);

      // Save to database
      let saved = 0;
      let updated = 0;
      let skipped = 0;

      for (const job of result.jobs) {
        try {
          const existing = await prisma.aggregatedJob.findUnique({
            where: { externalId: job.externalId }
          });

          if (existing) {
            // Update existing job
            await prisma.aggregatedJob.update({
              where: { externalId: job.externalId },
              data: {
                title: job.title,
                description: job.description,
                location: job.location,
                salary: job.salary,
                lastChecked: new Date(),
                isActive: true
              }
            });
            updated++;
          } else {
            // Create new job
            await prisma.aggregatedJob.create({
              data: {
                externalId: job.externalId,
                source: job.source,
                title: job.title,
                company: job.company,
                location: job.location,
                salary: job.salary,
                description: job.description,
                requirements: job.requirements || null,
                applyUrl: job.applyUrl,
                companyUrl: job.companyUrl || null,
                atsType: job.atsType,
                atsCompany: job.atsCompany || null,
                atsComplexity: job.atsComplexity,
                atsConfidence: job.atsConfidence,
                aiApplyable: job.aiApplyable,
                postedDate: job.postedDate
              }
            });
            saved++;
          }
        } catch (error) {
          logger.error({ error: error.message, jobId: job.externalId }, 'Failed to save job');
          skipped++;
        }
      }

      // Mark old jobs as inactive (not checked in last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const deactivated = await prisma.aggregatedJob.updateMany({
        where: {
          lastChecked: {
            lt: sevenDaysAgo
          },
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      const duration = Date.now() - startTime;

      // Update stats
      this.stats = {
        totalSynced: saved + updated,
        lastRunDate: new Date(),
        lastRunDuration: duration,
        companiesDiscovered: result.companies.greenhouse.length + result.companies.lever.length
      };

      logger.info('✅ Job sync completed successfully');
      logger.info(`  - New jobs: ${saved}`);
      logger.info(`  - Updated jobs: ${updated}`);
      logger.info(`  - Skipped: ${skipped}`);
      logger.info(`  - Deactivated old jobs: ${deactivated.count}`);
      logger.info(`  - Duration: ${(duration / 1000).toFixed(1)}s`);
      logger.info(`  - Companies tracked: ${this.stats.companiesDiscovered}`);

      return {
        success: true,
        saved,
        updated,
        skipped,
        deactivated: deactivated.count,
        duration,
        stats: result.stats,
        companies: this.stats.companiesDiscovered
      };

    } catch (error) {
      logger.error({ error: error.message }, 'Job sync failed');
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isRunning = false;
      this.lastSync = new Date();
    }
  }

  /**
   * Manually trigger job sync
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Sync results
   */
  async syncNow(options = {}) {
    logger.info('Manual job sync triggered');
    return await this.syncJobs(options);
  }

  /**
   * Get sync statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      lastSync: this.lastSync,
      cronEnabled: this.cronJob !== null
    };
  }

  /**
   * Get job counts from database
   * @returns {Promise<Object>} Job counts
   */
  async getJobCounts() {
    const [total, active, aiApplyable, byATS] = await Promise.all([
      prisma.aggregatedJob.count(),
      prisma.aggregatedJob.count({ where: { isActive: true } }),
      prisma.aggregatedJob.count({ where: { aiApplyable: true, isActive: true } }),
      prisma.aggregatedJob.groupBy({
        by: ['atsType'],
        where: { isActive: true },
        _count: true
      })
    ]);

    return {
      total,
      active,
      aiApplyable,
      manual: active - aiApplyable,
      byATS: byATS.reduce((acc, item) => {
        acc[item.atsType] = item._count;
        return acc;
      }, {})
    };
  }
}

// Export singleton instance
export default new JobSyncService();
