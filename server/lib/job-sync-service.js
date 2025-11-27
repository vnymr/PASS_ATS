/**
 * Job Sync Service - V4 with Google Discovery
 *
 * Uses 100% FREE sources with AUTOMATIC company discovery:
 * - SimplifyJobs GitHub (daily updates, 1000+ jobs)
 * - Hacker News Who's Hiring (monthly, 500+ jobs)
 * - RSS Feeds (real-time, unlimited)
 * - Greenhouse API (direct, free, unlimited)
 * - Lever API (direct, free, unlimited)
 * - Ashby API (direct, free, startups)
 * - Workable API (direct, free, mid-market)
 *
 * NEW: Google Discovery (every 6 hours)
 * - Searches Google for new company job boards
 * - Automatically discovers companies using ATS platforms
 *
 * FRESHNESS: Only jobs posted in last 72 hours
 * TOTAL COST: $0/month
 */

import smartAggregator from './job-sources/smart-aggregator.js';
import freeAutoDiscovery from './job-sources/free-auto-discovery.js';
import aggressiveDiscovery from './job-sources/aggressive-discovery.js';
import googleDiscovery from './job-sources/google-company-discovery.js';
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
   * - Job sync: Runs every 6 hours (fetch fresh 72-hour jobs)
   * - Company discovery: Runs every 6 hours (find new companies via Google)
   */
  start(syncSchedule = '0 */6 * * *', discoverySchedule = '30 */6 * * *') {
    if (this.syncCronJob) {
      logger.warn('Job sync cron already running');
      return;
    }

    // Job sync cron (every 6 hours)
    this.syncCronJob = cron.schedule(syncSchedule, () => {
      this.syncJobs({ freshOnly: true });
    });

    // Company discovery cron (every 6 hours, offset by 30 minutes)
    this.discoveryCronJob = cron.schedule(discoverySchedule, () => {
      this.discoverNewCompanies();
    });

    logger.info(`✅ Job sync cron started (schedule: ${syncSchedule})`);
    logger.info(`   Running every 6 hours to fetch fresh 72-hour jobs`);
    logger.info(`✅ Company discovery cron started (schedule: ${discoverySchedule})`);
    logger.info(`   Running every 6 hours to discover new companies via Google!`);
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
   * Runs every 6 hours to find new companies via Google search
   */
  async discoverNewCompanies(options = {}) {
    if (this.isDiscovering) {
      logger.warn('Company discovery already in progress, skipping');
      return { skipped: true };
    }

    this.isDiscovering = true;
    const startTime = Date.now();

    try {
      logger.info('🔍 Starting company discovery (Google + API exploration)...');

      let result;

      // Try Google discovery first (if browser available)
      try {
        result = await googleDiscovery.discoverNewCompanies({
          atsTypes: ['greenhouse', 'ashby', 'lever'],
          keywords: ['software engineer', 'frontend developer', 'backend developer'],
          maxCompaniesPerATS: 50
        });
      } catch (browserError) {
        logger.warn(`Google discovery failed (${browserError.message}), falling back to API exploration`);

        // Fallback to API exploration (no browser needed)
        result = await googleDiscovery.discoverViaAPIExploration({
          atsTypes: ['greenhouse', 'ashby', 'lever', 'workable']
        });
      }

      // Also run aggressive discovery for additional sources
      try {
        const aggressiveResult = await aggressiveDiscovery.runFullDiscovery();
        logger.info(`   Aggressive discovery found ${aggressiveResult.companies?.length || 0} additional companies`);
      } catch (error) {
        logger.warn(`Aggressive discovery failed: ${error.message}`);
      }

      const duration = Date.now() - startTime;

      // Update stats
      this.stats.companiesDiscovered = result.summary?.total || 0;
      this.lastDiscovery = new Date();

      // Get total companies in database
      const totalCompanies = await prisma.discoveredCompany.count({
        where: { isActive: true }
      });
      this.stats.totalCompanies = totalCompanies;

      logger.info('✅ Company discovery completed');
      logger.info(`  - New companies found: ${result.summary?.total || 0}`);
      logger.info(`  - Total companies in DB: ${totalCompanies}`);
      logger.info(`  - Duration: ${(duration / 1000).toFixed(1)}s`);

      return {
        success: true,
        discovered: result.summary?.total || 0,
        totalCompanies: totalCompanies,
        duration,
        breakdown: result.summary
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

      // Fetch from smart aggregator (Greenhouse, Lever, Ashby, Workable)
      // Now with 72-hour freshness filter!
      const atsResult = await smartAggregator.aggregateAll({
        // Force discovery on first run or if requested
        forceDiscovery: this.stats.totalSynced === 0 || options.forceDiscovery,

        // Freshness filter (default: true = only last 72 hours)
        freshOnly: options.freshOnly !== false,

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

      logger.info(`📊 Fetched ${result.jobs.length} fresh jobs from all sources`);
      logger.info(`  - SimplifyJobs: ${result.stats.simplify || 0}`);
      logger.info(`  - Hacker News: ${result.stats.hackernews || 0}`);
      logger.info(`  - RSS Feeds: ${result.stats.rss || 0}`);
      logger.info(`  - Y Combinator: ${result.stats.yc || 0}`);
      logger.info(`  - Greenhouse: ${result.stats.byATS?.GREENHOUSE || 0}`);
      logger.info(`  - Lever: ${result.stats.byATS?.LEVER || 0}`);
      logger.info(`  - Ashby: ${result.stats.byATS?.ASHBY || 0}`);
      logger.info(`  - Workable: ${result.stats.byATS?.WORKABLE || 0}`);
      logger.info(`  - AI-applyable: ${result.stats.aiApplyable || 0}`);

      // DEDUPLICATION: Remove duplicates from the batch
      const seenIds = new Set();
      const uniqueJobs = result.jobs.filter(job => {
        if (!job.externalId) return false;
        if (seenIds.has(job.externalId)) return false;
        seenIds.add(job.externalId);
        return true;
      });

      const duplicatesInBatch = result.jobs.length - uniqueJobs.length;
      if (duplicatesInBatch > 0) {
        logger.info(`  - Filtered ${duplicatesInBatch} duplicates from batch`);
      }

      // Save to database using upsert for duplicate safety
      let saved = 0;
      let updated = 0;
      let skipped = 0;

      // Get existing job IDs for tracking new vs updated
      const existingJobs = await prisma.aggregatedJob.findMany({
        where: { externalId: { in: uniqueJobs.map(j => j.externalId) } },
        select: { externalId: true }
      });
      const existingIds = new Set(existingJobs.map(j => j.externalId));

      for (const job of uniqueJobs) {
        try {
          // Use upsert to handle duplicates gracefully
          await prisma.aggregatedJob.upsert({
            where: { externalId: job.externalId },
            update: {
              title: job.title,
              description: job.description,
              location: job.location,
              salary: job.salary,
              lastChecked: new Date(),
              isActive: true
            },
            create: {
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

          if (existingIds.has(job.externalId)) {
            updated++;
          } else {
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
      const companiesCount = (result.companies.greenhouse?.length || 0) +
                            (result.companies.lever?.length || 0) +
                            (result.companies.ashby?.length || 0) +
                            (result.companies.workable?.length || 0);
      this.stats = {
        totalSynced: saved + updated,
        lastRunDate: new Date(),
        lastRunDuration: duration,
        companiesDiscovered: companiesCount
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
