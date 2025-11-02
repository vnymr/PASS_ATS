/**
 * Job Sync Service - V3 with FREE Auto-Discovery
 *
 * Uses 100% FREE sources with NO manual company lists:
 * - SimplifyJobs GitHub (daily updates, 1000+ jobs)
 * - Hacker News Who's Hiring (monthly, 500+ jobs)
 * - RSS Feeds (real-time, unlimited)
 * - Greenhouse API (direct, free, unlimited)
 * - Lever API (direct, free, unlimited)
 * - Remotive API (remote jobs, free)
 *
 * TOTAL COST: $0/month
 * AUTO-DISCOVERY: Yes (no manual company lists!)
 */

import smartAggregator from './job-sources/smart-aggregator.js';
import freeAutoDiscovery from './job-sources/free-auto-discovery.js';
import aggressiveDiscovery from './job-sources/aggressive-discovery.js';
import { prisma } from './prisma-client.js';
import logger from './logger.js';
import cron from 'node-cron';

class JobSyncService {
  constructor() {
    this.isRunning = false;
    this.isDiscovering = false;
    this.lastSync = null;
    this.lastDiscovery = null;
    this.stats = {
      totalSynced: 0,
      lastRunDate: null,
      lastRunDuration: 0,
      companiesDiscovered: 0,
      totalCompanies: 0
    };

    // Initialize cron jobs (disabled by default - call start() to enable)
    this.syncCronJob = null;
    this.discoveryCronJob = null;
  }

  /**
   * Start the cron jobs
   * - Job sync: Runs every day at midnight (fetch fresh jobs)
   * - Company discovery: Runs every 24 hours at 2 AM (find new companies)
   */
  start(syncSchedule = '0 0 * * *', discoverySchedule = '0 2 * * *') {
    if (this.syncCronJob) {
      logger.warn('Job sync cron already running');
      return;
    }

    // Job sync cron (daily at midnight)
    this.syncCronJob = cron.schedule(syncSchedule, () => {
      this.syncJobs();
    });

    // Company discovery cron (daily at 2 AM)
    this.discoveryCronJob = cron.schedule(discoverySchedule, () => {
      this.discoverNewCompanies();
    });

    logger.info(`✅ Job sync cron started (schedule: ${syncSchedule})`);
    logger.info(`   Running daily at midnight to fetch fresh jobs`);
    logger.info(`✅ Company discovery cron started (schedule: ${discoverySchedule})`);
    logger.info(`   Running DAILY at 2 AM to discover new companies automatically!`);
  }

  /**
   * Stop the cron jobs
   */
  stop() {
    if (this.syncCronJob) {
      this.syncCronJob.stop();
      this.syncCronJob = null;
      logger.info('Job sync cron stopped');
    }

    if (this.discoveryCronJob) {
      this.discoveryCronJob.stop();
      this.discoveryCronJob = null;
      logger.info('Company discovery cron stopped');
    }
  }

  /**
   * Discover new companies automatically
   * Runs weekly to find hundreds of new companies
   */
  async discoverNewCompanies() {
    if (this.isDiscovering) {
      logger.warn('Company discovery already in progress, skipping');
      return { skipped: true };
    }

    this.isDiscovering = true;
    const startTime = Date.now();

    try {
      logger.info('🔍 Starting company discovery...');

      // Run aggressive discovery
      const result = await aggressiveDiscovery.runFullDiscovery();

      const duration = Date.now() - startTime;

      // Update stats
      this.stats.companiesDiscovered = result.companies.length;
      this.lastDiscovery = new Date();

      // Get total companies in database
      const totalCompanies = await prisma.discoveredCompany.count({
        where: { isActive: true }
      });
      this.stats.totalCompanies = totalCompanies;

      logger.info('✅ Company discovery completed');
      logger.info(`  - New companies found: ${result.companies.length}`);
      logger.info(`  - Total companies in DB: ${totalCompanies}`);
      logger.info(`  - Duration: ${(duration / 1000).toFixed(1)}s`);

      return {
        success: true,
        discovered: result.companies.length,
        totalCompanies: totalCompanies,
        duration
      };

    } catch (error) {
      logger.error({ error: error.message }, 'Company discovery failed');
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isDiscovering = false;
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
      logger.info('🔄 Starting FREE auto-discovery job sync...');

      // Fetch from FREE auto-discovery sources (SimplifyJobs, HN, RSS)
      const freeResult = await freeAutoDiscovery.aggregateAll();

      // Fetch from smart aggregator (Greenhouse, Lever, Remotive)
      const atsResult = await smartAggregator.aggregateAll({
        // Force discovery on first run or if requested
        forceDiscovery: this.stats.totalSynced === 0 || options.forceDiscovery,

        // JSearch discovery options (only if API key is set)
        jsearch: {
          keywords: options.keywords || '',  // Empty = ALL jobs
          pages: options.discoveryPages || 5  // 5 requests per sync (conservative)
        }
      });

      // Combine results
      const result = {
        jobs: [...freeResult.jobs, ...atsResult.jobs],
        stats: {
          ...atsResult.stats,
          simplify: freeResult.stats.simplify,
          hackernews: freeResult.stats.hackernews,
          rss: freeResult.stats.rss,
          total: freeResult.jobs.length + atsResult.jobs.length
        },
        companies: atsResult.companies
      };

      logger.info(`📊 Fetched ${result.jobs.length} jobs from all sources`);
      logger.info(`  - SimplifyJobs: ${result.stats.simplify}`);
      logger.info(`  - Hacker News: ${result.stats.hackernews}`);
      logger.info(`  - RSS Feeds: ${result.stats.rss}`);
      logger.info(`  - Y Combinator: ${result.stats.yc}`);
      logger.info(`  - Greenhouse: ${result.stats.greenhouse || 0}`);
      logger.info(`  - Lever: ${result.stats.lever || 0}`);
      logger.info(`  - AI-applyable: ${result.stats.aiApplyable || 0}`);

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

      // Mark old jobs as inactive (older than 2 weeks)
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const deactivated = await prisma.aggregatedJob.updateMany({
        where: {
          lastChecked: {
            lt: twoWeeksAgo
          },
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      // Also delete jobs that have been inactive for over 2 weeks (cleanup)
      const deleted = await prisma.aggregatedJob.deleteMany({
        where: {
          isActive: false,
          updatedAt: {
            lt: twoWeeksAgo
          }
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
      logger.info(`  - Deactivated old jobs (>2 weeks): ${deactivated.count}`);
      logger.info(`  - Deleted inactive jobs: ${deleted.count}`);
      logger.info(`  - Duration: ${(duration / 1000).toFixed(1)}s`);
      logger.info(`  - Companies tracked: ${this.stats.companiesDiscovered}`);

      return {
        success: true,
        saved,
        updated,
        skipped,
        deactivated: deactivated.count,
        deleted: deleted.count,
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
      isDiscovering: this.isDiscovering,
      lastSync: this.lastSync,
      lastDiscovery: this.lastDiscovery,
      syncCronEnabled: this.syncCronJob !== null,
      discoveryCronEnabled: this.discoveryCronJob !== null
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
