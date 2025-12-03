/**
 * Smart Job Sync Service
 *
 * Intelligent job syncing with:
 * - Tiered frequency (active companies checked more often)
 * - Parallel discovery + fetching
 * - Job closure detection
 * - Priority-based company syncing
 *
 * Schedules:
 * - Every 1 hour: Check high-priority companies (post frequently)
 * - Every 3 hours: Check medium-priority companies
 * - Every 6 hours: Check all companies + discover new ones
 * - Every 12 hours: Full sync + cleanup closed jobs
 */

import smartAggregator from './job-sources/smart-aggregator.js';
import freeAutoDiscovery from './job-sources/free-auto-discovery.js';
import googleDiscovery from './job-sources/google-company-discovery.js';
import { prisma } from './prisma-client.js';
import logger from './logger.js';
import cron from 'node-cron';

// Company priority tiers based on posting frequency
const PRIORITY_TIERS = {
  HIGH: {
    // Companies that post jobs daily - check every hour
    syncInterval: '0 * * * *', // Every hour
    companies: [
      // Greenhouse
      'stripe', 'airbnb', 'coinbase', 'anthropic', 'databricks',
      'snowflake', 'doordash', 'instacart', 'figma', 'datadog',
      'mongodb', 'elastic', 'vercel', 'discord', 'robinhood',
      // Ashby
      'ramp', 'vanta', 'scale', 'linear',
      // Lever
      'spotify'
    ]
  },
  MEDIUM: {
    // Companies that post weekly - check every 3 hours
    syncInterval: '0 */3 * * *', // Every 3 hours
    companies: [
      'notion', 'netlify', 'supabase', 'planetscale', 'hashicorp',
      'twilio', 'segment', 'grammarly', 'pinterest', 'reddit'
    ]
  },
  LOW: {
    // All other companies - check every 6 hours
    syncInterval: '0 */6 * * *' // Every 6 hours
  }
};

// Freshness settings
const FRESHNESS_HOURS = 72;
const JOB_STALE_HOURS = 48; // Mark job as potentially closed if not seen in 48h

class SmartJobSync {
  constructor() {
    this.isRunning = {
      highPriority: false,
      mediumPriority: false,
      fullSync: false,
      discovery: false
    };

    this.cronJobs = {};
    this.stats = {
      lastHighPrioritySync: null,
      lastMediumPrioritySync: null,
      lastFullSync: null,
      lastDiscovery: null,
      jobsClosed: 0,
      jobsOpened: 0,
      newCompanies: 0
    };
  }

  /**
   * Start all cron jobs
   */
  start() {
    logger.info('🚀 Starting Smart Job Sync Service...');

    // High priority sync - every hour
    this.cronJobs.highPriority = cron.schedule(PRIORITY_TIERS.HIGH.syncInterval, () => {
      this.syncHighPriority();
    });
    logger.info(`   ⚡ High-priority sync: Every hour (${PRIORITY_TIERS.HIGH.companies.length} companies)`);

    // Medium priority sync - every 3 hours
    this.cronJobs.mediumPriority = cron.schedule(PRIORITY_TIERS.MEDIUM.syncInterval, () => {
      this.syncMediumPriority();
    });
    logger.info(`   📊 Medium-priority sync: Every 3 hours`);

    // Full sync + discovery - every 6 hours
    this.cronJobs.fullSync = cron.schedule('0 */6 * * *', () => {
      this.runFullSyncWithDiscovery();
    });
    logger.info(`   🔄 Full sync + discovery: Every 6 hours`);

    // Job closure check - every 12 hours
    this.cronJobs.closureCheck = cron.schedule('0 */12 * * *', () => {
      this.checkJobClosures();
    });
    logger.info(`   🔍 Job closure check: Every 12 hours`);

    logger.info('✅ Smart Job Sync Service started!');
  }

  /**
   * Stop all cron jobs
   */
  stop() {
    Object.values(this.cronJobs).forEach(job => job?.stop());
    this.cronJobs = {};
    logger.info('Smart Job Sync Service stopped');
  }

