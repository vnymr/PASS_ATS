/**
 * Smart Job Aggregator - Hybrid Approach
 *
 * Strategy:
 * 1. Use JSearch (free tier) to discover jobs from Indeed/LinkedIn/Glassdoor
 * 2. Extract direct ATS URLs (Greenhouse, Lever, etc.) from results
 * 3. Auto-discover which companies use which ATS
 * 4. Next time, fetch directly from Greenhouse/Lever APIs (faster + more jobs)
 * 5. Build company list organically over time
 *
 * Benefits:
 * - No manual company list needed
 * - Self-improving (learns new companies)
 * - 100% legal (uses public APIs)
 * - Hybrid speed (aggregator discovery + direct API fetching)
 */

import atsDetector from '../ats-detector.js';
import aggregatorDetector from '../aggregator-detector.js';
import { prisma } from '../prisma-client.js';
import logger from '../logger.js';
import { getAllCompanies, TOTAL_COMPANIES } from './comprehensive-company-list.js';

// Freshness filter: Only jobs posted within this time window
const FRESHNESS_HOURS = 72;
const FRESHNESS_MS = FRESHNESS_HOURS * 60 * 60 * 1000;

class SmartAggregator {
  constructor() {
    // Track discovered companies per ATS
    this.discoveredCompanies = {
      greenhouse: new Set(),
      lever: new Set(),
      ashby: new Set(),
      workable: new Set(),
      smartrecruiters: new Set()
    };

    // Load comprehensive company list on initialization
    this.loadComprehensiveList();
  }

  /**
   * Check if a job is fresh (within FRESHNESS_HOURS)
   */
  isJobFresh(dateString) {
    if (!dateString) return true; // If no date, include it
    const jobDate = new Date(dateString);
    const now = Date.now();
    return (now - jobDate.getTime()) < FRESHNESS_MS;
  }

  /**
   * Load comprehensive company list (600+ companies!)
   */
  loadComprehensiveList() {
    const companies = getAllCompanies();

    for (const company of companies.greenhouse) {
      this.discoveredCompanies.greenhouse.add(company);
    }

    for (const company of companies.lever) {
      this.discoveredCompanies.lever.add(company);
    }

    for (const company of companies.ashby) {
      this.discoveredCompanies.ashby.add(company);
    }

    for (const company of companies.workable) {
      this.discoveredCompanies.workable.add(company);
    }

    for (const company of companies.smartrecruiters) {
      this.discoveredCompanies.smartrecruiters.add(company);
    }

    logger.info(`📚 Loaded ${TOTAL_COMPANIES} companies from comprehensive list!`);
    logger.info(`   - Greenhouse: ${companies.greenhouse.length}`);
    logger.info(`   - Lever: ${companies.lever.length}`);
    logger.info(`   - Ashby: ${companies.ashby.length}`);
    logger.info(`   - Workable: ${companies.workable.length}`);
    logger.info(`   - SmartRecruiters: ${companies.smartrecruiters.length}`);
  }

  /**
   * Phase 1: Discover jobs via JSearch (aggregates Indeed, LinkedIn, Glassdoor)
   * Extract company identifiers from direct URLs
   */
  async discoverViaJSearch(options = {}) {
    const { keywords = 'software engineer', pages = 5 } = options;

    if (!process.env.RAPIDAPI_KEY) {
      logger.warn('⚠️  No RAPIDAPI_KEY - skipping JSearch discovery');
      return { jobs: [], companies: {} };
    }

    const allJobs = [];
    const companiesByATS = {
      greenhouse: new Set(),
      lever: new Set(),
      ashby: new Set(),
      workable: new Set()
    };

    logger.info(`🔍 Discovering jobs via JSearch (${pages} pages)...`);

    for (let page = 1; page <= pages; page++) {
      try {
        const params = new URLSearchParams({
          query: keywords,
          page: page.toString(),
          num_pages: '1',
          date_posted: 'today' // Only today's jobs
        });

        const response = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
          headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
          }
        });

        if (!response.ok) {
          logger.error(`JSearch error (page ${page}): ${response.status}`);
          break;
        }

        const data = await response.json();

