import crypto from 'crypto';

/**
 * Simple in-memory cache for LaTeX generation
 * Caches based on job description + user profile hash
 */
class LatexCache {
  constructor(maxSize = 100, ttlMs = 3600000) { // 1 hour TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Generate cache key from job description and user data
   */
  generateKey(jobDescription, userData) {
    const normalizedJD = jobDescription.toLowerCase().trim();
    const userDataStr = JSON.stringify(userData);

    // Create hash of JD (first 500 chars) + user skills/experience
    const content = normalizedJD.substring(0, 500) + userDataStr;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Get cached LaTeX if available and not expired
   */
  get(jobDescription, userData) {
    const key = this.generateKey(jobDescription, userData);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    console.log(`💾 Cache HIT for job (saved ~80s generation time)`);
    return cached.latex;
  }

  /**
   * Store LaTeX in cache
   */
  set(jobDescription, userData, latex) {
    const key = this.generateKey(jobDescription, userData);

    // Evict oldest entry if at max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      latex,
      timestamp: Date.now()
    });

    console.log(`💾 Cached LaTeX for future requests (${this.cache.size}/${this.maxSize} entries)`);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs
    };
  }
}

// Singleton instance
export const latexCache = new LatexCache();

export default LatexCache;
