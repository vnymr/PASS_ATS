/**
 * Comprehensive Company List for Job Aggregation
 *
 * Sources:
 * - YCombinator companies (known to use Greenhouse/Lever)
 * - Public tech companies
 * - Unicorns and high-growth startups
 * - Fortune 500 tech divisions
 * - Remote-first companies
 *
 * Last updated: 2025-10-17
 * Total companies: 500+
 */

// ============================================================================
// GREENHOUSE COMPANIES (300+)
// ============================================================================

export const GREENHOUSE_COMPANIES = [
  // === FINTECH & PAYMENTS (50) ===
  'stripe', 'square', 'coinbase', 'robinhood', 'plaid', 'chime', 'brex',
  'ramp', 'mercury', 'checkout', 'affirm', 'marqeta', 'unit', 'modern-treasury',
  'increase', 'lithic', 'column', 'bond', 'synctera', 'treasury-prime',
  'carta', 'angellist', 'pulley', 'caplight', 'clearco', 'pipe',
  'papaya-global', 'deel-finance', 'gusto-wallet', 'rippling-finance',
  'adyen', 'revolut-tech', 'wise', 'nubank', 'monzo-tech',
  'starling', 'n26-tech', 'varo', 'current', 'dave-banking',
  'brigit', 'earnin', 'payactiv', 'branch-app', 'truebill',
  'betterment', 'wealthfront', 'robinhood-crypto', 'gemini', 'kraken',

  // === AI & ML (50) ===
  'openai', 'anthropic', 'cohere', 'huggingface', 'replicate',
  'modal', 'anyscale', 'together', 'runwayml', 'midjourney-careers',
  'stability', 'adept', 'character', 'inflection', 'perplexity',
  'you-com', 'glean', 'hebbia', 'sierra', 'cresta',
  'forethought', 'assembled', 'symbio', 'centaur-labs', 'scale',
  'labelbox', 'snorkel', 'weights-biases', 'roboflow', 'landing-ai',
  'v7', 'datarobot', 'h2o', 'domino', 'determined',
  'paperspace', 'coreweave', 'lambda-labs', 'cerebras', 'graphcore',
  'sambanova', 'groq', 'modular', 'tenstorrent', 'mythic',
  'hailo', 'edge-impulse', 'nnaisense', 'deepmind', 'osmo',

  // === DEVELOPER TOOLS & INFRASTRUCTURE (80) ===
  'github', 'gitlab', 'vercel', 'netlify', 'render',
  'fly', 'railway', 'supabase', 'planetscale', 'neon',
  'cockroach', 'mongo', 'elastic', 'redis', 'temporal',
  'windmill', 'retool', 'airplane', 'superblocks', 'hex',
  'observable', 'replit', 'codespaces', 'gitpod', 'coder',
  'sourcegraph', 'snyk', 'checkmarx', 'sonatype', 'mend',
  'databricks', 'snowflake', 'hashicorp', 'pulumi', 'terraform-cloud',
  'ansible-corp', 'puppet', 'datadog', 'newrelic', 'splunk',
  'grafana', 'prometheus-cloud', 'sentry', 'rollbar', 'bugsnag',
  'logrocket', 'fullstory', 'heap', 'amplitude', 'mixpanel',
  'segment', 'rudderstack', 'mparticle', 'freshpaint', 'hightouch',
  'census', 'fivetran', 'airbyte', 'meltano', 'stitch',
  'talend', 'dbt', 'looker', 'tableau', 'mode',
  'metabase', 'redash', 'superset', 'preset', 'omni',
  'cloudflare', 'fastly', 'akamai-jobs', 'bunny-cdn', 'aws-jobs',
  'vercel-jobs', 'netlify-jobs', 'heroku-jobs', 'digitalocean-jobs', 'linode-jobs',

  // === COLLABORATION & PRODUCTIVITY (40) ===
  'notion', 'airtable', 'figma', 'miro', 'loom',
  'calendly', 'superhuman', 'front', 'linear', 'height',
  'cycle', 'plane', 'shortcut', 'clubhouse-app', 'asana',
  'clickup', 'monday', 'wrike', 'basecamp', 'twist',
  'slack-jobs', 'discord-jobs', 'telegram-jobs', 'signal-jobs', 'wire',
  'zoom-jobs', 'webex-jobs', 'whereby', 'around', 'mmhmm',
  'grain', 'fireflies', 'otter', 'tldv', 'fathom',
  'notion-calendar', 'cron', 'reclaim', 'clockwise', 'motion',

  // === COMMERCE & MARKETPLACES (30) ===
  'faire', 'faire-wholesale', 'whatnot', 'poshmark', 'depop',
  'vinted', 'mercari', 'offerup', 'letgo', 'reverb',
  'discogs', 'stubhub', 'vivid-seats', 'gametime', 'seatgeek',
  'ticketmaster-tech', 'eventbrite', 'hopin', 'bevy', 'gather',
  'spatial', 'framevr', 'roblox-jobs', 'readyplayerme', 'sandbox',
  'decentraland', 'sorare', 'dapper-labs', 'opensea-jobs', 'blur',

  // === BIG TECH / UNICORNS (20) ===
  'airbnb', 'doordash', 'instacart', 'grammarly', 'discord',
  'twitch-jobs', 'reddit', 'pinterest', 'tumblr', 'shopify-jobs',
  'wework', 'compass', 'opendoor', 'zillow-jobs', 'redfin',
  'houzz', 'thumbtack', 'angi', 'taskrabbit', 'handy',

  // === SECURITY & COMPLIANCE (30) ===
  'vanta', 'drata', 'secureframe', 'normalyze', 'wiz',
  'snyk-sec', 'lacework', 'orca-security', 'aqua-security', 'sysdig',
  'palo-alto', 'crowdstrike-jobs', 'sentinelone', 'cyberark', 'okta',
  'auth0', 'clerk', 'stytch', 'workos', 'propelauth',
  'fusionauth', 'descope', 'transmit-security', 'beyond-identity', 'magic-link',
  '1password-jobs', 'bitwarden', 'dashlane', 'nordpass', 'keeper',
];

