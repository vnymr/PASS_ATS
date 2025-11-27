/**
 * Google Company Discovery Service
 *
 * Discovers new companies using ATS platforms by searching Google.
 * Runs every 6 hours to find fresh company job boards.
 *
 * Strategy:
 * 1. Search Google for "site:boards.greenhouse.io software engineer" (past 3 days)
 * 2. Extract company slugs from URLs
 * 3. Verify the company has active jobs
 * 4. Add to discovered companies list
 */

import { chromium } from 'playwright';
import logger from '../logger.js';
import { prisma } from '../prisma-client.js';

// ATS search configurations
const ATS_SEARCH_CONFIGS = [
  {
    name: 'greenhouse',
    searchQuery: 'site:boards.greenhouse.io software engineer',
    urlPattern: /boards\.greenhouse\.io\/([^\/\?]+)/,
    apiTemplate: 'https://boards-api.greenhouse.io/v1/boards/{slug}/jobs'
  },
  {
    name: 'lever',
    searchQuery: 'site:jobs.lever.co software engineer',
    urlPattern: /jobs\.lever\.co\/([^\/\?]+)/,
    apiTemplate: 'https://api.lever.co/v0/postings/{slug}?mode=json'
  },
  {
    name: 'ashby',
    searchQuery: 'site:jobs.ashbyhq.com software engineer',
    urlPattern: /jobs\.ashbyhq\.com\/([^\/\?]+)/,
    apiTemplate: 'https://api.ashbyhq.com/posting-api/job-board/{slug}'
  },
  {
    name: 'workable',
    searchQuery: 'site:apply.workable.com software engineer',
    urlPattern: /apply\.workable\.com\/([^\/\?]+)/,
    apiTemplate: 'https://apply.workable.com/api/v1/widget/accounts/{slug}'
  }
];

// Additional search keywords to find more jobs
const SEARCH_KEYWORDS = [
  'software engineer',
  'frontend developer',
  'backend developer',
  'full stack engineer',
  'data scientist',
  'machine learning engineer',
  'product manager',
  'devops engineer',
  'site reliability engineer'
];

class GoogleCompanyDiscovery {
  constructor() {
    this.discoveredCompanies = new Map(); // slug -> { atsType, verifiedAt, jobCount }
    this.searchDelay = 3000; // 3 seconds between searches to avoid rate limiting
    this.maxPagesPerSearch = 3; // Google pages to crawl per search
  }

