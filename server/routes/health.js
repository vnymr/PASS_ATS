/**
 * Health Check Endpoints
 * Provides health status for monitoring and alerting
 */

import express from 'express';
import { prisma } from '../lib/prisma-client.js';
import logger from '../lib/logger.js';
import { getQueueStats, checkAutoApplyQueueConnection } from '../lib/auto-apply-queue.js';

const router = express.Router();

/**
 * Basic health check - fast response
 * Used by load balancers
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'resume-generator',
    version: process.env.npm_package_version || '1.0.0'
  });
});

/**
 * Detailed health check - includes dependency checks
 * Used for comprehensive monitoring
 */
router.get('/health/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'resume-generator',
    version: process.env.npm_package_version || '1.0.0',
    checks: {},
    metrics: {}
  };

  let httpStatus = 200;

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = {
      status: 'healthy',
      message: 'Database connection successful'
    };
  } catch (error) {
    health.status = 'unhealthy';
    health.checks.database = {
      status: 'unhealthy',
      message: error.message
    };
    httpStatus = 503;
  }

  // Check Redis/Queue connection
  try {
    await checkAutoApplyQueueConnection();
    health.checks.redis = {
      status: 'healthy',
      message: 'Redis connection successful'
    };
  } catch (error) {
    health.status = 'degraded'; // Degraded, not unhealthy (can still generate resumes)
    health.checks.redis = {
      status: 'unhealthy',
      message: error.message
    };
    if (httpStatus === 200) httpStatus = 503;
  }

  // Check queue health
  try {
    const queueStats = await getQueueStats();
    health.checks.queue = {
      status: queueStats.failed > queueStats.completed * 0.5 ? 'degraded' : 'healthy',
      stats: queueStats
    };

    health.metrics.queue = queueStats;

    // Alert if too many failed jobs
    if (queueStats.failed > 50) {
      health.status = 'degraded';
      health.checks.queue.warning = 'High number of failed jobs';
    }

    // Alert if queue is backing up
    if (queueStats.waiting > 100) {
      health.status = 'degraded';
      health.checks.queue.warning = 'Queue backlog detected';
    }
  } catch (error) {
    health.checks.queue = {
      status: 'unknown',
      message: error.message
    };
  }

  // Check CAPTCHA balance (if configured)
  if (process.env.TWOCAPTCHA_API_KEY) {
    try {
      const { default: CaptchaSolver } = await import('../lib/captcha-solver.js');
      const captchaSolver = new CaptchaSolver();
      const balance = await captchaSolver.getBalance();

      health.checks.captcha = {
        status: balance > 1 ? 'healthy' : balance > 0.1 ? 'degraded' : 'critical',
        balance: `$${balance.toFixed(2)}`
      };

      if (balance < 0.1) {
        health.status = 'critical';
        health.checks.captcha.warning = 'CAPTCHA balance critically low';
      } else if (balance < 1) {
        health.status = health.status === 'healthy' ? 'degraded' : health.status;
        health.checks.captcha.warning = 'CAPTCHA balance low';
      }
    } catch (error) {
      health.checks.captcha = {
        status: 'unknown',
        message: 'Could not check CAPTCHA balance',
        error: error.message
      };
    }
  } else {
    health.checks.captcha = {
      status: 'not_configured',
      message: 'CAPTCHA API key not configured'
    };
  }

  // Check memory usage
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    rss: Math.round(memUsage.rss / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };

  health.metrics.memory = memUsageMB;

  // Alert if memory usage is high
  if (memUsageMB.heapUsed > 1500) { // 1.5GB
    health.status = health.status === 'healthy' ? 'degraded' : health.status;
    health.checks.memory = {
      status: 'warning',
      message: `High memory usage: ${memUsageMB.heapUsed}MB`,
      usage: memUsageMB
    };
  } else {
    health.checks.memory = {
      status: 'healthy',
      usage: memUsageMB
    };
  }

  // Check uptime
  const uptimeSeconds = process.uptime();
  health.metrics.uptime = {
    seconds: Math.floor(uptimeSeconds),
    formatted: formatUptime(uptimeSeconds)
  };

  res.status(httpStatus).json(health);
});

/**
 * Auto-apply specific health check
 */
router.get('/health/auto-apply', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {}
  };

  let httpStatus = 200;

  // Check Redis/Queue
  try {
    await checkAutoApplyQueueConnection();
    health.checks.redis = 'healthy';
  } catch (error) {
    health.status = 'unhealthy';
    health.checks.redis = 'failed';
    httpStatus = 503;
  }

  // Check queue stats
  try {
    const stats = await getQueueStats();
    health.checks.queue = {
      status: 'healthy',
      waiting: stats.waiting,
      active: stats.active,
      failed: stats.failed,
      completed: stats.completed
    };

    // Alert conditions
    if (stats.waiting > 100) {
      health.status = 'degraded';
      health.checks.queue.status = 'degraded';
      health.checks.queue.warning = 'High queue backlog';
    }

    if (stats.failed > stats.completed * 0.5) {
      health.status = 'degraded';
      health.checks.queue.status = 'degraded';
      health.checks.queue.warning = 'High failure rate';
    }
  } catch (error) {
    health.checks.queue = {
      status: 'unknown',
      error: error.message
    };
  }

  // Check CAPTCHA balance
  if (process.env.TWOCAPTCHA_API_KEY) {
    try {
      const { default: CaptchaSolver } = await import('../lib/captcha-solver.js');
      const captchaSolver = new CaptchaSolver();
      const balance = await captchaSolver.getBalance();

      health.checks.captcha = {
        balance: `$${balance.toFixed(2)}`,
        status: balance > 1 ? 'healthy' : 'low'
      };

      if (balance < 1) {
        health.status = health.status === 'healthy' ? 'degraded' : health.status;
      }
    } catch (error) {
      health.checks.captcha = {
        status: 'error',
        message: error.message
      };
    }
  }

  res.status(httpStatus).json(health);
});

/**
 * Readiness check - indicates if service can accept traffic
 */
router.get('/health/ready', async (req, res) => {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;

    // Check queue (if auto-apply is enabled)
    if (process.env.REDIS_URL) {
      await checkAutoApplyQueueConnection();
    }

    res.json({
      ready: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Liveness check - indicates if service is alive (not stuck)
 */
router.get('/health/live', (req, res) => {
  // Simple check - if we can respond, we're alive
  res.json({
    alive: true,
    timestamp: new Date().toISOString()
  });
});

/**
 * Helper function to format uptime
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

export default router;
