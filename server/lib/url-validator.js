/**
 * URL Validator for Auto-Apply System
 * Validates job URLs against trusted ATS domains
 * Prevents SSRF and malicious URL injection
 */

import logger from './logger.js';

// Whitelist of trusted ATS domains
const TRUSTED_ATS_DOMAINS = [
  // Greenhouse
  'greenhouse.io',
  'boards.greenhouse.io',

  // Lever
  'lever.co',
  'jobs.lever.co',

  // Workday
  'myworkdayjobs.com',
  'wd1.myworkdayjobs.com',
  'wd5.myworkdayjobs.com',

  // Ashby
  'jobs.ashbyhq.com',
  'ashbyhq.com',

  // BambooHR
  'bamboohr.com',

  // JazzHR
  'applytojob.com',
  'jazz.co',

  // SmartRecruiters
  'jobs.smartrecruiters.com',
  'smartrecruiters.com',

  // iCIMS
  'icims.com',

  // Taleo
  'taleo.net',

  // SuccessFactors (SAP)
  'successfactors.com',
  'successfactors.eu',

  // ADP
  'jobs.adp.com',

  // UKG (UltiPro)
  'ultipro.com',
  'recruiting.ultipro.com',

  // Jobvite
  'jobvite.com',

  // Breezy HR
  'breezy.hr',

  // Recruitee
  'recruitee.com',

  // Fountain
  'fountain.com',

  // Indeed Apply
  'indeed.com',
  'apply.indeed.com'
];

// Additional patterns for custom career pages
const TRUSTED_URL_PATTERNS = [
  /^https:\/\/careers\.[a-zA-Z0-9-]+\.(com|io|co|org)\//,  // careers.company.com
  /^https:\/\/jobs\.[a-zA-Z0-9-]+\.(com|io|co|org)\//,     // jobs.company.com
  /^https:\/\/[a-zA-Z0-9-]+\.(com|io|co|org)\/careers\//,  // company.com/careers
  /^https:\/\/[a-zA-Z0-9-]+\.(com|io|co|org)\/jobs\//      // company.com/jobs
];

/**
 * Validate job URL
 * @param {string} url - The job URL to validate
 * @returns {Object} { valid: boolean, error: string|null, sanitizedUrl: string|null }
 */
