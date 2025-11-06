/**
 * Aggregator Detector
 * Detects if a URL is from a job aggregator (vs direct company posting)
 * Helps filter out jobs that redirect through multiple sites
 */

import logger from './logger.js';

class AggregatorDetector {
  constructor() {
    // List of known job aggregators (not direct application pages)
    this.aggregatorDomains = [
      // Major Job Boards (aggregators)
      'remotive.com',
      'remoteco.com',
      'remote.co',
      'weworkremotely.com',
      'remoteok.io',
      'remoteok.com',
      'flexjobs.com',
      'dice.com',
      'monster.com',
      'careerbuilder.com',
      'simplyhired.com',

      // Job Listing Aggregators (redirect to other sites)
      'jooble.org',
      'neuvoo.com',
      'adzuna.com',
      'jobs2careers.com',
      'talent.com',
      'getwork.com',
      'snagajob.com',

      // Recruiter/Staffing Aggregators
      'robert-half.com',
      'kellyservices.com',
      'allegisgroup.com',
      'randstad.com',
      'manpowergroup.com',

      // Company Review Sites (job listings are often outdated)
      'comparably.com',

      // RSS Feed Aggregators
      'feedburner.com',
      'rss.app'
    ];

    // Patterns for aggregator URLs (redirect pages)
    this.aggregatorPatterns = [
      /\/redirect\?/i,
      /\/out\?/i,
      /\/click\?/i,
      /\/track\?/i,
      /\/apply\?url=/i,
      /job-boards\?redirect/i
    ];
  }

  /**
   * Check if a URL is from an aggregator
   * @param {string} url - Job URL to check
   * @returns {Object} { isAggregator: boolean, reason: string|null, domain: string|null }
   */
  isAggregator(url) {
    if (!url || typeof url !== 'string') {
      return { isAggregator: false, reason: null, domain: null };
    }

    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();

      // Remove 'www.' prefix for matching
      const cleanHostname = hostname.replace(/^www\./, '');

      // Check against known aggregator domains
      for (const aggregatorDomain of this.aggregatorDomains) {
        if (cleanHostname === aggregatorDomain || cleanHostname.endsWith(`.${aggregatorDomain}`)) {
          return {
            isAggregator: true,
            reason: `Domain ${cleanHostname} is a known job aggregator`,
            domain: cleanHostname
          };
        }
      }

      // Check for redirect patterns in URL
      for (const pattern of this.aggregatorPatterns) {
        if (pattern.test(url)) {
          return {
            isAggregator: true,
            reason: `URL contains aggregator redirect pattern: ${pattern.toString()}`,
            domain: cleanHostname
          };
        }
      }

      // Not an aggregator
      return { isAggregator: false, reason: null, domain: cleanHostname };

    } catch (error) {
      logger.warn({ url, error: error.message }, 'Failed to parse URL in aggregator detector');
      return { isAggregator: false, reason: null, domain: null };
    }
  }

  /**
   * Check if source name indicates an aggregator
   * @param {string} source - Source name (e.g., 'remotive', 'greenhouse', 'lever')
   * @returns {boolean}
   */
  isAggregatorSource(source) {
    if (!source) return false;

    const aggregatorSources = [
      'remotive',
      'remote.co',
      'weworkremotely',
      'remoteok',
      'flexjobs',
      'dice',
      'monster',
      'careerbuilder',
      'simplyhired',
      'jooble',
      'neuvoo',
      'adzuna',
      'talent',
      'jsearch' // JSearch aggregates Indeed, LinkedIn, Glassdoor
    ];

    return aggregatorSources.includes(source.toLowerCase());
  }

  /**
   * Get direct application platforms (ATS we support)
   * @returns {string[]}
   */
  getDirectPlatforms() {
    return [
      'greenhouse',
      'lever',
      'ashby',
      'workable',
      'recruitee',
      'breezyhr',
      'teamtailor',
      'smartrecruiters',
      'bamboohr',
      'linkedin_easy_apply',
      'indeed_quick_apply',
      'glassdoor_easy_apply',
      'ziprecruiter',
      'angellist',
      'wellfound'
    ];
  }

  /**
   * Determine if a job should be shown based on source and URL
   * @param {Object} job - Job object with source and applyUrl
   * @returns {Object} { shouldShow: boolean, reason: string }
   */
  shouldShowJob(job) {
    if (!job) {
      return { shouldShow: false, reason: 'No job data provided' };
    }

    // Check source
    if (this.isAggregatorSource(job.source)) {
      // However, if the applyUrl points to a direct ATS platform, we can keep it
      const urlCheck = this.isAggregator(job.applyUrl);

      if (!urlCheck.isAggregator && this.isDirectATSUrl(job.applyUrl)) {
        return {
          shouldShow: true,
          reason: `Source is aggregator (${job.source}) but URL points to direct ATS platform`
        };
      }

      return {
        shouldShow: false,
        reason: `Source ${job.source} is a job aggregator, not a direct posting`
      };
    }

    // Check URL
    const urlCheck = this.isAggregator(job.applyUrl);
    if (urlCheck.isAggregator) {
      return {
        shouldShow: false,
        reason: urlCheck.reason
      };
    }

    // Passed all checks
    return { shouldShow: true, reason: 'Direct job posting' };
  }

  /**
   * Check if URL is a direct ATS platform URL
   * @param {string} url
   * @returns {boolean}
   */
  isDirectATSUrl(url) {
    if (!url) return false;

    const directATSPatterns = [
      /boards\.greenhouse\.io/i,
      /jobs\.lever\.co/i,
      /jobs\.ashbyhq\.com/i,
      /apply\.workable\.com/i,
      /recruitee\.com\/careers/i,
      /\.breezy\.hr/i,
      /jobs\.teamtailor\.com/i,
      /jobs\.smartrecruiters\.com/i,
      /bamboohr\.com\/jobs/i,
      /linkedin\.com\/jobs\/view.*easy-apply/i,
      /indeed\.com\/.*\/apply/i,
      /glassdoor\.com\/.*easy-apply/i,
      /ziprecruiter\.com\/jobs/i,
      /angel\.co\/.*\/jobs/i,
      /wellfound\.com\/.*\/jobs/i
    ];

    return directATSPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Batch check multiple jobs
   * @param {Array} jobs - Array of job objects
   * @returns {Array} Filtered array of jobs that should be shown
   */
  filterJobs(jobs) {
    if (!Array.isArray(jobs)) return [];

    return jobs.filter(job => {
      const check = this.shouldShowJob(job);
      if (!check.shouldShow) {
        logger.debug({ jobId: job.id, source: job.source, url: job.applyUrl, reason: check.reason },
          'Filtering out aggregator job');
      }
      return check.shouldShow;
    });
  }

  /**
   * Get statistics on aggregator vs direct jobs
   * @param {Array} jobs - Array of job objects
   * @returns {Object} Stats
   */
  getStats(jobs) {
    if (!Array.isArray(jobs)) return { total: 0, direct: 0, aggregator: 0 };

    let direct = 0;
    let aggregator = 0;

    jobs.forEach(job => {
      const check = this.shouldShowJob(job);
      if (check.shouldShow) {
        direct++;
      } else {
        aggregator++;
      }
    });

    return {
      total: jobs.length,
      direct,
      aggregator,
      directPercent: jobs.length > 0 ? Math.round((direct / jobs.length) * 100) : 0
    };
  }
}

// Export singleton instance
export default new AggregatorDetector();