  /**
   * Sync high-priority companies (every hour)
   * These are companies that post jobs frequently
   */
  async syncHighPriority() {
    if (this.isRunning.highPriority) {
      logger.warn('High-priority sync already running, skipping');
      return;
    }

    this.isRunning.highPriority = true;
    const startTime = Date.now();

    try {
      logger.info('⚡ Starting HIGH-PRIORITY sync...');

      // Split companies by ATS type
      const greenhouseCompanies = PRIORITY_TIERS.HIGH.companies.filter(c =>
        this.getCompanyATS(c) === 'greenhouse'
      );
      const ashbyCompanies = PRIORITY_TIERS.HIGH.companies.filter(c =>
        this.getCompanyATS(c) === 'ashby'
      );
      const leverCompanies = PRIORITY_TIERS.HIGH.companies.filter(c =>
        this.getCompanyATS(c) === 'lever'
      );

      // Fetch in parallel
      const [greenhouseJobs, ashbyJobs, leverJobs] = await Promise.all([
        smartAggregator.fetchFromGreenhouse(greenhouseCompanies, { freshOnly: true }),
        smartAggregator.fetchFromAshby(ashbyCompanies, { freshOnly: true }),
        smartAggregator.fetchFromLever(leverCompanies, { freshOnly: true })
      ]);

      const allJobs = [...greenhouseJobs, ...ashbyJobs, ...leverJobs];

      // Save jobs and detect changes
      const { saved, updated, closed } = await this.saveJobsWithChangeDetection(allJobs);

      const duration = Date.now() - startTime;
      this.stats.lastHighPrioritySync = new Date();

      logger.info(`✅ High-priority sync complete (${(duration/1000).toFixed(1)}s)`);
      logger.info(`   New: ${saved}, Updated: ${updated}, Closed: ${closed}`);

      return { saved, updated, closed, duration };

    } catch (error) {
      logger.error(`High-priority sync failed: ${error.message}`);
      return { error: error.message };
    } finally {
      this.isRunning.highPriority = false;
    }
  }

  /**
   * Sync medium-priority companies (every 3 hours)
   */
  async syncMediumPriority() {
    if (this.isRunning.mediumPriority) {
      logger.warn('Medium-priority sync already running, skipping');
      return;
    }

    this.isRunning.mediumPriority = true;
    const startTime = Date.now();

    try {
      logger.info('📊 Starting MEDIUM-PRIORITY sync...');

      const companies = PRIORITY_TIERS.MEDIUM.companies;

      // Most medium companies are on Greenhouse
      const jobs = await smartAggregator.fetchFromGreenhouse(companies, { freshOnly: true });

      const { saved, updated, closed } = await this.saveJobsWithChangeDetection(jobs);

      const duration = Date.now() - startTime;
      this.stats.lastMediumPrioritySync = new Date();

      logger.info(`✅ Medium-priority sync complete (${(duration/1000).toFixed(1)}s)`);
      logger.info(`   New: ${saved}, Updated: ${updated}, Closed: ${closed}`);

      return { saved, updated, closed, duration };

    } catch (error) {
      logger.error(`Medium-priority sync failed: ${error.message}`);
      return { error: error.message };
    } finally {
      this.isRunning.mediumPriority = false;
    }
  }

  /**
   * Full sync with parallel discovery (every 6 hours)
   * Now includes free sources (SimplifyJobs, HN, Remotive, etc.)
   */
  async runFullSyncWithDiscovery() {
    if (this.isRunning.fullSync) {
      logger.warn('Full sync already running, skipping');
      return;
    }

    this.isRunning.fullSync = true;
    const startTime = Date.now();

    try {
      logger.info('🔄 Starting FULL SYNC with parallel discovery...');

      // Run discovery, ATS fetching, AND free sources in PARALLEL
      const [discoveryResult, jobsResult, freeResult] = await Promise.all([
        // Discovery: Find new companies
        this.runDiscovery(),

        // Fetch: Get jobs from all known companies (Greenhouse, Lever, Ashby, Workable)
        smartAggregator.aggregateAll({ freshOnly: true }),

        // Fetch: Get jobs from free sources (SimplifyJobs, HN, Remotive, RSS, YC)
        freeAutoDiscovery.aggregateAll().catch(err => {
          logger.warn(`Free sources fetch failed: ${err.message}`);
          return { jobs: [], stats: {} };
        })
      ]);

      // Combine all jobs
      const allJobs = [...jobsResult.jobs, ...freeResult.jobs];
      logger.info(`   Free sources: ${freeResult.jobs?.length || 0} jobs (SimplifyJobs: ${freeResult.stats?.simplify || 0}, HN: ${freeResult.stats?.hackernews || 0}, Remotive: ${freeResult.stats?.remotive || 0})`);

      // Save all jobs
      const { saved, updated, closed } = await this.saveJobsWithChangeDetection(allJobs);

      const duration = Date.now() - startTime;
      this.stats.lastFullSync = new Date();
      this.stats.newCompanies += discoveryResult.newCompanies || 0;

      logger.info(`✅ Full sync complete (${(duration/1000).toFixed(1)}s)`);
      logger.info(`   Jobs - New: ${saved}, Updated: ${updated}, Closed: ${closed}`);
      logger.info(`   Companies - New discovered: ${discoveryResult.newCompanies || 0}`);

      return {
        jobs: { saved, updated, closed },
        discovery: discoveryResult,
        freeStats: freeResult.stats,
        duration
      };

    } catch (error) {
      logger.error(`Full sync failed: ${error.message}`);
      return { error: error.message };
    } finally {
      this.isRunning.fullSync = false;
    }
  }

