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
   */
  async fetchFromGreenhouse(companies = []) {
    if (companies.length === 0) {
      companies = Array.from(this.discoveredCompanies.greenhouse);
    }

    if (companies.length === 0) {
      logger.info('⚠️  No Greenhouse companies discovered yet');
      return [];
    }

    logger.info(`📥 Fetching from ${companies.length} Greenhouse companies...`);

    const allJobs = [];
    const batchSize = 20; // Reduced from 50 to be more conservative
    let failedCompanies = 0;
    let successfulCompanies = 0;

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

          // Step 2: Fetch details for each job with rate limiting
          const jobsWithDetails = [];

          for (const job of listData.jobs) {
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

    logger.info(`✅ Fetched ${allJobs.length} jobs from Greenhouse (${successfulCompanies} companies succeeded, ${failedCompanies} failed)`);
    return allJobs;
  }

  /**
   * Phase 3: Fetch directly from Lever API for discovered companies
   * Lever's JSON endpoint already includes full descriptions!
   */
  async fetchFromLever(companies = []) {
    if (companies.length === 0) {
      companies = Array.from(this.discoveredCompanies.lever);
    }

    if (companies.length === 0) {
      logger.info('⚠️  No Lever companies discovered yet');
      return [];
    }

    logger.info(`📥 Fetching from ${companies.length} Lever companies...`);

    const allJobs = [];
    const batchSize = 20; // Reduced from 50
    let failedCompanies = 0;
    let successfulCompanies = 0;

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

          const companyJobs = jobs.map(job => {
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

    logger.info(`✅ Fetched ${allJobs.length} jobs from Lever (${successfulCompanies} companies succeeded, ${failedCompanies} failed)`);
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
   * 1. First run: Discover via JSearch + Remotive
   * 2. Subsequent runs: Fetch directly from Greenhouse/Lever + supplement with discovery
   */
  async aggregateAll(options = {}) {
    logger.info('🚀 Starting smart job aggregation...\n');

    // Load previously discovered companies from database
    await this.loadDiscoveredCompanies();

    const results = [];

    // Phase 1: Discovery (if we don't have many companies yet)
    const totalDiscovered = Array.from(this.discoveredCompanies.greenhouse).length +
                           Array.from(this.discoveredCompanies.lever).length;

    if (totalDiscovered < 100 || options.forceDiscovery) {
      logger.info('🔍 Running discovery phase (building company list)...');

      // Only discover via JSearch (skip Remotive as it's an aggregator)
      const jsearchResult = await this.discoverViaJSearch(options.jsearch);

      results.push(...jsearchResult.jobs);

      // Save discovered companies to database
      await this.saveDiscoveredCompanies();
    }

    // Phase 2: Direct fetching from discovered companies
    logger.info('📥 Fetching directly from discovered companies...');

    const [greenhouseJobs, leverJobs] = await Promise.all([
      this.fetchFromGreenhouse(),
      this.fetchFromLever()
    ]);

    results.push(...greenhouseJobs, ...leverJobs);

    // Deduplicate jobs
    const uniqueJobs = this.deduplicateJobs(results);

    logger.info(`\n✅ Aggregation complete:`);
    logger.info(`  - Total jobs: ${uniqueJobs.length}`);
    logger.info(`  - Greenhouse companies: ${this.discoveredCompanies.greenhouse.size}`);
    logger.info(`  - Lever companies: ${this.discoveredCompanies.lever.size}`);
    logger.info(`  - AI-applyable: ${uniqueJobs.filter(j => j.aiApplyable).length}`);

    return {
      jobs: uniqueJobs,
      stats: this.generateStats(uniqueJobs),
      companies: {
        greenhouse: Array.from(this.discoveredCompanies.greenhouse),
        lever: Array.from(this.discoveredCompanies.lever)
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
