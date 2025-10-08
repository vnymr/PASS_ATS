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
 * Optimized for 1000+ concurrent users with connection pooling
 */
export function createRedisConnection() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
    // Connection pool settings for high concurrency
    lazyConnect: false,
    keepAlive: 30000, // Keep connections alive for 30s
    connectTimeout: 10000, // 10s connection timeout
    maxRetriesPerRequest: null,
    // Auto-reconnect with exponential backoff
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      logger.warn({ attempt: times, delay }, 'Redis retry attempt');
      return delay;
    },
    // Reconnect on error
    reconnectOnError(err) {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // Only reconnect when the error contains "READONLY"
        logger.warn('Redis READONLY error, reconnecting...');
        return true;
      }
      return false;
    },
    // Enable offline queue for better reliability
    enableOfflineQueue: true,
  });

  connection.on('connect', () => {
    logger.info({ url: redisUrl.replace(/\/\/.*@/, '//**:**@') }, 'Redis connected');
  });

  connection.on('ready', () => {
    logger.info('Redis ready to accept commands');
  });

  connection.on('error', (error) => {
    logger.error({ error: error.message }, 'Redis connection error');
  });

  connection.on('close', () => {
    logger.warn('Redis connection closed');
  });

  connection.on('reconnecting', () => {
    logger.info('Redis reconnecting...');
  });

  return connection;
}
