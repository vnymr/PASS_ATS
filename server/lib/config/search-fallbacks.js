/**
 * Config-based fallback for search interpretation
 * ONLY used when LLM returns UNKNOWN or fails to interpret
 */

/**
 * Temporal keyword mappings
 * Maps keywords to time windows (used to calculate postedSince)
 */
export const timeframes = {
  today: '24h',
  recent: '72h',
  recently: '72h',
  latest: '72h',
  new: '72h',
  week: '7d',
  'this week': '7d',
  'past week': '7d',
  'last week': '7d',
  month: '30d',
  'this month': '30d'
};

/**
 * Minimal role synonym map
 * Only for obvious, unambiguous role shortcuts
 */
export const roleSynonyms = {
  pm: 'Product Manager',
  swe: 'Software Engineer',
  sde: 'Software Engineer',
  tpm: 'Technical Product Manager',
  em: 'Engineering Manager',
  qa: 'QA Engineer',
  sre: 'Site Reliability Engineer',
  devops: 'DevOps Engineer'
};

/**
 * Calculate postedSince date from timeframe string
 * @param {string} timeframeStr - e.g., "24h", "7d", "30d"
 * @returns {Date}
 */
export function calculatePostedSince(timeframeStr) {
  const now = new Date();
  const match = timeframeStr.match(/^(\d+)([hd])$/);

  if (!match) {
    throw new Error(`Invalid timeframe format: ${timeframeStr}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (unit === 'h') {
    return new Date(now.getTime() - value * 60 * 60 * 1000);
  } else if (unit === 'd') {
    return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
  }

  throw new Error(`Unknown unit: ${unit}`);
}

/**
 * Extract temporal keyword from message (fallback only)
 * @param {string} message
 * @returns {{ postedSince?: string, timeframe?: string } | null}
 */
export function extractTimeframeFallback(message) {
  if (!message) return null;

  const lowerMessage = message.toLowerCase();

  // Check for exact matches in timeframes config
  for (const [keyword, duration] of Object.entries(timeframes)) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(lowerMessage)) {
      const postedSince = calculatePostedSince(duration);
      return {
        postedSince: postedSince.toISOString(),
        timeframe: keyword
      };
    }
  }

  return null;
}

/**
 * Extract role synonym from message (fallback only)
 * @param {string} message
 * @returns {string | null}
 */
export function extractRoleFallback(message) {
  if (!message) return null;

  const lowerMessage = message.toLowerCase();

  // Check for exact word matches only
  for (const [shorthand, fullRole] of Object.entries(roleSynonyms)) {
    const regex = new RegExp(`\\b${shorthand}\\b`, 'i');
    if (regex.test(lowerMessage)) {
      return fullRole;
    }
  }

  return null;
}