export function validateJobUrl(url) {
  if (!url || typeof url !== 'string') {
    return {
      valid: false,
      error: 'URL is required and must be a string',
      sanitizedUrl: null
    };
  }

  // Trim whitespace
  url = url.trim();

  // Check URL length (prevent DoS)
  if (url.length > 2048) {
    return {
      valid: false,
      error: 'URL exceeds maximum length of 2048 characters',
      sanitizedUrl: null
    };
  }

  // Parse URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (error) {
    return {
      valid: false,
      error: `Invalid URL format: ${error.message}`,
      sanitizedUrl: null
    };
  }

  // Only allow HTTPS (security requirement)
  if (parsedUrl.protocol !== 'https:') {
    return {
      valid: false,
      error: 'Only HTTPS URLs are allowed for security reasons',
      sanitizedUrl: null
    };
  }

  // Prevent localhost/private IP addresses (SSRF protection)
  const hostname = parsedUrl.hostname.toLowerCase();

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.16.') ||
    hostname.startsWith('172.17.') ||
    hostname.startsWith('172.18.') ||
    hostname.startsWith('172.19.') ||
    hostname.startsWith('172.2') ||
    hostname.startsWith('172.30.') ||
    hostname.startsWith('172.31.') ||
    hostname.startsWith('169.254.') ||  // Link-local
    hostname === '0.0.0.0'
  ) {
    return {
      valid: false,
      error: 'Private/localhost URLs are not allowed',
      sanitizedUrl: null
    };
  }

  // CRITICAL: Check for ATS-specific URL parameters first (many companies use ATS on custom domains)

  // Greenhouse detection: gh_jid parameter or boards.greenhouse.io subdomain
  if (url.includes('gh_jid=') || hostname.includes('greenhouse.io')) {
    logger.debug({ hostname, url, ats: 'greenhouse' }, 'URL identified as Greenhouse job');
    return {
      valid: true,
      error: null,
      sanitizedUrl: parsedUrl.href,
      domain: hostname,
      category: 'greenhouse_job',
      atsType: 'greenhouse'
    };
  }

  // Lever detection: lever.co domain or /jobs/lever/ pattern
  if (hostname.includes('lever.co') || url.includes('/jobs/lever/')) {
    logger.debug({ hostname, url, ats: 'lever' }, 'URL identified as Lever job');
    return {
      valid: true,
      error: null,
      sanitizedUrl: parsedUrl.href,
      domain: hostname,
      category: 'lever_job',
      atsType: 'lever'
    };
  }

  // iCIMS detection: icims.com domain
  if (hostname.includes('icims.com')) {
    logger.debug({ hostname, url, ats: 'icims' }, 'URL identified as iCIMS job');
    return {
      valid: true,
      error: null,
      sanitizedUrl: parsedUrl.href,
      domain: hostname,
      category: 'icims_job',
      atsType: 'icims'
    };
  }

  // Workday detection: myworkdayjobs.com domain
  if (hostname.includes('myworkdayjobs.com')) {
    logger.debug({ hostname, url, ats: 'workday' }, 'URL identified as Workday job');
    return {
      valid: true,
      error: null,
      sanitizedUrl: parsedUrl.href,
      domain: hostname,
      category: 'workday_job',
      atsType: 'workday'
    };
  }

  // Ashby detection: ashbyhq.com domain
  if (hostname.includes('ashbyhq.com')) {
    logger.debug({ hostname, url, ats: 'ashby' }, 'URL identified as Ashby job');
    return {
      valid: true,
      error: null,
      sanitizedUrl: parsedUrl.href,
      domain: hostname,
      category: 'ashby_job',
      atsType: 'ashby'
    };
  }

  // Check against trusted domains (legacy support)
  const isTrustedDomain = TRUSTED_ATS_DOMAINS.some(trustedDomain =>
    hostname === trustedDomain || hostname.endsWith(`.${trustedDomain}`)
  );

  if (isTrustedDomain) {
    logger.debug({ hostname, url }, 'URL matches trusted ATS domain');
    return {
      valid: true,
      error: null,
      sanitizedUrl: parsedUrl.href,
      domain: hostname,
      category: 'trusted_ats'
    };
  }

  // Check against trusted URL patterns (career pages)
  const matchesPattern = TRUSTED_URL_PATTERNS.some(pattern =>
    pattern.test(url)
  );

  if (matchesPattern) {
    logger.debug({ hostname, url }, 'URL matches trusted career page pattern');
    return {
      valid: true,
      error: null,
      sanitizedUrl: parsedUrl.href,
      domain: hostname,
      category: 'career_page',
      requiresReview: true // Flag for manual review if needed
    };
  }

  // URL does not match any trusted domain/pattern
  logger.warn({ hostname, url }, 'URL does not match trusted domains or patterns');

  return {
    valid: false,
    error: `Domain "${hostname}" is not in the trusted ATS whitelist. Please contact support to add this domain.`,
    sanitizedUrl: null,
    domain: hostname
  };
}

/**
 * Add custom domain to whitelist (for admin use)
 * @param {string} domain - Domain to add
 * @returns {boolean} Success status
 */
export function addTrustedDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    return false;
  }

  domain = domain.toLowerCase().trim();

  // Validate domain format
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*)*\.[a-zA-Z]{2,}$/;

  if (!domainRegex.test(domain)) {
    logger.error({ domain }, 'Invalid domain format');
    return false;
  }

  if (TRUSTED_ATS_DOMAINS.includes(domain)) {
    logger.debug({ domain }, 'Domain already in whitelist');
    return true;
  }

  TRUSTED_ATS_DOMAINS.push(domain);
  logger.info({ domain }, 'Added domain to trusted whitelist');

  return true;
}

/**
 * Get list of trusted domains
 * @returns {string[]} Array of trusted domains
 */
export function getTrustedDomains() {
  return [...TRUSTED_ATS_DOMAINS];
}

export default {
  validateJobUrl,
  addTrustedDomain,
  getTrustedDomains
};