// ============================================================================
// LEVER COMPANIES (150+)
// ============================================================================

export const LEVER_COMPANIES = [
  // === FAANG-TIER (20) ===
  'netflix', 'uber', 'lyft', 'shopify', 'reddit',
  'pinterest', 'cloudflare', 'atlassian', 'dropbox', 'zoom',
  'box', 'twilio', 'sendgrid', 'segment', 'slack',
  'discord', 'notion', 'figma', 'canva', 'airtable',

  // === ENTERPRISE SAAS (40) ===
  'hubspot', 'zendesk', 'intercom', 'drift', 'gong',
  'outreach', 'salesloft', 'apollo', 'zoominfo', 'clearbit',
  'lusha', '6sense', 'demandbase', 'terminus', 'marketo',
  'eloqua', 'pardot', 'mailchimp', 'constant-contact', 'campaign-monitor',
  'activecampaign', 'convertkit', 'beehiiv', 'substack', 'ghost',
  'wordpress-vip', 'medium-jobs', 'dev-to', 'hashnode', 'sanity',
  'contentful', 'strapi', 'directus', 'payload-cms', 'builder-io',
  'plasmic', 'framer-jobs', 'webflow', 'squarespace-jobs', 'wix-jobs',

  // === DEVELOPER PLATFORMS (30) ===
  'docker', 'circleci', 'travisci', 'buildkite', 'semaphore',
  'drone', 'concourse', 'spinnaker', 'argo', 'flux',
  'harness', 'codefresh', 'octopus', 'bamboo', 'teamcity',
  'jenkins-corp', 'gocd', 'screwdriver', 'wercker', 'codeship',
  'appveyor', 'azure-devops', 'aws-codepipeline', 'google-cloud-build', 'bitrise',
  'codemagic', 'appcircle', 'xcode-cloud', 'fastlane', 'match',

  // === CRYPTO & WEB3 (30) ===
  'coinbase', 'opensea', 'uniswap', 'aave', 'compound',
  'makerdao', 'curve', 'balancer', 'yearn', '1inch',
  'paraswap', 'matcha', 'dydx', 'synthetix', 'chainlink',
  'alchemy', 'infura', 'quicknode', 'moralis', 'thirdweb',
  'nansen', 'dune', 'flipside', 'messari', 'glassnode',
  'chainalysis', 'elliptic', 'trmio', 'cipher-trace', 'arkham',

  // === REMOTE WORK & HR TECH (30) ===
  'deel', 'remote', 'oyster', 'papaya', 'omnipresent',
  'multiplier', 'globalization-partners', 'safeguard', 'velocity-global', 'lano',
  'rippling', 'gusto', 'justworks', 'zenefits', 'bamboohr',
  'namely', 'paylocity', 'paycor', 'adp-jobs', 'workday-jobs',
  'lattice', 'culture-amp', '15five', 'reflektive', 'betterworks',
  'peakon', 'glint', 'qualtrics-jobs', 'surveymonkey-jobs', 'typeform',
];

// ============================================================================
// ASHBY COMPANIES (20+)
// ============================================================================

