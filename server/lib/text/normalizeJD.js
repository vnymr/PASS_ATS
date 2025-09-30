/**
 * Normalizes a job description for idempotency hashing
 * @param {string} jd - Raw job description text
 * @returns {string} Normalized job description
 */
export function normalizeJD(jd) {
  if (!jd || typeof jd !== 'string') {
    return '';
  }

  return jd
    .toLowerCase()
    .trim()
    // Collapse multiple whitespace (including newlines, tabs) to single space
    .replace(/\s+/g, ' ')
    // Strip punctuation except word characters and spaces
    .replace(/[^\w\s]/g, '')
    .trim();
}