  /**
   * Run company discovery (find new companies via Google)
   */
  async runDiscovery() {
    if (this.isRunning.discovery) {
      return { skipped: true };
    }

    this.isRunning.discovery = true;

    try {
      logger.info('🔍 Running company discovery...');

      // Try Google discovery, fallback to API exploration
      let result;
      try {
        result = await googleDiscovery.discoverNewCompanies({
          atsTypes: ['greenhouse', 'ashby'],
          keywords: ['software engineer', 'frontend developer'],
          maxCompaniesPerATS: 30
        });
      } catch (error) {
        logger.warn(`Google discovery failed, using API exploration: ${error.message}`);
        result = await googleDiscovery.discoverViaAPIExploration({
          atsTypes: ['greenhouse', 'ashby', 'lever']
        });
      }

      this.stats.lastDiscovery = new Date();

      return {
        newCompanies: result.summary?.total || 0,
        breakdown: result.summary
      };

    } catch (error) {
      logger.error(`Discovery failed: ${error.message}`);
      return { error: error.message };
    } finally {
      this.isRunning.discovery = false;
    }
  }

  /**
   * Check for closed jobs (every 12 hours)
   * Jobs that haven't been seen in 48+ hours are marked as closed
   */
  async checkJobClosures() {
    try {
      logger.info('🔍 Checking for closed jobs...');

      const staleThreshold = new Date(Date.now() - JOB_STALE_HOURS * 60 * 60 * 1000);

      // Find jobs that haven't been updated recently
      const staleJobs = await prisma.aggregatedJob.findMany({
        where: {
          isActive: true,
          lastChecked: {
            lt: staleThreshold
          }
        },
        select: {
          id: true,
          externalId: true,
          source: true,
          company: true,
          title: true
        }
      });

      logger.info(`   Found ${staleJobs.length} potentially closed jobs`);

      // Verify each job is actually closed by checking the API
      let confirmedClosed = 0;
      let stillActive = 0;

      for (const job of staleJobs) {
        const isStillActive = await this.verifyJobExists(job);

        if (!isStillActive) {
          // Mark as closed
          await prisma.aggregatedJob.update({
            where: { id: job.id },
            data: {
              isActive: false,
              closedAt: new Date()
            }
          });
          confirmedClosed++;
        } else {
          // Update lastChecked
          await prisma.aggregatedJob.update({
            where: { id: job.id },
            data: { lastChecked: new Date() }
          });
          stillActive++;
        }
      }

      this.stats.jobsClosed += confirmedClosed;

      logger.info(`✅ Job closure check complete`);
      logger.info(`   Confirmed closed: ${confirmedClosed}`);
      logger.info(`   Still active: ${stillActive}`);

      return { confirmedClosed, stillActive };

    } catch (error) {
      logger.error(`Job closure check failed: ${error.message}`);
      return { error: error.message };
    }
  }

