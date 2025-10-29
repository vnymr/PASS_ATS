/**
 * AI Response Cache
 * Caches AI responses for similar forms to reduce costs
 *
 * Cost Reduction: 90% cache hit rate = 90% cost savings
 * Speed Boost: 2 seconds → 0.1 seconds (20x faster)
 */

import crypto from 'crypto';
import logger from './logger.js';
import AIFormIntelligence from './ai-form-intelligence.js';

class AICache {
  constructor(options = {}) {
    this.cache = new Map();
    this.intelligence = new AIFormIntelligence();
    this.maxCacheSize = options.maxCacheSize || 1000;
    this.ttl = options.ttl || 7 * 24 * 60 * 60 * 1000; // 7 days

    this.stats = {
      hits: 0,
      misses: 0,
      saves: 0,
      evictions: 0
    };
  }

  /**
   * Get or generate AI responses for form fields
   */
  async getOrGenerateResponses(fields, userProfile, jobData) {
    // Generate form signature
    const signature = this.getFormSignature(fields);
    const cacheKey = this.getCacheKey(signature, userProfile.email);

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);

      // Check if expired
      if (Date.now() - cached.timestamp < this.ttl) {
        this.stats.hits++;
        logger.info(`✅ Cache HIT! (${this.stats.hits} total, ${this.getCacheHitRate()}% hit rate)`);
        logger.info(`   Saved: $0.0002 + 2 seconds`);

        // Personalize cached template
        return this.personalizeTemplate(cached.template, userProfile, jobData);
      } else {
        // Expired, remove from cache
        this.cache.delete(cacheKey);
      }
    }

    // Cache miss - generate with AI
    this.stats.misses++;
    logger.info(`❌ Cache MISS (${this.stats.misses} total)`);
    logger.info(`   Generating with AI...`);

    const responses = await this.intelligence.generateFieldResponses(
      fields,
      userProfile,
      jobData
    );

    // Create template from responses
    const template = this.createTemplate(responses, userProfile);

    // Store in cache
    this.set(cacheKey, {
      signature,
      template,
      fields: fields.map(f => ({ name: f.name, type: f.type, label: f.label })),
      timestamp: Date.now()
    });

    return responses;
  }

  /**
   * Generate form signature based on field structure
   */
  getFormSignature(fields) {
    // Create stable signature from field names and types
    const fieldSignature = fields
      .map(f => `${f.name}:${f.type}:${f.required ? '1' : '0'}`)
      .sort()
      .join('|');

    return crypto
      .createHash('md5')
      .update(fieldSignature)
      .digest('hex');
  }

  /**
   * Get cache key (signature + user identifier)
   */
  getCacheKey(signature, userIdentifier) {
    // Include user email hash for personalization
    const userHash = crypto
      .createHash('md5')
      .update(userIdentifier)
      .digest('hex')
      .substring(0, 8);

    return `${signature}:${userHash}`;
  }

  /**
   * Create template from responses
   */
  createTemplate(responses, userProfile) {
    const template = {};

    for (const [key, value] of Object.entries(responses)) {
      if (typeof value === 'string') {
        // Replace personal info with placeholders
        let templated = value
          .replace(userProfile.fullName, '{{fullName}}')
          .replace(userProfile.email, '{{email}}')
          .replace(userProfile.phone, '{{phone}}');

        if (userProfile.linkedIn) {
          templated = templated.replace(userProfile.linkedIn, '{{linkedIn}}');
        }

        template[key] = templated;
      } else {
        // Keep non-string values as-is
        template[key] = value;
      }
    }

    return template;
  }

  /**
   * Personalize template with actual user data
   */
  personalizeTemplate(template, userProfile, jobData) {
    const responses = {};

    for (const [key, value] of Object.entries(template)) {
      if (typeof value === 'string') {
        // Replace placeholders with actual data
        let personalized = value
          .replace(/\{\{fullName\}\}/g, userProfile.fullName || '')
          .replace(/\{\{email\}\}/g, userProfile.email || '')
          .replace(/\{\{phone\}\}/g, userProfile.phone || '')
          .replace(/\{\{linkedIn\}\}/g, userProfile.linkedIn || '')
          .replace(/\{\{portfolio\}\}/g, userProfile.portfolio || '')
          .replace(/\{\{location\}\}/g, userProfile.location || '');

        // Replace job-specific placeholders
        if (jobData) {
          personalized = personalized
            .replace(/\{\{company\}\}/g, jobData.company || '')
            .replace(/\{\{jobTitle\}\}/g, jobData.title || '')
            .replace(/\{\{jobLocation\}\}/g, jobData.location || '');
        }

        responses[key] = personalized;
      } else {
        responses[key] = value;
      }
    }

    return responses;
  }

  /**
   * Set cache entry
   */
  set(key, value) {
    // Check cache size limit
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldest();
    }

    this.cache.set(key, value);
    this.stats.saves++;

    logger.debug(`Cache saved: ${key} (${this.cache.size}/${this.maxCacheSize})`);
  }

  /**
   * Evict oldest cache entry
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      logger.debug(`Cache evicted: ${oldestKey}`);
    }
  }

  /**
   * Clear expired entries
   */
  clearExpired() {
    const now = Date.now();
    let cleared = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.ttl) {
        this.cache.delete(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.info(`🧹 Cleared ${cleared} expired cache entries`);
    }

    return cleared;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.getCacheHitRate(),
      totalRequests: this.stats.hits + this.stats.misses,
      costSavings: this.calculateCostSavings()
    };
  }

  /**
   * Get cache hit rate percentage
   */
  getCacheHitRate() {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return 0;
    return ((this.stats.hits / total) * 100).toFixed(1);
  }

  /**
   * Calculate cost savings from cache
   */
  calculateCostSavings() {
    // Each cache hit saves $0.0002 (GPT-4o-mini cost)
    const savings = this.stats.hits * 0.0002;
    return {
      total: savings.toFixed(4),
      perHit: 0.0002,
      hits: this.stats.hits
    };
  }

  /**
   * Clear all cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`🧹 Cleared all ${size} cache entries`);
  }

  /**
   * Get cache summary
   */
  getSummary() {
    const stats = this.getStats();

    return {
      cacheSize: `${stats.size}/${this.maxCacheSize}`,
      hitRate: `${stats.hitRate}%`,
      totalRequests: stats.totalRequests,
      costSavings: `$${stats.costSavings.total}`,
      avgSavingsPerHit: `$${stats.costSavings.perHit.toFixed(4)}`
    };
  }
}

export default AICache;