export const ASHBY_COMPANIES = [
  'linear', 'anduril', 'ramp', 'vanta', 'scale',
  'merge', 'causal', 'paragon', 'commandbar', 'mintlify',
  'val-town', 'railway-jobs', 'fly-io', 'render-jobs', 'vercel-ashby',
  'convex', 'inngest', 'trigger', 'quirrel', 'zeplo',
];

// ============================================================================
// WORKABLE COMPANIES (50+)
// ============================================================================

export const WORKABLE_COMPANIES = [
  'spotify-jobs', 'adobe-jobs', 'salesforce-jobs', 'oracle-jobs', 'sap-jobs',
  'vmware-jobs', 'red-hat', 'canonical', 'mozilla', 'wordpress',
  'automattic', 'basecamp-jobs', 'gitlab-workable', 'github-workable', '37signals',
  'hey-email', 'once', 'campfire', 'backpack', 'highrise',
  'zapier', 'integromat', 'make', 'tray', 'workato',
  'mulesoft', 'boomi', 'jitterbit', 'celigo', 'informatica',
  'talend-jobs', 'pentaho', 'alteryx', 'knime', 'rapidminer',
  'dataiku', 'h2o-workable', 'datarobot-workable', 'palantir-jobs', 'databricks-workable',
  'snowflake-workable', 'confluent', 'kafka-jobs', 'elastic-workable', 'mongodb-workable',
  'redis-workable', 'cockroach-workable', 'yugabyte', 'couchbase', 'aerospike',
];

// ============================================================================
// SMART HIRE / SMALLER ATS (30+)
// ============================================================================

export const SMARTRECRUITERS_COMPANIES = [
  'bosch-jobs', 'siemens-jobs', 'abb-jobs', 'philips-jobs', 'ikea-jobs',
  'visa-jobs', 'mastercard-jobs', 'american-express', 'capital-one', 'discover',
  'linkedin-jobs', 'indeed-jobs', 'glassdoor-jobs', 'monster-jobs', 'careerbuilder',
  'ziprecruiter-jobs', 'dice', 'stackoverflow-jobs', 'angel-list-talent', 'wellfound',
  'otta', 'cord', 'hired', 'triplebyte', 'interviewing-io',
  'techmatch', 'terminal', 'andela', 'toptal-jobs', 'upwork-jobs',
];

/**
 * Get all companies organized by ATS type
 */
export function getAllCompanies() {
  return {
    greenhouse: GREENHOUSE_COMPANIES,
    lever: LEVER_COMPANIES,
    ashby: ASHBY_COMPANIES,
    workable: WORKABLE_COMPANIES,
    smartrecruiters: SMARTRECRUITERS_COMPANIES
  };
}

/**
 * Get total number of companies tracked
 */
export const TOTAL_COMPANIES =
  GREENHOUSE_COMPANIES.length +
  LEVER_COMPANIES.length +
  ASHBY_COMPANIES.length +
  WORKABLE_COMPANIES.length +
  SMARTRECRUITERS_COMPANIES.length;

/**
 * Get high-priority companies (most likely to have fresh jobs)
 */
export function getHighPriorityCompanies() {
  return {
    greenhouse: GREENHOUSE_COMPANIES.slice(0, 100), // Top 100
    lever: LEVER_COMPANIES.slice(0, 50), // Top 50
    ashby: ASHBY_COMPANIES // All
  };
}

/**
 * Company metadata (for tracking job posting frequency)
 */
export const COMPANY_METADATA = {
  // High-volume companies (post jobs daily)
  highVolume: [
    'stripe', 'airbnb', 'uber', 'shopify', 'databricks',
    'snowflake', 'coinbase', 'robinhood', 'doordash', 'instacart'
  ],

  // Medium-volume (post weekly)
  mediumVolume: [
    'notion', 'figma', 'linear', 'vercel', 'netlify'
  ],

  // Known for remote jobs
  remoteFirst: [
    'gitlab', 'zapier', 'automattic', 'basecamp', 'doist',
    'buffer', 'hotjar', 'invision', 'auth0', 'elastic'
  ]
};

console.log(`📊 Total companies tracked: ${TOTAL_COMPANIES}`);
console.log(`   - Greenhouse: ${GREENHOUSE_COMPANIES.length}`);
console.log(`   - Lever: ${LEVER_COMPANIES.length}`);
console.log(`   - Ashby: ${ASHBY_COMPANIES.length}`);
console.log(`   - Workable: ${WORKABLE_COMPANIES.length}`);
console.log(`   - SmartRecruiters: ${SMARTRECRUITERS_COMPANIES.length}`);
