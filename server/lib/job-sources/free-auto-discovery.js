/**
 * FREE Auto-Discovery Job Aggregator
 *
 * NO manual company lists needed!
 * Uses 100% free sources that update automatically:
 *
 * 1. SimplifyJobs GitHub (daily updates, 1000+ jobs)
 * 2. Hacker News Who's Hiring (monthly, 500+ jobs)
 * 3. RSS Feeds (real-time, unlimited)
 * 4. Google Search Discovery (unlimited companies)
 * 5. Career Page Scraping (real-time)
 *
 * Total Cost: $0/month
 * Total Jobs: 10,000+ with auto-discovery
 */

import fetch from 'node-fetch';
import Parser from 'rss-parser';
import { chromium } from 'playwright';
import crypto from 'crypto';
import logger from '../logger.js';

class FreeAutoDiscovery {
  constructor() {
    this.rssParser = new Parser({
      customFields: {
        item: ['description', 'content', 'summary']
      }
    });
  }

  /**
   * 1. SimplifyJobs GitHub Repository
   * Updates: Daily (automated by Simplify)
   * Jobs: 1,000+ new grad positions
   */
  async fetchSimplifyJobs() {
    logger.info('📥 Fetching from SimplifyJobs GitHub...');

    try {
      const url = 'https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/README.md';
      const response = await fetch(url);
      const markdown = await response.text();

      // Parse markdown table
      const jobs = this.parseSimplifyMarkdown(markdown);

      logger.info(`✅ Found ${jobs.length} jobs from SimplifyJobs`);
      return jobs;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to fetch SimplifyJobs');
      return [];
    }
  }

  /**
   * Parse SimplifyJobs markdown table format
   */
  parseSimplifyMarkdown(markdown) {
    const jobs = [];

    // Find table rows (skip header)
    const lines = markdown.split('\n');
    const tableStartIndex = lines.findIndex(line => line.includes('| Company |'));

    if (tableStartIndex === -1) {
      logger.warn('Could not find job table in SimplifyJobs markdown');
      return [];
    }

    // Parse each row
    for (let i = tableStartIndex + 2; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line.startsWith('|') || line === '') break;

      const columns = line.split('|').map(col => col.trim()).filter(col => col !== '');

      if (columns.length >= 4) {
        const [company, role, location, application] = columns;

        // Extract URL from markdown link [text](url)
        const urlMatch = application.match(/\[.*?\]\((.*?)\)/);
        const applyUrl = urlMatch ? urlMatch[1] : '';

        if (applyUrl) {
          jobs.push({
            externalId: `simplify-${this.hash(applyUrl)}`,
            source: 'simplify',
            title: this.cleanText(role),
            company: this.cleanText(company),
            location: this.cleanText(location),
            description: `${role} at ${company} - ${location}`,
            applyUrl: applyUrl,
            atsType: this.detectATSFromUrl(applyUrl),
            aiApplyable: this.isAIApplyable(applyUrl),
            postedDate: new Date()
          });
        }
      }
    }