  /**
   * Main discovery method - searches Google for new companies
   */
  async discoverNewCompanies(options = {}) {
    const {
      atsTypes = ['greenhouse', 'ashby'], // Focus on best performing ATSes
      keywords = SEARCH_KEYWORDS.slice(0, 3), // Top 3 keywords
      maxCompaniesPerATS = 50
    } = options;

    logger.info('🔍 Starting Google company discovery...');
    logger.info(`   ATS types: ${atsTypes.join(', ')}`);
    logger.info(`   Keywords: ${keywords.join(', ')}`);

    const newCompanies = {
      greenhouse: new Set(),
      lever: new Set(),
      ashby: new Set(),
      workable: new Set()
    };

    let browser;

    try {
      // Launch browser with stealth settings
      browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox'
        ]
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
      });

      const page = await context.newPage();

      // Search for each ATS type
      for (const atsType of atsTypes) {
        const config = ATS_SEARCH_CONFIGS.find(c => c.name === atsType);
        if (!config) continue;

        logger.info(`\n📡 Searching for ${atsType.toUpperCase()} companies...`);

        for (const keyword of keywords) {
          if (newCompanies[atsType].size >= maxCompaniesPerATS) break;

          try {
            // Construct Google search URL with date filter (past 3 days)
            const query = config.searchQuery.replace('software engineer', keyword);
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbs=qdr:d3`;

            logger.info(`   Searching: ${keyword}...`);

            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

            // Wait for search results
            await page.waitForSelector('#search', { timeout: 10000 }).catch(() => {});

            // Extract all links from search results
            const links = await page.$$eval('a', anchors =>
              anchors.map(a => a.href).filter(href => href && href.startsWith('http'))
            );

            // Extract company slugs from URLs
            for (const link of links) {
              const match = link.match(config.urlPattern);
              if (match && match[1]) {
                const slug = match[1].toLowerCase();
                // Skip common non-company slugs
                if (!this.isValidCompanySlug(slug)) continue;
                newCompanies[atsType].add(slug);
              }
            }

            logger.info(`   Found ${newCompanies[atsType].size} ${atsType} companies so far`);

            // Respect rate limits
            await this.delay(this.searchDelay);

          } catch (error) {
            logger.warn(`   Search failed for ${keyword}: ${error.message}`);
          }
        }
      }

      await browser.close();

    } catch (error) {
      logger.error(`Browser error: ${error.message}`);
      if (browser) await browser.close();
    }

    // Verify discovered companies have active jobs
    logger.info('\n✅ Verifying discovered companies...');
    const verifiedCompanies = await this.verifyCompanies(newCompanies);

    // Save to database
    await this.saveDiscoveredCompanies(verifiedCompanies);

    // Generate summary
    const summary = {
      greenhouse: verifiedCompanies.greenhouse.length,
      lever: verifiedCompanies.lever.length,
      ashby: verifiedCompanies.ashby.length,
      workable: verifiedCompanies.workable.length,
      total: verifiedCompanies.greenhouse.length + verifiedCompanies.lever.length +
             verifiedCompanies.ashby.length + verifiedCompanies.workable.length
    };

    logger.info(`\n🎉 Discovery complete!`);
    logger.info(`   Greenhouse: ${summary.greenhouse} new companies`);
    logger.info(`   Lever: ${summary.lever} new companies`);
    logger.info(`   Ashby: ${summary.ashby} new companies`);
    logger.info(`   Workable: ${summary.workable} new companies`);
    logger.info(`   Total: ${summary.total} new companies`);

    return { companies: verifiedCompanies, summary };
  }

  /**
   * Verify companies have active jobs by calling their APIs
   */
  async verifyCompanies(companiesByATS) {
    const verified = {
      greenhouse: [],
      lever: [],
      ashby: [],
      workable: []
    };

    for (const [atsType, slugs] of Object.entries(companiesByATS)) {
      const config = ATS_SEARCH_CONFIGS.find(c => c.name === atsType);
      if (!config) continue;

      logger.info(`   Verifying ${slugs.size} ${atsType} companies...`);

      for (const slug of slugs) {
        try {
          const apiUrl = config.apiTemplate.replace('{slug}', slug);
          const response = await fetch(apiUrl, {
            signal: AbortSignal.timeout(5000)
          });

          if (response.ok) {
            const data = await response.json();
            const jobCount = this.getJobCount(data, atsType);

            if (jobCount > 0) {
              verified[atsType].push({
                slug,
                jobCount,
                verifiedAt: new Date()
              });
            }
          }
        } catch (error) {
          // Skip companies that fail verification
        }

        // Small delay between API calls
        await this.delay(100);
      }
    }

    return verified;
  }

  /**
   * Get job count from API response based on ATS type
   */
  getJobCount(data, atsType) {
    switch (atsType) {
      case 'greenhouse':
        return data.jobs?.length || 0;
      case 'lever':
        return Array.isArray(data) ? data.length : 0;
      case 'ashby':
        return data.jobs?.length || 0;
      case 'workable':
        return data.jobs?.length || 0;
      default:
        return 0;
    }
  }

  /**
   * Save discovered companies to database
   */
  async saveDiscoveredCompanies(verifiedCompanies) {
    try {
      for (const [atsType, companies] of Object.entries(verifiedCompanies)) {
        for (const company of companies) {
          await prisma.discoveredCompany.upsert({
            where: {
              atsType_slug: {
                atsType: atsType.toUpperCase(),
                slug: company.slug
              }
            },
            create: {
              atsType: atsType.toUpperCase(),
              slug: company.slug,
              name: this.slugToName(company.slug),
              discoveredAt: new Date(),
              lastFetchedAt: new Date(),
              isActive: true,
              totalJobs: company.jobCount
            },
            update: {
              lastFetchedAt: new Date(),
              isActive: true,
              totalJobs: company.jobCount
            }
          });
        }
      }

      logger.info('💾 Saved discovered companies to database');

    } catch (error) {
      logger.error(`Failed to save companies: ${error.message}`);
    }
  }

  /**
   * Check if slug is a valid company (not a generic page)
   */
  isValidCompanySlug(slug) {
    const invalidSlugs = [
      'embed', 'widget', 'api', 'jobs', 'careers', 'about',
      'login', 'signup', 'register', 'apply', 'search', 'browse',
      'undefined', 'null', 'internal', 'external', 'test'
    ];

    return slug.length > 1 &&
           slug.length < 50 &&
           !invalidSlugs.includes(slug) &&
           /^[a-z0-9-]+$/.test(slug);
  }

  /**
   * Convert slug to readable name
   */
  slugToName(slug) {
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Delay helper
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Alternative discovery using direct API exploration
   * This method doesn't require browser/Google - just tests known patterns
   */
  async discoverViaAPIExploration(options = {}) {
    const {
      prefixes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
                  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'],
      atsTypes = ['greenhouse', 'ashby']
    } = options;

    logger.info('🔍 Starting API exploration discovery...');

    // This is a fallback method that doesn't use Google
    // It tries common company name patterns
    const commonCompanies = [
      // Tech giants
      'google', 'meta', 'amazon', 'apple', 'microsoft', 'netflix', 'spotify',
      // Unicorns
      'stripe', 'airbnb', 'doordash', 'instacart', 'robinhood', 'coinbase',
      'figma', 'notion', 'linear', 'vercel', 'netlify', 'supabase',
      // AI companies
      'anthropic', 'openai', 'cohere', 'huggingface', 'replicate', 'scale',
      // Fintech
      'plaid', 'ramp', 'brex', 'mercury', 'chime', 'affirm',
      // Enterprise
      'datadog', 'mongodb', 'elastic', 'snowflake', 'databricks', 'hashicorp'
    ];

    const discovered = {
      greenhouse: [],
      lever: [],
      ashby: [],
      workable: []
    };

    for (const atsType of atsTypes) {
      const config = ATS_SEARCH_CONFIGS.find(c => c.name === atsType);
      if (!config) continue;

      logger.info(`Testing ${commonCompanies.length} companies on ${atsType}...`);

      for (const company of commonCompanies) {
        try {
          const apiUrl = config.apiTemplate.replace('{slug}', company);
          const response = await fetch(apiUrl, {
            signal: AbortSignal.timeout(3000)
          });

          if (response.ok) {
            const data = await response.json();
            const jobCount = this.getJobCount(data, atsType);

            if (jobCount > 0) {
              discovered[atsType].push({ slug: company, jobCount });
              logger.info(`   ✅ ${company}: ${jobCount} jobs on ${atsType}`);
            }
          }
        } catch (error) {
          // Skip
        }

        await this.delay(50);
      }
    }

    return discovered;
  }
}

export default new GoogleCompanyDiscovery();
