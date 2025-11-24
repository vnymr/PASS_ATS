/**
 * Redis Connection Configuration
 *
 * Centralizes Redis connection logic for both queue and worker
 * With retry limits to prevent infinite connection loops
 */

import Redis from 'ioredis';
import logger from './logger.js';

// Maximum retry attempts before giving up
const MAX_REDIS_RETRIES = 5;
let globalRetryCount = 0;
let redisAvailable = false;

/**
 * Create Redis connection with proper configuration
 *
 * Supports both local development (localhost:6379) and production (Railway Redis)
 * Optimized for 1000+ concurrent users with connection pooling
 * Has retry limits to prevent infinite loops when Redis is unavailable
 */
export function createRedisConnection() {
  const redisUrl = process.env.REDIS_URL;

  // In production without REDIS_URL, don't try to connect
  if (!redisUrl) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('REDIS_URL not set in production, skipping Redis connection');
      return null;
    }
    // Use localhost for development
  }

  const finalUrl = redisUrl || 'redis://localhost:6379';

  // If we've already exceeded retries, return null
  if (globalRetryCount >= MAX_REDIS_RETRIES) {
    logger.warn('Redis max retries already exceeded, skipping connection');
    return null;
  }

  try {
    const connection = new Redis(finalUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      lazyConnect: true, // Don't connect immediately - wait for first command
      keepAlive: 30000,
      connectTimeout: 5000, // Reduced to 5s
      // Auto-reconnect with retry limit
      retryStrategy(times) {
        globalRetryCount = times;
        if (times > MAX_REDIS_RETRIES) {
          logger.warn({ attempt: times, maxRetries: MAX_REDIS_RETRIES }, 'Redis max retries exceeded, stopping reconnection');
          redisAvailable = false;
          return null; // Stop retrying
        }
        const delay = Math.min(times * 500, 3000);
        logger.warn({ attempt: times, delay, maxRetries: MAX_REDIS_RETRIES }, 'Redis retry attempt');
        return delay;
      },
      reconnectOnError(err) {
        if (globalRetryCount >= MAX_REDIS_RETRIES) {
          return false; // Don't reconnect if max retries exceeded
        }
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          logger.warn('Redis READONLY error, reconnecting...');
          return true;
        }
        return false;
      },
      enableOfflineQueue: false, // Disable to prevent queue buildup when Redis is down
    });

    connection.on('connect', () => {
      redisAvailable = true;
      globalRetryCount = 0;
      logger.info({ url: finalUrl.replace(/\/\/.*@/, '//**:**@') }, 'Redis connected');
    });

    connection.on('ready', () => {
      redisAvailable = true;
      logger.info('Redis ready to accept commands');
    });

    connection.on('error', (error) => {
      redisAvailable = false;
      // Only log if under retry limit to prevent spam
      if (globalRetryCount <= MAX_REDIS_RETRIES) {
        logger.error({ error: error.message }, 'Redis connection error');
      }
      // Don't rethrow - let retry strategy handle it
    });

    connection.on('close', () => {
      redisAvailable = false;
      if (globalRetryCount <= MAX_REDIS_RETRIES) {
        logger.warn('Redis connection closed');
      }
    });

    connection.on('end', () => {
      redisAvailable = false;
      logger.warn('Redis connection ended permanently');
    });

    connection.on('reconnecting', () => {
      if (globalRetryCount <= MAX_REDIS_RETRIES) {
        logger.info('Redis reconnecting...');
      }
    });

    return connection;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create Redis connection');
    return null;
  }
}

export function isRedisAvailable() {
  return redisAvailable;
}