        if (!data.data || data.data.length === 0) {
          break;
        }

        // Process each job
        for (const job of data.data) {
          const applyUrl = job.job_apply_link || job.job_google_link;

          // Detect ATS from URL
          const atsInfo = atsDetector.detectFromURL(applyUrl);
          const companySlug = atsDetector.extractCompanyIdentifier(applyUrl, atsInfo.atsType);

          // Track discovered companies
          if (companySlug && atsInfo.atsType !== 'UNKNOWN') {
            const atsKey = atsInfo.atsType.toLowerCase();
            if (companiesByATS[atsKey]) {
              companiesByATS[atsKey].add(companySlug);
            }
          }

          allJobs.push({
            externalId: `jsearch_${job.job_id}`,
            source: 'jsearch',
            title: job.job_title,
            company: job.employer_name,
            location: job.job_city && job.job_state
              ? `${job.job_city}, ${job.job_state}`
              : job.job_country || 'Unknown',
            salary: this.formatSalary(job.job_min_salary, job.job_max_salary),
            description: job.job_description || '',
            applyUrl: applyUrl,
            postedDate: new Date(job.job_posted_at_timestamp * 1000),

            // ATS detection
            atsType: atsInfo.atsType,
            atsCompany: companySlug,
            atsComplexity: atsInfo.complexity,
            atsConfidence: atsInfo.confidence,
            aiApplyable: atsInfo.aiApplyable
          });
        }

        logger.info(`✅ JSearch page ${page}: ${data.data.length} jobs`);

        // Delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        logger.error(`JSearch fetch failed (page ${page}): ${error.message}`);
        break;
      }
    }

    // Log discovered companies
    for (const [ats, companies] of Object.entries(companiesByATS)) {
      if (companies.size > 0) {
        logger.info(`📊 Discovered ${companies.size} ${ats.toUpperCase()} companies`);
        this.discoveredCompanies[ats] = new Set([
          ...this.discoveredCompanies[ats],
          ...companies
        ]);
      }
    }

    // Filter out aggregator jobs (only keep direct postings)
    const beforeFilter = allJobs.length;
    const filteredJobs = aggregatorDetector.filterJobs(allJobs);
    const afterFilter = filteredJobs.length;

    if (beforeFilter > afterFilter) {
      logger.info(`🔍 Filtered out ${beforeFilter - afterFilter} aggregator jobs (${afterFilter} direct postings remain)`);
    }

    return {
      jobs: filteredJobs,
      companies: Object.fromEntries(
        Object.entries(companiesByATS).map(([ats, set]) => [ats, Array.from(set)])
      )
    };
  }

  /**
   * Helper: Fetch with timeout and retry
   */
  async fetchWithRetry(url, options = {}, retries = 2, timeout = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (retries > 0 && (error.name === 'AbortError' || error.message.includes('fetch failed'))) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (3 - retries)));
        return this.fetchWithRetry(url, options, retries - 1, timeout);
      }

      throw error;
    }
  }

  /**
   * Helper: Delay for rate limiting
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Phase 2: Fetch directly from Greenhouse API for discovered companies
   * Now fetches FULL job details including complete descriptions!
   * Supports freshness filtering (default: 72 hours)
   */
  async fetchFromGreenhouse(companies = [], options = {}) {
    const { freshOnly = true } = options;

    if (companies.length === 0) {
      companies = Array.from(this.discoveredCompanies.greenhouse);
    }

    if (companies.length === 0) {
      logger.info('⚠️  No Greenhouse companies discovered yet');
      return [];
    }

    logger.info(`📥 Fetching from ${companies.length} Greenhouse companies (freshOnly=${freshOnly})...`);

    const allJobs = [];
    const batchSize = 20; // Reduced from 50 to be more conservative
    let failedCompanies = 0;
    let successfulCompanies = 0;
    let skippedOldJobs = 0;

    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);

      // Process companies in batch sequentially to avoid rate limits
      for (const company of batch) {
        try {
          // Step 1: Get list of jobs with timeout
          const listResponse = await this.fetchWithRetry(
            `https://boards-api.greenhouse.io/v1/boards/${company}/jobs`,
            {},
            2,
            5000
          );

          if (!listResponse.ok) {
            if (listResponse.status === 404) {
              // Company board doesn't exist - silently skip
              failedCompanies++;
              continue;
            }
            logger.warn(`Greenhouse API returned ${listResponse.status} for ${company}`);
            failedCompanies++;
            continue;
          }

          const listData = await listResponse.json();

          if (!listData.jobs || listData.jobs.length === 0) {
            continue;
          }

          // Step 2: Filter by freshness FIRST, then fetch details only for fresh jobs
          const jobsWithDetails = [];

          // Filter jobs by freshness before fetching details (optimization)
          const freshJobs = freshOnly
            ? listData.jobs.filter(job => this.isJobFresh(job.updated_at))
            : listData.jobs;

          if (freshOnly && listData.jobs.length > freshJobs.length) {
            skippedOldJobs += (listData.jobs.length - freshJobs.length);
          }

          for (const job of freshJobs) {
            try {
              // Add small delay between job detail fetches (100ms)
              await this.delay(100);

              // Fetch individual job details with timeout
              const detailResponse = await this.fetchWithRetry(
                `https://boards-api.greenhouse.io/v1/boards/${company}/jobs/${job.id}`,
                {},
                1, // Only 1 retry for individual jobs
                5000
              );

              let jobData;

              if (!detailResponse.ok) {
                // Fallback to basic data if detail fetch fails
                jobData = {
                  externalId: `greenhouse_${job.id}`,
                  source: 'greenhouse',
                  sourceCompanyId: company,
                  title: job.title,
                  company: company,
                  location: job.location?.name || 'Unknown',
                  salary: null,
                  description: '',
                  requirements: null,
                  applyUrl: job.absolute_url,
                  postedDate: new Date(job.updated_at),
                  atsType: 'GREENHOUSE',
                  atsCompany: company,
                  atsComplexity: 'SIMPLE',
                  atsConfidence: 1.0,
                  aiApplyable: true
                };
              } else {
                const fullJob = await detailResponse.json();

                // Extract requirements from HTML content
                const requirements = this.extractRequirementsFromHTML(fullJob.content || '');

                jobData = {
                  externalId: `greenhouse_${job.id}`,
                  source: 'greenhouse',
                  sourceCompanyId: company,
                  title: fullJob.title,
                  company: company,
                  location: fullJob.location?.name || 'Unknown',
                  salary: null,
                  description: fullJob.content || '', // Full HTML description
                  requirements: requirements,
                  applyUrl: fullJob.absolute_url, // DIRECT URL
                  postedDate: new Date(fullJob.updated_at),

                  // Perfect ATS detection
                  atsType: 'GREENHOUSE',
                  atsCompany: company,
                  atsComplexity: 'SIMPLE',
                  atsConfidence: 1.0,
                  aiApplyable: true
                };
              }

              jobsWithDetails.push(jobData);

            } catch (error) {
              // Log but don't fail the entire company
              if (error.name !== 'AbortError') {
                logger.debug(`Failed to fetch job details (${company}/${job.id}): ${error.message}`);
              }

              // Still add basic job info
              jobsWithDetails.push({
                externalId: `greenhouse_${job.id}`,
                source: 'greenhouse',
                sourceCompanyId: company,
                title: job.title,
                company: company,
                location: job.location?.name || 'Unknown',
                salary: null,
                description: '',
                requirements: null,
                applyUrl: job.absolute_url,
                postedDate: new Date(job.updated_at),
                atsType: 'GREENHOUSE',
                atsCompany: company,
                atsComplexity: 'SIMPLE',
                atsConfidence: 1.0,
                aiApplyable: true
              });
            }
          }

          allJobs.push(...jobsWithDetails);
          successfulCompanies++;

        } catch (error) {
          if (error.name !== 'AbortError') {
            logger.warn(`Greenhouse fetch failed (${company}): ${error.message}`);
          }
          failedCompanies++;
        }

        // Rate limit: 200ms delay between companies
        await this.delay(200);
      }

      // Longer delay between batches
      if (i + batchSize < companies.length) {
        await this.delay(2000);
      }
    }

    logger.info(`✅ Fetched ${allJobs.length} fresh jobs from Greenhouse (${successfulCompanies} companies, ${skippedOldJobs} old jobs skipped)`);
    return allJobs;
  }

  /**
   * Phase 3: Fetch directly from Lever API for discovered companies
   * Lever's JSON endpoint already includes full descriptions!
   * Supports freshness filtering (default: 72 hours)
   */
  async fetchFromLever(companies = [], options = {}) {
    const { freshOnly = true } = options;

    if (companies.length === 0) {
      companies = Array.from(this.discoveredCompanies.lever);
    }

    if (companies.length === 0) {
      logger.info('⚠️  No Lever companies discovered yet');
      return [];
    }

    logger.info(`📥 Fetching from ${companies.length} Lever companies (freshOnly=${freshOnly})...`);

    const allJobs = [];
    const batchSize = 20; // Reduced from 50
    let failedCompanies = 0;
    let successfulCompanies = 0;
    let skippedOldJobs = 0;

    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);

      // Process companies sequentially to avoid rate limits
      for (const company of batch) {
        try {
          const response = await this.fetchWithRetry(
            `https://api.lever.co/v0/postings/${company}?mode=json`,
            {},
            2,
            5000
          );

          if (!response.ok) {
            if (response.status === 404) {
              // Company doesn't exist - silently skip
              failedCompanies++;
              continue;
            }
            logger.warn(`Lever API returned ${response.status} for ${company}`);
            failedCompanies++;
            continue;
          }

          const jobs = await response.json();

          // Filter by freshness first
          const freshJobs = freshOnly
            ? jobs.filter(job => this.isJobFresh(job.createdAt))
            : jobs;

          if (freshOnly && jobs.length > freshJobs.length) {
            skippedOldJobs += (jobs.length - freshJobs.length);
          }

          const companyJobs = freshJobs.map(job => {
            // Extract requirements from description HTML
            const requirements = this.extractRequirementsFromHTML(job.description || '');

            return {
              externalId: `lever_${job.id}`,
              source: 'lever',
              sourceCompanyId: company,
              title: job.text,
              company: company,
              location: job.categories?.location || 'Unknown',
              salary: null,
              description: job.description || '', // Full HTML description
              requirements: requirements,
              applyUrl: job.hostedUrl, // DIRECT URL
              postedDate: new Date(job.createdAt),

              // Perfect ATS detection
              atsType: 'LEVER',
              atsCompany: company,
              atsComplexity: 'SIMPLE',
              atsConfidence: 1.0,
              aiApplyable: true
            };
          });

          allJobs.push(...companyJobs);
          successfulCompanies++;

        } catch (error) {
          if (error.name !== 'AbortError') {
            logger.warn(`Lever fetch failed (${company}): ${error.message}`);
          }
          failedCompanies++;
        }

        // Rate limit: 200ms delay between companies
        await this.delay(200);
      }

      // Longer delay between batches
      if (i + batchSize < companies.length) {
        await this.delay(2000);
      }
    }

    logger.info(`✅ Fetched ${allJobs.length} fresh jobs from Lever (${successfulCompanies} companies, ${skippedOldJobs} old jobs skipped)`);
    return allJobs;
  }

  /**
   * Phase 4: Fetch directly from Ashby API for discovered companies
   * Ashby is popular with modern startups (Linear, Ramp, Vanta, etc.)
   */
  async fetchFromAshby(companies = [], options = {}) {
    const { freshOnly = true } = options;

    if (companies.length === 0) {
      companies = Array.from(this.discoveredCompanies.ashby);
    }

    if (companies.length === 0) {
      logger.info('⚠️  No Ashby companies discovered yet');
      return [];
    }

    logger.info(`📥 Fetching from ${companies.length} Ashby companies...`);

    const allJobs = [];
    let failedCompanies = 0;
    let successfulCompanies = 0;
    let skippedOldJobs = 0;

    for (const company of companies) {
      try {
        const response = await this.fetchWithRetry(
          `https://api.ashbyhq.com/posting-api/job-board/${company}`,
          {},
          2,
          5000
        );

        if (!response.ok) {
          if (response.status === 404) {
            failedCompanies++;
            continue;
          }
          logger.warn(`Ashby API returned ${response.status} for ${company}`);
          failedCompanies++;
          continue;
        }

        const data = await response.json();
        const jobs = data.jobs || [];

        for (const job of jobs) {
          // Apply freshness filter
          if (freshOnly && !this.isJobFresh(job.publishedAt)) {
            skippedOldJobs++;
            continue;
          }

          allJobs.push({
            externalId: `ashby_${job.id}`,
            source: 'ashby',
            sourceCompanyId: company,
            title: job.title,
            company: company,
            location: job.location || (job.isRemote ? 'Remote' : 'Unknown'),
            salary: null,
            description: job.descriptionHtml || job.descriptionPlain || '',
            requirements: this.extractRequirementsFromHTML(job.descriptionHtml || ''),
            applyUrl: job.applyUrl || job.jobUrl || `https://jobs.ashbyhq.com/${company}/${job.id}`,
            postedDate: new Date(job.publishedAt),

            // ATS metadata
            atsType: 'ASHBY',
            atsCompany: company,
            atsComplexity: 'SIMPLE',
            atsConfidence: 1.0,
            aiApplyable: true,

            // Extra Ashby fields
            department: job.department,
            team: job.team,
            employmentType: job.employmentType,
            isRemote: job.isRemote
          });
        }

        successfulCompanies++;

      } catch (error) {
        if (error.name !== 'AbortError') {
          logger.warn(`Ashby fetch failed (${company}): ${error.message}`);
        }
        failedCompanies++;
      }

      // Rate limit: 200ms delay between companies
      await this.delay(200);
    }

    logger.info(`✅ Fetched ${allJobs.length} fresh jobs from Ashby (${successfulCompanies} companies, ${skippedOldJobs} old jobs skipped)`);
    return allJobs;
  }

  /**
   * Phase 5: Fetch directly from Workable API for discovered companies
   */
  async fetchFromWorkable(companies = [], options = {}) {
    const { freshOnly = true } = options;

    if (companies.length === 0) {
      companies = Array.from(this.discoveredCompanies.workable);
    }

    if (companies.length === 0) {
      logger.info('⚠️  No Workable companies discovered yet');
      return [];
    }

    logger.info(`📥 Fetching from ${companies.length} Workable companies...`);

    const allJobs = [];
    let failedCompanies = 0;
    let successfulCompanies = 0;
    let skippedOldJobs = 0;

    for (const company of companies) {
      try {
        const response = await this.fetchWithRetry(
          `https://apply.workable.com/api/v1/widget/accounts/${company}`,
          {},
          2,
          5000
        );

        if (!response.ok) {
          if (response.status === 404) {
            failedCompanies++;
            continue;
          }
          logger.warn(`Workable API returned ${response.status} for ${company}`);
          failedCompanies++;
          continue;
        }

        const data = await response.json();
        const jobs = data.jobs || [];

        for (const job of jobs) {
          // Workable may have published_on or created_at
          const jobDate = job.published_on || job.created_at;

          // Apply freshness filter
          if (freshOnly && jobDate && !this.isJobFresh(jobDate)) {
            skippedOldJobs++;
            continue;
          }

          allJobs.push({
            externalId: `workable_${job.shortcode || job.id}`,
            source: 'workable',
            sourceCompanyId: company,
            title: job.title,
            company: company,
            location: job.location?.city || job.location?.country || 'Unknown',
            salary: null,
            description: job.description || '',
            requirements: this.extractRequirementsFromHTML(job.requirements || job.description || ''),
            applyUrl: job.url || `https://apply.workable.com/${company}/j/${job.shortcode}/`,
            postedDate: jobDate ? new Date(jobDate) : new Date(),

            // ATS metadata
            atsType: 'WORKABLE',
            atsCompany: company,
            atsComplexity: 'SIMPLE',
            atsConfidence: 1.0,
            aiApplyable: true,

            // Extra fields
            department: job.department,
            employmentType: job.employment_type
          });
        }

        successfulCompanies++;

      } catch (error) {
        if (error.name !== 'AbortError') {
          logger.warn(`Workable fetch failed (${company}): ${error.message}`);
        }
        failedCompanies++;
      }

      // Rate limit: 200ms delay between companies
      await this.delay(200);
    }

    logger.info(`✅ Fetched ${allJobs.length} fresh jobs from Workable (${successfulCompanies} companies, ${skippedOldJobs} old jobs skipped)`);
    return allJobs;
  }

  /**
   * Fetch from Remotive - DISABLED
   * Remotive is a job aggregator that redirects to other sites
   * We only want direct job postings from company career pages/ATS platforms
   */
  async fetchFromRemotive() {
    logger.info('📥 Skipping Remotive (aggregator site - not direct postings)');
    return [];
  }

  /**
   * Main aggregation method - hybrid approach
   *
   * Strategy:
   * 1. First run: Discover via JSearch
   * 2. Subsequent runs: Fetch directly from all ATS platforms
   * 3. Filter to only fresh jobs (default: 72 hours)
   */
  async aggregateAll(options = {}) {
    const { freshOnly = true } = options;

    logger.info('🚀 Starting smart job aggregation...');
    logger.info(`   Freshness filter: ${freshOnly ? `${FRESHNESS_HOURS} hours` : 'disabled'}\n`);

    // Load previously discovered companies from database
    await this.loadDiscoveredCompanies();

    const results = [];

    // Phase 1: Discovery (if we don't have many companies yet)
    const totalDiscovered = Array.from(this.discoveredCompanies.greenhouse).length +
                           Array.from(this.discoveredCompanies.lever).length +
                           Array.from(this.discoveredCompanies.ashby).length;

    if (totalDiscovered < 100 || options.forceDiscovery) {
      logger.info('🔍 Running discovery phase (building company list)...');

      // Only discover via JSearch (skip Remotive as it's an aggregator)
      const jsearchResult = await this.discoverViaJSearch(options.jsearch);

      results.push(...jsearchResult.jobs);

      // Save discovered companies to database
      await this.saveDiscoveredCompanies();
    }

    // Phase 2: Direct fetching from ALL discovered ATS platforms
    logger.info('📥 Fetching directly from all ATS platforms...');

    const fetchOptions = { freshOnly };

    const [greenhouseJobs, leverJobs, ashbyJobs, workableJobs] = await Promise.all([
      this.fetchFromGreenhouse([], fetchOptions),
      this.fetchFromLever([], fetchOptions),
      this.fetchFromAshby([], fetchOptions),
      this.fetchFromWorkable([], fetchOptions)
    ]);

    results.push(...greenhouseJobs, ...leverJobs, ...ashbyJobs, ...workableJobs);

    // Deduplicate jobs
    const uniqueJobs = this.deduplicateJobs(results);

    logger.info(`\n✅ Aggregation complete:`);
    logger.info(`  - Total fresh jobs: ${uniqueJobs.length}`);
    logger.info(`  - Greenhouse: ${greenhouseJobs.length} jobs (${this.discoveredCompanies.greenhouse.size} companies)`);
    logger.info(`  - Lever: ${leverJobs.length} jobs (${this.discoveredCompanies.lever.size} companies)`);
    logger.info(`  - Ashby: ${ashbyJobs.length} jobs (${this.discoveredCompanies.ashby.size} companies)`);
    logger.info(`  - Workable: ${workableJobs.length} jobs (${this.discoveredCompanies.workable.size} companies)`);
    logger.info(`  - AI-applyable: ${uniqueJobs.filter(j => j.aiApplyable).length}`);

    return {
      jobs: uniqueJobs,
      stats: this.generateStats(uniqueJobs),
      companies: {
        greenhouse: Array.from(this.discoveredCompanies.greenhouse),
        lever: Array.from(this.discoveredCompanies.lever),
        ashby: Array.from(this.discoveredCompanies.ashby),
        workable: Array.from(this.discoveredCompanies.workable)
      }
    };
  }

  /**
   * Load discovered companies from database
   */
  async loadDiscoveredCompanies() {
    try {
      const companies = await prisma.discoveredCompany.findMany({
        where: { isActive: true }
      });

      for (const company of companies) {
        const atsKey = company.atsType.toLowerCase();
        if (this.discoveredCompanies[atsKey]) {
          this.discoveredCompanies[atsKey].add(company.slug);
        }
      }

      logger.info(`📚 Loaded ${companies.length} previously discovered companies`);

    } catch (error) {
      // Table might not exist yet - that's okay
      logger.warn('Could not load discovered companies (table may not exist)');
    }
  }

  /**
   * Save discovered companies to database
   */
  async saveDiscoveredCompanies() {
    try {
      for (const [atsType, companies] of Object.entries(this.discoveredCompanies)) {
        for (const slug of companies) {
          await prisma.discoveredCompany.upsert({
            where: {
              atsType_slug: {
                atsType: atsType.toUpperCase(),
                slug: slug
              }
            },
            create: {
              atsType: atsType.toUpperCase(),
              slug: slug,
              discoveredAt: new Date(),
              lastFetchedAt: new Date(),
              isActive: true
            },
            update: {
              lastFetchedAt: new Date(),
              isActive: true
            }
          });
        }
      }

      logger.info('💾 Saved discovered companies to database');

    } catch (error) {
      logger.error('Failed to save discovered companies:', error.message);
    }
  }

  /**
   * Deduplicate jobs by external ID or URL
   */
  deduplicateJobs(jobs) {
    const seen = new Set();
    const unique = [];

    for (const job of jobs) {
      const key = job.externalId || job.applyUrl;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(job);
      }
    }

    return unique;
  }

  /**
   * Generate statistics
   */
  generateStats(jobs) {
    const total = jobs.length;
    const aiApplyable = jobs.filter(j => j.aiApplyable).length;
    const byATS = {};

    jobs.forEach(job => {
      byATS[job.atsType] = (byATS[job.atsType] || 0) + 1;
    });

    return {
      total,
      aiApplyable,
      aiApplyablePercent: ((aiApplyable / total) * 100).toFixed(1),
      byATS
    };
  }

  /**
   * Format salary
   */
  formatSalary(min, max) {
    if (!min && !max) return null;
    if (min && max) return `$${min.toLocaleString()}-${max.toLocaleString()}`;
    if (min) return `$${min.toLocaleString()}+`;
    if (max) return `Up to $${max.toLocaleString()}`;
    return null;
  }

  /**
   * Extract requirements section from HTML content
   * Looks for common requirement section headers and extracts the content
   */
  extractRequirementsFromHTML(html) {
    if (!html) return null;

    // Common requirement section headers (case insensitive)
    const requirementHeaders = [
      'requirements',
      'qualifications',
      'minimum requirements',
      'required qualifications',
      'minimum qualifications',
      'what we\'re looking for',
      'what you need',
      'you have',
      'must have',
      'prerequisites'
    ];

    // Remove HTML tags for simpler parsing
    const stripHtml = (str) => str.replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n').trim();
    const plainText = stripHtml(html);

    // Find the requirements section
    const lines = plainText.split('\n');
    let requirementsStart = -1;
    let requirementsEnd = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();

      // Check if this line is a requirement header
      if (requirementHeaders.some(header => line.includes(header))) {
        requirementsStart = i + 1;

        // Find the end of the requirements section (next major header or end of content)
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim().toLowerCase();

          // Stop at common section headers
          if (nextLine.includes('responsibilities') ||
              nextLine.includes('about us') ||
              nextLine.includes('about the role') ||
              nextLine.includes('benefits') ||
              nextLine.includes('perks') ||
              nextLine.includes('what you\'ll do') ||
              nextLine.includes('your role')) {
            requirementsEnd = j;
            break;
          }
        }

        if (requirementsEnd === -1) {
          requirementsEnd = lines.length;
        }
        break;
      }
    }

    if (requirementsStart !== -1) {
      const requirementLines = lines.slice(requirementsStart, requirementsEnd)
        .filter(line => line.trim().length > 0)
        .join('\n');

      return requirementLines.substring(0, 5000); // Limit to 5000 chars
    }

    // If no specific requirements section found, return first 1000 chars of description
    return plainText.substring(0, 1000);
  }
}

export default new SmartAggregator();
