/**
 * Per-user rate limiting with database tracking
 */

import { prisma } from './prisma-client.js';
import logger from './logger.js';

/**
 * Rate limit configuration
 */
const RATE_LIMITS = {
  FREE: {
    messages: 100,
    period: 24 * 60 * 60 * 1000 // 24 hours in ms
  },
  PRO: {
    messages: 500,
    period: 24 * 60 * 60 * 1000
  },
  UNLIMITED: {
    messages: Infinity,
    period: 24 * 60 * 60 * 1000
  }
};

/**
 * Get today's date at midnight UTC
 */
function getTodayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Get reset time (tomorrow at midnight UTC)
 */
function getResetTime() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

/**
 * Check and track message usage for a user or IP
 * @param {number|null} userId - User ID if authenticated
 * @param {string} ip - IP address as fallback
 * @param {string} tier - Subscription tier (FREE, PRO, UNLIMITED)
 * @returns {Promise<{ allowed: boolean, remaining: number, resetAt: Date, message?: string }>}
 */
export async function checkAndTrackUsage(userId, ip, tier = 'FREE') {
  const limit = RATE_LIMITS[tier] || RATE_LIMITS.FREE;
  const today = getTodayDate();
  const resetAt = getResetTime();

  try {
    // Use userId if available, otherwise use IP
    const identifier = userId ? { userId, date: today } : { ip, date: today };

    // Try to find existing usage record
    let usage = await prisma.messageUsage.findUnique({
      where: userId ? { userId_date: identifier } : { ip_date: identifier }
    });

    if (!usage) {
      // Create new usage record
      usage = await prisma.messageUsage.create({
        data: {
          userId: userId || null,
          ip: !userId ? ip : null,
          date: today,
          count: 1,
          resetAt
        }
      });

      logger.info({ userId, ip, count: 1, limit: limit.messages }, 'New usage record created');

      return {
        allowed: true,
        remaining: limit.messages - 1,
        resetAt,
        count: 1
      };
    }

    // Check if limit exceeded
    if (usage.count >= limit.messages) {
      logger.warn({ userId, ip, count: usage.count, limit: limit.messages }, 'Rate limit exceeded');

      return {
        allowed: false,
        remaining: 0,
        resetAt: usage.resetAt,
        count: usage.count,
        message: `Rate limit exceeded. You have used ${usage.count}/${limit.messages} messages. Resets at ${usage.resetAt.toISOString()}`
      };
    }

    // Increment usage count
    const updated = await prisma.messageUsage.update({
      where: { id: usage.id },
      data: {
        count: { increment: 1 }
      }
    });

    logger.info({ userId, ip, count: updated.count, limit: limit.messages }, 'Usage tracked');

    return {
      allowed: true,
      remaining: limit.messages - updated.count,
      resetAt: updated.resetAt,
      count: updated.count
    };
  } catch (error) {
    logger.error({ error: error.message, userId, ip }, 'Rate limiting check failed');

    // On error, allow the request but log it
    return {
      allowed: true,
      remaining: limit.messages,
      resetAt,
      error: error.message
    };
  }
}

/**
 * Get current usage stats for a user or IP
 * @param {number|null} userId
 * @param {string} ip
 * @returns {Promise<{ count: number, limit: number, remaining: number, resetAt: Date }>}
 */
export async function getUsageStats(userId, ip, tier = 'FREE') {
  const limit = RATE_LIMITS[tier] || RATE_LIMITS.FREE;
  const today = getTodayDate();

  try {
    const identifier = userId ? { userId, date: today } : { ip, date: today };

    const usage = await prisma.messageUsage.findUnique({
      where: userId ? { userId_date: identifier } : { ip_date: identifier }
    });

    if (!usage) {
      return {
        count: 0,
        limit: limit.messages,
        remaining: limit.messages,
        resetAt: getResetTime()
      };
    }

    return {
      count: usage.count,
      limit: limit.messages,
      remaining: Math.max(0, limit.messages - usage.count),
      resetAt: usage.resetAt
    };
  } catch (error) {
    logger.error({ error: error.message, userId, ip }, 'Failed to get usage stats');
    throw error;
  }
}

/**
 * Get user's subscription tier
 * @param {number} userId
 * @returns {Promise<string>}
 */
export async function getUserTier(userId) {
  if (!userId) {
    return 'FREE';
  }

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: parseInt(userId) },
      select: { tier: true, status: true }
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      return 'FREE';
    }

    return subscription.tier;
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to get user tier');
    return 'FREE';
  }
}

/**
 * Express middleware for rate limiting
 */
export function rateLimitMiddleware() {
  return async (req, res, next) => {
    const userId = req.userId || null; // Set by auth middleware
    const ip = req.ip || req.connection.remoteAddress;

    try {
      // Get user tier
      const tier = await getUserTier(userId);

      // Check rate limit
      const result = await checkAndTrackUsage(userId, ip, tier);

      // Add rate limit info to response headers
      res.setHeader('X-RateLimit-Limit', RATE_LIMITS[tier].messages);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

      if (!result.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: result.message,
          limit: RATE_LIMITS[tier].messages,
          remaining: result.remaining,
          resetAt: result.resetAt.toISOString()
        });
      }

      next();
    } catch (error) {
      logger.error({ error: error.message }, 'Rate limit middleware error');
      // On error, allow request to proceed
      next();
    }
  };
}
