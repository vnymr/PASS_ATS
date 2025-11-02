/**
 * Company Logo Utilities
 *
 * Fetches company logos from multiple free sources:
 * - Clearbit Logo API (free, no API key needed)
 * - Logo.dev (free tier)
 * - Brandfetch (fallback)
 */

/**
 * Get company logo URL using Clearbit API (free, no auth required)
 * Falls back to initials if logo not found
 */
export function getCompanyLogoUrl(companyName: string, size: number = 128): string {
  if (!companyName) {
    return '';
  }

  // Clean company name (remove common suffixes)
  const cleanName = companyName
    .toLowerCase()
    .trim()
    .replace(/\s+(inc|llc|ltd|corp|corporation|company|co\.?)\s*$/gi, '')
    .trim();

  // Try to extract domain from company name
  const domain = extractDomain(cleanName);

  if (domain) {
    // Use Clearbit Logo API (free, no API key)
    return `https://logo.clearbit.com/${domain}?size=${size}`;
  }

  // If no domain, return empty (will show initials)
  return '';
}

/**
 * Extract domain from company name
 * Common patterns: "Stripe", "Airbnb", "Google", etc.
 */
function extractDomain(companyName: string): string {
  // Known company mappings
  const knownDomains: Record<string, string> = {
    'stripe': 'stripe.com',
    'google': 'google.com',
    'meta': 'meta.com',
    'facebook': 'facebook.com',
    'amazon': 'amazon.com',
    'microsoft': 'microsoft.com',
    'apple': 'apple.com',
    'netflix': 'netflix.com',
    'tesla': 'tesla.com',
    'uber': 'uber.com',
    'lyft': 'lyft.com',
    'airbnb': 'airbnb.com',
    'dropbox': 'dropbox.com',
    'slack': 'slack.com',
    'zoom': 'zoom.us',
    'salesforce': 'salesforce.com',
    'oracle': 'oracle.com',
    'adobe': 'adobe.com',
    'shopify': 'shopify.com',
    'square': 'squareup.com',
    'twitter': 'twitter.com',
    'x': 'x.com',
    'reddit': 'reddit.com',
    'snapchat': 'snapchat.com',
    'pinterest': 'pinterest.com',
    'linkedin': 'linkedin.com',
    'github': 'github.com',
    'gitlab': 'gitlab.com',
    'atlassian': 'atlassian.com',
    'asana': 'asana.com',
    'notion': 'notion.so',
    'figma': 'figma.com',
    'canva': 'canva.com',
    'spotify': 'spotify.com',
    'twitch': 'twitch.tv',
    'discord': 'discord.com',
    'openai': 'openai.com',
    'anthropic': 'anthropic.com',
    'databricks': 'databricks.com',
    'snowflake': 'snowflake.com',
    'mongodb': 'mongodb.com',
    'cloudflare': 'cloudflare.com',
    'vercel': 'vercel.com',
    'netlify': 'netlify.com',
  };

  const normalized = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (knownDomains[normalized]) {
    return knownDomains[normalized];
  }

  // Try common patterns
  // Pattern 1: company.com
  return `${normalized}.com`;
}

/**
 * Get company initials for fallback display
 */
export function getCompanyInitials(companyName: string): string {
  if (!companyName) {
    return '?';
  }

  const words = companyName
    .trim()
    .split(/[\s-_]+/)
    .filter(word => word.length > 0)
    .filter(word => !['inc', 'llc', 'ltd', 'corp', 'co'].includes(word.toLowerCase()));

  if (words.length === 0) {
    return companyName.charAt(0).toUpperCase();
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return words.slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('');
}

/**
 * Get logo color based on company name (for fallback background)
 */
export function getCompanyColor(companyName: string): string {
  if (!companyName) {
    return '#6B7280'; // gray
  }

  const colors = [
    '#FF6B6B', // red
    '#4ECDC4', // teal
    '#45B7D1', // blue
    '#FFA07A', // orange
    '#98D8C8', // mint
    '#F7DC6F', // yellow
    '#BB8FCE', // purple
    '#85C1E2', // sky
    '#F8B739', // gold
    '#52B788', // green
  ];

  // Hash company name to get consistent color
  let hash = 0;
  for (let i = 0; i < companyName.length; i++) {
    hash = companyName.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Logo component fallback behavior:
 * 1. Try to load logo from Clearbit
 * 2. If fails, show colored circle with initials
 */
export interface CompanyLogoProps {
  company: string;
  size?: number;
  className?: string;
}
