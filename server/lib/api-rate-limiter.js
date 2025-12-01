/**
 * Redis-based API Rate Limiter for Horizontal Scaling
 *
 * This is for SHORT-TERM burst protection (requests per minute).
 * Separate from the daily usage limits in rate-limiter.js.
 *
 * Uses rate-limiter-flexible with Redis backend for distributed rate limiting
 * that works across multiple server instances.
 */

import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import logger from './logger.js';

let redisClient = null;
let isRedisAvailable = false;

// Initialize Redis connection for rate limiting
function initRedisClient() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    redisClient = new Redis(redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 100, 1000);
      }
    });

    redisClient.on('connect', () => {
      isRedisAvailable = true;
      logger.info('API Rate limiter: Redis connected');
    });

    redisClient.on('error', (err) => {
      if (isRedisAvailable) {
        logger.warn({ error: err.message }, 'API Rate limiter: Redis error, using memory fallback');
      }
      isRedisAvailable = false;
    });

    // Try to connect
    redisClient.connect().catch(() => {
      isRedisAvailable = false;
    });

    return redisClient;
  } catch (error) {
    logger.warn({ error: error.message }, 'Redis init failed, using memory rate limiter');
    return null;
  }
}

// Initialize Redis on module load
initRedisClient();

/**
 * Rate limiter configurations for different endpoint types
 * These are SHORT-TERM limits (per minute) for API protection
 */
const configs = {
  // General API: 100 req/min per user
  general: { points: 100, duration: 60, keyPrefix: 'api_general' },

  // Resume generation: 10 req/min (expensive)
  resume: { points: 10, duration: 60, keyPrefix: 'api_resume' },

  // Auth endpoints: 10 req/min (prevent brute force)
  auth: { points: 10, duration: 60, keyPrefix: 'api_auth' },

  // AI/Chat: 30 req/min
  ai: { points: 30, duration: 60, keyPrefix: 'api_ai' },

  // Auto-apply: 20 req/min
  autoApply: { points: 20, duration: 60, keyPrefix: 'api_autoapply' },

  // Job status polling: 120 req/min (high for polling)
  status: { points: 120, duration: 60, keyPrefix: 'api_status' },

  // File uploads: 20 req/min
  upload: { points: 20, duration: 60, keyPrefix: 'api_upload' },
};

// Create memory fallbacks
const memoryLimiters = {};
for (const [name, config] of Object.entries(configs)) {
  memoryLimiters[name] = new RateLimiterMemory({
    points: config.points,
    duration: config.duration,
  });
}

// Create Redis limiters (lazy initialization)
const redisLimiters = {};

function getLimiter(type) {
  // If Redis is available, use Redis limiter
  if (isRedisAvailable && redisClient) {
    if (!redisLimiters[type]) {
      const config = configs[type] || configs.general;
      redisLimiters[type] = new RateLimiterRedis({
        storeClient: redisClient,
        points: config.points,
        duration: config.duration,
        keyPrefix: config.keyPrefix,
        insuranceLimiter: memoryLimiters[type], // Auto-fallback
      });
    }
    return redisLimiters[type];
  }

  // Fall back to memory
  return memoryLimiters[type] || memoryLimiters.general;
}

/**
 * Extract client identifier for rate limiting
 */
function getClientKey(req) {
  // Prefer user ID for authenticated requests
  if (req.user?.id) {
    return `u_${req.user.id}`;
  }

  // Fall back to IP
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip || req.connection?.remoteAddress || 'unknown';
  return `ip_${ip}`;
}

/**
 * API Rate limiting middleware factory
 * @param {string} type - Type of rate limiter (general, resume, auth, ai, etc.)
 * @returns {Function} Express middleware
 */
export function apiRateLimit(type = 'general') {
  const config = configs[type] || configs.general;

  return async (req, res, next) => {
    const limiter = getLimiter(type);
    const key = getClientKey(req);

    try {
      const result = await limiter.consume(key);

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': config.points,
        'X-RateLimit-Remaining': result.remainingPoints,
        'X-RateLimit-Reset': Math.ceil(result.msBeforeNext / 1000),
      });

      next();
    } catch (rateLimiterRes) {
      const retryAfter = Math.ceil(rateLimiterRes.msBeforeNext / 1000) || 60;

      logger.warn({
        key,
        type,
        retryAfter,
        path: req.path
      }, 'API rate limit exceeded');

      res.set({
        'Retry-After': retryAfter,
        'X-RateLimit-Limit': config.points,
        'X-RateLimit-Remaining': 0,
        'X-RateLimit-Reset': retryAfter,
      });

      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
        retryAfter,
      });
    }
  };
}

/**
 * Pre-configured middleware exports
 */
export const apiLimiters = {
  general: apiRateLimit('general'),
  resume: apiRateLimit('resume'),
  auth: apiRateLimit('auth'),
  ai: apiRateLimit('ai'),
  autoApply: apiRateLimit('autoApply'),
  status: apiRateLimit('status'),
  upload: apiRateLimit('upload'),
};

/**
 * Health check
 */
export function getApiRateLimiterHealth() {
  return {
    type: isRedisAvailable ? 'redis' : 'memory',
    redisConnected: isRedisAvailable,
    endpoints: Object.keys(configs),
  };
}

export default {
  apiRateLimit,
  apiLimiters,
  getApiRateLimiterHealth,
};
