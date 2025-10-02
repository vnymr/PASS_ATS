/**
 * Redis Connection Configuration
 *
 * Centralizes Redis connection logic for both queue and worker
 */

import Redis from 'ioredis';
import logger from './logger.js';

/**
 * Create Redis connection with proper configuration
 *
 * Supports both local development (localhost:6379) and production (Railway Redis)
 */
export function createRedisConnection() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  });

  connection.on('connect', () => {
    logger.info({ url: redisUrl.replace(/\/\/.*@/, '//**:**@') }, 'Redis connected');
  });

  connection.on('error', (error) => {
    logger.error({ error: error.message }, 'Redis connection error');
  });

  connection.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return connection;
}
