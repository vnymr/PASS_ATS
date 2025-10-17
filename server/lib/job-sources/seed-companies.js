/**
 * Seed Companies
 *
 * Initial list of high-quality companies using Greenhouse/Lever
 * This bootstraps the system before discovery kicks in
 */

export const GREENHOUSE_COMPANIES = [
  // Top Tech Companies
  'stripe', 'airbnb', 'coinbase', 'robinhood', 'databricks',
  'figma', 'notion', 'lattice', 'webflow', 'segment',

  // AI & ML
  'anthropic', 'cohere', 'huggingface', 'replicate', 'modal',

  // Developer Tools
  'vercel', 'netlify', 'render', 'supabase', 'planetscale',
  'temporal', 'retool', 'hex', 'replit',

  // Fintech
  'plaid', 'brex', 'ramp', 'mercury', 'checkout',
  'affirm', 'marqeta', 'unit', 'increase',

  // Infrastructure
  'hashicorp', 'pulumi', 'datadog', 'sentry',

  // Collaboration
  'airtable', 'loom', 'calendly', 'superhuman', 'front',
  'linear', 'height', 'cycle',

  // Commerce
  'faire', 'whatnot', 'poshmark',

  // Others
  'grammarly', 'discord', 'gusto', 'rippling', 'clerk'
];

export const LEVER_COMPANIES = [
  // FAANG-tier
  'netflix', 'uber', 'lyft', 'shopify', 'reddit',
  'pinterest', 'cloudflare', 'atlassian', 'dropbox', 'zoom',

  // Enterprise SaaS
  'hubspot', 'zendesk', 'intercom', 'gong', 'outreach',

  // Developer Platforms
  'docker', 'circleci', 'buildkite',

  // Crypto & Web3
  'opensea', 'uniswap',

  // Fintech
  'klarna', 'revolut', 'n26',

  // Work & HR Tech
  'twilio', 'sendgrid',

  // Remote Work
  'deel', 'remote', 'oyster',

  // Others
  'scale', 'pagerduty'
];

export const ASHBY_COMPANIES = [
  'linear', 'anduril', 'ramp', 'vanta'
];

/**
 * Get all seed companies by ATS type
 */
export function getSeedCompanies() {
  return {
    greenhouse: GREENHOUSE_COMPANIES,
    lever: LEVER_COMPANIES,
    ashby: ASHBY_COMPANIES
  };
}

/**
 * Total number of seed companies
 */
export const TOTAL_SEED_COMPANIES =
  GREENHOUSE_COMPANIES.length +
  LEVER_COMPANIES.length +
  ASHBY_COMPANIES.length;