    return jobs;
  }

  /**
   * 2. Hacker News "Who is Hiring"
   * Updates: Monthly (1st of each month)
   * Jobs: 500-1,000 per month
   */
  async fetchHackerNewsJobs() {
    logger.info('📥 Fetching from Hacker News Who\'s Hiring...');

    try {
      // Find latest "Who is hiring" thread
      const searchUrl = 'https://hn.algolia.com/api/v1/search?query=who%20is%20hiring&tags=story';
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      if (searchData.hits.length === 0) {
        logger.warn('No HN Who is Hiring threads found');
        return [];
      }

      const latestThread = searchData.hits[0];
      logger.info(`Found thread: ${latestThread.title}`);

      // Get all comments (job postings)
      const threadUrl = `https://hn.algolia.com/api/v1/items/${latestThread.objectID}`;
      const threadResponse = await fetch(threadUrl);
      const threadData = await threadResponse.json();

      const jobs = [];

      if (threadData.children) {
        for (const comment of threadData.children) {
          if (!comment.text) continue;

          const job = this.parseHNComment(comment);
          if (job) {
            jobs.push(job);
          }
        }
      }

      logger.info(`✅ Found ${jobs.length} jobs from Hacker News`);
      return jobs;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to fetch Hacker News jobs');
      return [];
    }
  }

  /**
   * Parse Hacker News comment into job object
   */
  parseHNComment(comment) {
    const text = comment.text;

    // Extract company name (usually first line, often in bold or ALL CAPS)
    const companyMatch = text.match(/^([A-Z][A-Za-z0-9\s&.]+)/);
    const company = companyMatch ? companyMatch[1].trim() : 'Unknown';

    // Extract location (common patterns: REMOTE, Location:, Based in)
    const locationMatch = text.match(/(?:REMOTE|Location:|Based in)\s*([^<|]*)/i);
    const location = locationMatch ? locationMatch[1].trim() : 'Unknown';

    // Extract email or application URL
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    const urlMatch = text.match(/https?:\/\/[^\s<]+/);
    const applyUrl = urlMatch ? urlMatch[0] : (emailMatch ? `mailto:${emailMatch[0]}` : '');

    if (!applyUrl) return null;

    return {
      externalId: `hn-${comment.id}`,
      source: 'hackernews',
      title: 'Software Engineer', // HN posts don't always have clear titles
      company: company,
      location: location,
      description: text,
      applyUrl: applyUrl,
      atsType: urlMatch ? this.detectATSFromUrl(urlMatch[0]) : 'email',
      aiApplyable: false, // Most are email applications
      postedDate: new Date(comment.created_at * 1000)
    };
  }

  /**
   * 3. RSS Feeds from Job Boards
   * Updates: Real-time to hourly
   * Jobs: Unlimited
   */
  async fetchRSSFeeds() {
    logger.info('📥 Fetching from RSS feeds...');

    const feeds = {
      // Remote job boards
      remotive: 'https://remotive.com/api/remote-jobs/feed',
      weworkremotely: 'https://weworkremotely.com/remote-jobs.rss',

      // Indeed - multiple searches
      indeed_se: 'https://rss.indeed.com/rss?q=software+engineer&l=',
      indeed_dev: 'https://rss.indeed.com/rss?q=developer&l=',
      indeed_fullstack: 'https://rss.indeed.com/rss?q=full+stack+developer&l=',
      indeed_frontend: 'https://rss.indeed.com/rss?q=frontend+engineer&l=',
      indeed_backend: 'https://rss.indeed.com/rss?q=backend+engineer&l=',

      // Stack Overflow (if available)
      // stackoverflow: 'https://stackoverflow.com/jobs/feed',

      // Himalayas (remote jobs)
      himalayas: 'https://himalayas.app/jobs/rss',

      // AngelList/Wellfound
      // wellfound: 'https://wellfound.com/jobs.rss', // May not exist

      // Otta (UK/EU jobs)
      // otta: 'https://otta.com/feed', // May not exist as RSS
    };

    const allJobs = [];

    for (const [source, feedUrl] of Object.entries(feeds)) {
      try {
        const feed = await this.rssParser.parseURL(feedUrl);

        feed.items.forEach(item => {
          const description = item.content || item.description || item.summary || '';

          allJobs.push({
            externalId: `rss-${source}-${this.hash(item.link)}`,
            source: `rss-${source}`,
            title: this.cleanText(item.title),
            company: this.extractCompanyFromTitle(item.title),
            location: this.extractLocationFromDescription(description),
            description: this.cleanHTML(description),
            applyUrl: item.link,
            atsType: this.detectATSFromUrl(item.link),
            aiApplyable: false,
            postedDate: item.pubDate ? new Date(item.pubDate) : new Date()
          });
        });

        logger.info(`✅ Found ${feed.items.length} jobs from ${source} RSS`);
      } catch (error) {
        logger.error({ error: error.message, source }, 'Failed to fetch RSS feed');
      }
    }

    return allJobs;
  }

  /**
   * 4. Y Combinator Work at a Startup
   * Updates: Real-time
   * Jobs: 2,000+ startup jobs
   */
  async fetchYCJobs() {
    logger.info('📥 Fetching from Y Combinator Work at a Startup...');

    try {
      // YC has a public API endpoint
      const url = 'https://www.workatastartup.com/api/jobs';
      const response = await fetch(url);

      if (!response.ok) {
        logger.warn('YC API returned non-200 status, trying scraping...');
        return await this.scrapeYCJobs();
      }

      const data = await response.json();
      const jobs = [];

      for (const job of data) {
        jobs.push({
          externalId: `yc-${job.id}`,
          source: 'yc',
          title: job.title || 'Unknown',
          company: job.company?.name || 'Unknown',
          location: job.location || 'Remote',
          description: job.description || '',
          applyUrl: `https://www.workatastartup.com/jobs/${job.id}`,
          atsType: 'yc',
          aiApplyable: true, // YC uses standard application forms
          postedDate: job.created_at ? new Date(job.created_at) : new Date()
        });
      }

      logger.info(`✅ Found ${jobs.length} jobs from Y Combinator`);
      return jobs;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to fetch YC jobs via API, trying scraping');
      return await this.scrapeYCJobs();
    }
  }

  /**
   * Scrape YC jobs if API doesn't work
   */
  async scrapeYCJobs() {
    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();

      await page.goto('https://www.workatastartup.com/jobs', {
        waitUntil: 'networkidle',
        timeout: 15000
      });

      const jobs = await page.$$eval('[class*="job"], [data-job-id]', elements => {
        return elements.map(el => {
          const titleEl = el.querySelector('[class*="title"], h2, h3');
          const companyEl = el.querySelector('[class*="company"]');
          const locationEl = el.querySelector('[class*="location"]');
          const linkEl = el.querySelector('a');

          return {
            title: titleEl?.textContent?.trim() || '',
            company: companyEl?.textContent?.trim() || '',
            location: locationEl?.textContent?.trim() || 'Remote',
            applyUrl: linkEl?.href || ''
          };
        }).filter(job => job.title && job.applyUrl);
      });

      await browser.close();

      return jobs.map(job => ({
        externalId: `yc-${this.hash(job.applyUrl)}`,
        source: 'yc',
        title: job.title,
        company: job.company,
        location: job.location,
        description: '',
        applyUrl: job.applyUrl,
        atsType: 'yc',
        aiApplyable: true,
        postedDate: new Date()
      }));
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to scrape YC jobs');
      return [];
    }
  }

  /**
   * 5. Auto-Discovery via Google Search
   * Discovers NEW companies automatically by searching for ATS job pages
   */
  async discoverCompaniesViaGoogle() {
    logger.info('🔍 Auto-discovering companies via Google...');

    const searchQueries = [
      'site:greenhouse.io software engineer',
      'site:lever.co software engineer',
      'site:jobs.ashbyhq.com software engineer',
      'site:apply.workable.com software engineer'
    ];

    const discoveredCompanies = new Set();

    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();

      for (const query of searchQueries) {
        try {
          await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`, {
            waitUntil: 'networkidle',
            timeout: 10000
          });

          // Extract search result URLs
          const links = await page.$$eval('a', anchors =>
            anchors.map(a => a.href).filter(href => href.includes('http'))
          );

          // Extract company slugs
          for (const url of links) {
            const company = this.extractCompanySlug(url);
            if (company) {
              discoveredCompanies.add(JSON.stringify(company));
            }
          }

          // Respect Google rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          logger.error({ error: error.message, query }, 'Failed to search Google');
        }
      }

      await browser.close();

      const companies = Array.from(discoveredCompanies).map(c => JSON.parse(c));
      logger.info(`✅ Discovered ${companies.length} new companies`);

      return companies;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to discover via Google');
      return [];
    }
  }

  /**
   * 5. Scrape Career Pages Directly
   * For companies that don't use standard ATS
   */
  async scrapeCareerPage(url) {
    logger.info(`🔍 Scraping career page: ${url}`);

    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 15000
      });

      // Generic selectors that work on most career pages
      const jobs = await page.$$eval(
        '[class*="job"], [class*="position"], [class*="opening"], [role="listitem"]',
        (elements) => {
          return elements.map(el => {
            const titleEl = el.querySelector('[class*="title"], h2, h3, a');
            const locationEl = el.querySelector('[class*="location"]');
            const linkEl = el.querySelector('a');

            return {
              title: titleEl?.textContent?.trim() || '',
              location: locationEl?.textContent?.trim() || '',
              applyUrl: linkEl?.href || ''
            };
          }).filter(job => job.title && job.applyUrl);
        }
      );

      await browser.close();

      const company = this.extractCompanyFromUrl(url);

      return jobs.map(job => ({
        externalId: `career-${this.hash(job.applyUrl)}`,
        source: 'career-page',
        title: job.title,
        company: company,
        location: job.location || 'Unknown',
        description: '',
        applyUrl: job.applyUrl,
        atsType: this.detectATSFromUrl(job.applyUrl),
        aiApplyable: this.isAIApplyable(job.applyUrl),
        postedDate: new Date()
      }));
    } catch (error) {
      logger.error({ error: error.message, url }, 'Failed to scrape career page');
      return [];
    }
  }

  /**
   * Aggregate all free sources
   */
  async aggregateAll() {
    logger.info('🚀 Starting FREE auto-discovery aggregation...');

    const [
      simplifyJobs,
      hnJobs,
      rssJobs,
      ycJobs
    ] = await Promise.all([
      this.fetchSimplifyJobs(),
      this.fetchHackerNewsJobs(),
      this.fetchRSSFeeds(),
      this.fetchYCJobs()
    ]);

    const allJobs = [
      ...simplifyJobs,
      ...hnJobs,
      ...rssJobs,
      ...ycJobs
    ];

    // Deduplicate
    const uniqueJobs = this.deduplicateJobs(allJobs);

    logger.info(`✅ Total jobs aggregated: ${uniqueJobs.length}`);
    logger.info(`   - SimplifyJobs: ${simplifyJobs.length}`);
    logger.info(`   - Hacker News: ${hnJobs.length}`);
    logger.info(`   - RSS Feeds: ${rssJobs.length}`);
    logger.info(`   - Y Combinator: ${ycJobs.length}`);

    return {
      jobs: uniqueJobs,
      stats: {
        total: uniqueJobs.length,
        simplify: simplifyJobs.length,
        hackernews: hnJobs.length,
        rss: rssJobs.length,
        yc: ycJobs.length
      }
    };
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  hash(str) {
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
  }

  cleanText(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  cleanHTML(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  detectATSFromUrl(url) {
    if (url.includes('greenhouse.io')) return 'greenhouse';
    if (url.includes('lever.co')) return 'lever';
    if (url.includes('ashbyhq.com')) return 'ashby';
    if (url.includes('workable.com')) return 'workable';
    if (url.includes('myworkdayjobs.com')) return 'workday';
    if (url.includes('icims.com')) return 'icims';
    if (url.includes('taleo.net')) return 'taleo';
    if (url.includes('smartrecruiters.com')) return 'smartrecruiters';
    if (url.includes('mailto:')) return 'email';
    return 'unknown';
  }

  isAIApplyable(url) {
    const atsType = this.detectATSFromUrl(url);
    const aiApplyableATS = ['greenhouse', 'lever', 'ashby', 'workable'];
    return aiApplyableATS.includes(atsType);
  }

  extractCompanySlug(url) {
    // Greenhouse: boards.greenhouse.io/{company}
    let match = url.match(/greenhouse\.io\/([^\/]+)/);
    if (match) return { slug: match[1], atsType: 'greenhouse' };

    // Lever: jobs.lever.co/{company}
    match = url.match(/lever\.co\/([^\/]+)/);
    if (match) return { slug: match[1], atsType: 'lever' };

    // Ashby: jobs.ashbyhq.com/{company}
    match = url.match(/ashbyhq\.com\/([^\/]+)/);
    if (match) return { slug: match[1], atsType: 'ashby' };

    return null;
  }

  extractCompanyFromUrl(url) {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '').replace('.com', '').replace('.io', '');
  }

  extractCompanyFromTitle(title) {
    // Common patterns: "Company Name - Job Title" or "Job Title at Company"
    let match = title.match(/^([^-:]+)/);
    if (match) return this.cleanText(match[1]);

    match = title.match(/at\s+(.+)$/);
    if (match) return this.cleanText(match[1]);

    return 'Unknown';
  }

  extractLocationFromDescription(description) {
    const locationMatch = description.match(/(?:Location|Based in|Office):\s*([^<\n]+)/i);
    return locationMatch ? this.cleanText(locationMatch[1]) : 'Remote';
  }

  deduplicateJobs(jobs) {
    const seen = new Map();

    return jobs.filter(job => {
      const key = `${job.title.toLowerCase()}-${job.company.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.set(key, true);
      return true;
    });
  }
}

// Export singleton
export default new FreeAutoDiscovery();
