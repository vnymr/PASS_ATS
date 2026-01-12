/**
 * Redis Connection Configuration
 *
 * Centralizes Redis connection logic for both queue and worker
 * Optimized for Railway Redis proxy which has aggressive idle timeouts
 */

import Redis from 'ioredis';
import logger from './logger.js';

let redisAvailable = false;

/**
 * Create Redis connection with proper configuration
 *
 * Optimized for Railway Redis proxy:
 * - Short keepAlive to prevent idle disconnects
 * - Aggressive reconnection for transient failures
 * - No retry limit (Railway connections are transient)
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

  try {
    const connection = new Redis(finalUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      lazyConnect: false, // Connect immediately to establish keepalive
      // Aggressive keepalive to prevent Railway proxy timeout
      keepAlive: 10000, // Send TCP keepalive every 10 seconds
      connectTimeout: 10000, // 10 second connect timeout
      commandTimeout: 30000, // 30 second command timeout
      // Always reconnect - Railway connections are transient
      retryStrategy(times) {
        // Exponential backoff: 100ms, 200ms, 400ms... max 3s
        const delay = Math.min(times * 100, 3000);
        if (times <= 3 || times % 10 === 0) { // Log first 3 and every 10th
          logger.warn({ attempt: times, delay }, 'Redis retry attempt');
        }
        return delay; // Always retry
      },
      reconnectOnError(err) {
        // Always reconnect on any error (Railway connections are unstable)
        const shouldReconnect = err.message.includes('ECONNRESET') ||
                               err.message.includes('ETIMEDOUT') ||
                               err.message.includes('READONLY') ||
                               err.message.includes('ENOTFOUND');
        if (shouldReconnect) {
          logger.info('Redis error triggered reconnect');
        }
        return shouldReconnect;
      },
      enableOfflineQueue: true, // Queue commands while reconnecting
    });

    connection.on('connect', () => {
      redisAvailable = true;
      logger.info({ url: finalUrl.replace(/\/\/.*@/, '//**:**@') }, 'Redis connected');
    });

    connection.on('ready', () => {
      redisAvailable = true;
      logger.info('Redis ready to accept commands');
    });

    connection.on('error', (error) => {
      redisAvailable = false;
      // Only log occasional errors to prevent spam
      if (!error._logged) {
        logger.error({ error: error.message }, 'Redis connection error');
        error._logged = true;
      }
    });

    connection.on('close', () => {
      redisAvailable = false;
      logger.warn('Redis connection closed');
    });

    connection.on('end', () => {
      redisAvailable = false;
      logger.warn('Redis connection ended');
    });

    connection.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
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
