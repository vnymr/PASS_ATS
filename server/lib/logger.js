/**
 * Production-grade logger using Pino
 * - Structured JSON logging for production
 * - Pretty formatting for development
 * - Environment-based log levels
 */

import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

// Define log levels based on environment
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

// Create pino logger instance
const logger = pino({
  level: logLevel,

  // Production: JSON output, Development: Pretty output
  transport: isProduction ? undefined : {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      singleLine: false
    }
  },

  // Structured logging format
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
    bindings: (bindings) => {
      return {
        pid: bindings.pid,
        env: process.env.NODE_ENV || 'development'
      };
    }
  },

  // Base fields to include in all logs
  base: {
    env: process.env.NODE_ENV || 'development'
  },

  // Timestamp format
  timestamp: pino.stdTimeFunctions.isoTime
});

/**
 * Create child logger with additional context
 * @param {Object} context - Additional context fields
 * @returns {pino.Logger} Child logger
 */
export function createLogger(context = {}) {
  return logger.child(context);
}

/**
 * Log auth events (reduced verbosity in production)
 */
export const authLogger = {
  attempt: (data) => {
    if (!isProduction) {
      logger.debug({ ...data, type: 'auth_attempt' }, 'Auth attempt');
    }
  },

  success: (userId, method) => {
    logger.info({ userId, method, type: 'auth_success' }, 'Authentication successful');
  },

  failure: (reason, method) => {
    logger.warn({ reason, method, type: 'auth_failure' }, 'Authentication failed');
  },

  tokenExpired: (userId) => {
    logger.info({ userId, type: 'token_expired' }, 'Token expired - refresh required');
  }
};

/**
 * Log job processing events
 */
export const jobLogger = {
  start: (jobId, userId) => {
    logger.info({ jobId, userId, type: 'job_start' }, `Job ${jobId} started`);
  },

  progress: (jobId, progress) => {
    if (!isProduction) {
      logger.debug({ jobId, progress, type: 'job_progress' }, `Job ${jobId} progress: ${progress}%`);
    }
  },

  complete: (jobId, stats) => {
    logger.info({ jobId, ...stats, type: 'job_complete' }, `Job ${jobId} completed`);
  },

  failed: (jobId, error) => {
    logger.error({ jobId, error: error.message, stack: error.stack, type: 'job_failed' }, `Job ${jobId} failed`);
  }
};

/**
 * Log API requests (replaces verbose CORS logs)
 */
export const requestLogger = {
  cors: (origin, allowed) => {
    // Only log CORS rejections in production
    if (!allowed) {
      logger.warn({ origin, type: 'cors_rejected' }, 'CORS blocked origin');
    } else if (!isProduction) {
      logger.debug({ origin, type: 'cors_allowed' }, 'CORS check passed');
    }
  },

  error: (req, error) => {
    logger.error({
      method: req.method,
      url: req.url,
      error: error.message,
      stack: error.stack,
      type: 'request_error'
    }, 'Request error');
  }
};

/**
 * Log compilation events
 */
export const compileLogger = {
  start: (jobId, attempt) => {
    logger.info({ jobId, attempt, type: 'compile_start' }, `Compilation attempt ${attempt}`);
  },

  success: (jobId, stats) => {
    logger.info({ jobId, ...stats, type: 'compile_success' }, 'PDF compiled successfully');
  },

  failed: (jobId, error, attempt) => {
    logger.warn({ jobId, error: error.substring(0, 200), attempt, type: 'compile_failed' }, 'Compilation failed');
  },

  retry: (jobId, attempt) => {
    logger.info({ jobId, attempt, type: 'compile_retry' }, `Retrying compilation (attempt ${attempt})`);
  }
};

/**
 * Log LLM/AI events (condensed token usage)
 */
export const aiLogger = {
  request: (model, type) => {
    logger.info({ model, type, event: 'llm_request' }, `LLM request: ${type}`);
  },

  response: (model, tokens) => {
    // Condensed token logging
    const { prompt_tokens, completion_tokens, total_tokens, cached_tokens = 0 } = tokens;
    const cacheHitRate = cached_tokens > 0 ? ((cached_tokens / prompt_tokens) * 100).toFixed(1) : 0;

    logger.info({
      model,
      tokens: { prompt: prompt_tokens, completion: completion_tokens, total: total_tokens, cached: cached_tokens },
      cacheHitRate: `${cacheHitRate}%`,
      event: 'llm_response'
    }, `LLM response - ${total_tokens} tokens (${cacheHitRate}% cached)`);
  },

  error: (model, error) => {
    logger.error({ model, error: error.message, event: 'llm_error' }, 'LLM request failed');
  }
};

export default logger;