  /**
   * Verify if a job still exists on the ATS
   */
  async verifyJobExists(job) {
    try {
      const source = job.source?.toLowerCase();
      const company = job.company;
      const externalId = job.externalId;

      // Extract job ID from externalId (format: source_jobId)
      const jobId = externalId.split('_').slice(1).join('_');

      let apiUrl;
      if (source === 'greenhouse') {
        apiUrl = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs/${jobId}`;
      } else if (source === 'lever') {
        apiUrl = `https://api.lever.co/v0/postings/${company}/${jobId}`;
      } else if (source === 'ashby') {
        // Ashby doesn't have individual job endpoint, check board
        apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${company}`;
      } else {
        // Can't verify, assume still active
        return true;
      }

      const response = await fetch(apiUrl, {
        signal: AbortSignal.timeout(5000)
      });

      if (source === 'ashby') {
        // For Ashby, check if job ID exists in the response
        if (response.ok) {
          const data = await response.json();
          return data.jobs?.some(j => j.id === jobId);
        }
        return false;
      }

      return response.ok;

    } catch (error) {
      // Network error - assume job still exists
      return true;
    }
  }

  /**
   * Save jobs with change detection
   * Tracks new jobs, updates, and detects closures
   */
  async saveJobsWithChangeDetection(jobs) {
    let saved = 0;
    let updated = 0;
    let closed = 0;

    // DEDUPLICATION: Remove any duplicate externalIds in the incoming batch
    const seenIds = new Set();
    const uniqueJobs = jobs.filter(job => {
      if (!job.externalId) {
        logger.debug(`Skipping job without externalId: ${job.title} @ ${job.company}`);
        return false;
      }
      if (seenIds.has(job.externalId)) {
        logger.debug(`Skipping duplicate in batch: ${job.externalId}`);
        return false;
      }
      seenIds.add(job.externalId);
      return true;
    });

    const duplicatesInBatch = jobs.length - uniqueJobs.length;
    if (duplicatesInBatch > 0) {
      logger.info(`   Filtered ${duplicatesInBatch} duplicates from batch`);
    }

    // Get current active jobs for these companies
    const companies = [...new Set(uniqueJobs.map(j => j.company))];
    const sources = [...new Set(uniqueJobs.map(j => j.source))];

    const existingJobs = await prisma.aggregatedJob.findMany({
      where: {
        company: { in: companies },
        source: { in: sources },
        isActive: true
      },
      select: { externalId: true }
    });

    const existingIds = new Set(existingJobs.map(j => j.externalId));
    const newIds = new Set(uniqueJobs.map(j => j.externalId));

    // Find jobs that were active but aren't in the new fetch (potentially closed)
    const potentiallyClosed = existingJobs.filter(j => !newIds.has(j.externalId));

    for (const job of uniqueJobs) {
      try {
        // Use upsert to handle duplicates gracefully
        const result = await prisma.aggregatedJob.upsert({
          where: { externalId: job.externalId },
          update: {
            title: job.title,
            description: job.description,
            location: job.location,
            salary: job.salary,
            lastChecked: new Date(),
            isActive: true,
            closedAt: null // Re-open if it was closed
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
            atsComplexity: job.atsComplexity || 'SIMPLE',
            atsConfidence: job.atsConfidence || 1.0,
            aiApplyable: job.aiApplyable || false,
            postedDate: job.postedDate || new Date(),
            firstSeenAt: new Date(),
            lastChecked: new Date()
          }
        });

        if (existingIds.has(job.externalId)) {
          updated++;
        } else {
          saved++;
        }
      } catch (error) {
        // Log but don't fail
        logger.debug(`Failed to save job ${job.externalId}: ${error.message}`);
      }
    }

    // Mark potentially closed jobs (will be verified in closure check)
    // Don't mark immediately - let the closure check verify

    return { saved, updated, closed };
  }

  /**
   * Get the ATS type for a company (from our known list)
   */
  getCompanyATS(company) {
    const greenhouseCompanies = [
      'stripe', 'airbnb', 'coinbase', 'anthropic', 'databricks',
      'snowflake', 'doordash', 'instacart', 'figma', 'datadog',
      'mongodb', 'elastic', 'vercel', 'discord', 'robinhood',
      'notion', 'netlify', 'supabase', 'planetscale', 'hashicorp',
      'twilio', 'segment', 'grammarly', 'pinterest', 'reddit'
    ];

    const ashbyCompanies = ['ramp', 'vanta', 'scale', 'linear'];
    const leverCompanies = ['spotify'];

    if (greenhouseCompanies.includes(company)) return 'greenhouse';
    if (ashbyCompanies.includes(company)) return 'ashby';
    if (leverCompanies.includes(company)) return 'lever';
    return 'greenhouse'; // Default
  }

  /**
   * Manual trigger for immediate sync
   */
  async syncNow(options = {}) {
    const { priority = 'full' } = options;

    switch (priority) {
      case 'high':
        return this.syncHighPriority();
      case 'medium':
        return this.syncMediumPriority();
      case 'full':
      default:
        return this.runFullSyncWithDiscovery();
    }
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      cronJobsActive: Object.keys(this.cronJobs).length
    };
  }
}

export default new SmartJobSync();
