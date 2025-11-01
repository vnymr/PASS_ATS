/**
 * Structured error handling and response formatting
 */

import logger from './logger.js';

/**
 * Standard error codes
 */
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Business Logic
  INSUFFICIENT_PROFILE: 'INSUFFICIENT_PROFILE',
  GENERATION_FAILED: 'GENERATION_FAILED',
  COMPILATION_FAILED: 'COMPILATION_FAILED',
  TOOL_EXECUTION_FAILED: 'TOOL_EXECUTION_FAILED',

  // External Services
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  OPENAI_ERROR: 'OPENAI_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',

  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Custom application error class
 */
export class AppError extends Error {
  constructor(code, message, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp
      }
    };
  }
}

/**
 * Create error response helpers
 */
export const createError = {
  unauthorized: (message = 'Unauthorized', details = null) =>
    new AppError(ErrorCodes.UNAUTHORIZED, message, 401, details),

  forbidden: (message = 'Forbidden', details = null) =>
    new AppError(ErrorCodes.FORBIDDEN, message, 403, details),

  notFound: (resource = 'Resource', details = null) =>
    new AppError(ErrorCodes.NOT_FOUND, `${resource} not found`, 404, details),

  validation: (message, details = null) =>
    new AppError(ErrorCodes.VALIDATION_ERROR, message, 400, details),

  rateLimit: (message, details = null) =>
    new AppError(ErrorCodes.RATE_LIMIT_EXCEEDED, message, 429, details),

  conflict: (message, details = null) =>
    new AppError(ErrorCodes.CONFLICT, message, 409, details),

  internal: (message = 'Internal server error', details = null) =>
    new AppError(ErrorCodes.INTERNAL_ERROR, message, 500, details),

  external: (service, message, details = null) =>
    new AppError(ErrorCodes.EXTERNAL_API_ERROR, `${service} error: ${message}`, 502, details),

  generation: (message, details = null) =>
    new AppError(ErrorCodes.GENERATION_FAILED, message, 500, details),

  toolExecution: (toolName, message, details = null) =>
    new AppError(ErrorCodes.TOOL_EXECUTION_FAILED, `Tool ${toolName} failed: ${message}`, 500, details)
};

/**
 * Track error costs (for LLM failures, API calls, etc.)
 */
const errorCosts = new Map();

export function trackErrorCost(errorCode, cost = 0) {
  if (!errorCosts.has(errorCode)) {
    errorCosts.set(errorCode, { count: 0, totalCost: 0 });
  }

  const stats = errorCosts.get(errorCode);
  stats.count++;
  stats.totalCost += cost;
  errorCosts.set(errorCode, stats);
}

export function getErrorStats() {
  return Object.fromEntries(errorCosts);
}

/**
 * Express error handling middleware
 */
export function errorMiddleware(err, req, res, next) {
  // If response already sent, delegate to default error handler
  if (res.headersSent) {
    return next(err);
  }

  // Log the error
  const logData = {
    error: err.message,
    code: err.code || 'UNKNOWN',
    statusCode: err.statusCode || 500,
    path: req.path,
    method: req.method,
    userId: req.userId,
    ip: req.ip
  };

  if (err.statusCode >= 500) {
    logger.error(logData, 'Server error');
  } else {
    logger.warn(logData, 'Client error');
  }

  // Track error for monitoring
  if (err.code) {
    trackErrorCost(err.code, err.cost || 0);
  }

  // Send structured error response
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Handle Prisma errors
  if (err.code?.startsWith('P')) {
    return res.status(400).json({
      error: {
        code: ErrorCodes.DATABASE_ERROR,
        message: 'Database operation failed',
        details: process.env.NODE_ENV === 'development' ? err.message : null,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Handle OpenAI errors
  if (err.error?.type === 'invalid_request_error' || err.response?.status === 429) {
    return res.status(502).json({
      error: {
        code: ErrorCodes.OPENAI_ERROR,
        message: 'AI service error',
        details: process.env.NODE_ENV === 'development' ? err.message : 'Please try again later',
        timestamp: new Date().toISOString()
      }
    });
  }

  // Default error response
  return res.status(500).json({
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'development' ? err.message : 'An internal error occurred',
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Async handler wrapper to catch promise rejections
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validate request body against schema
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({ field, message: `${field} is required` });
        continue;
      }

      if (value !== undefined && value !== null) {
        if (rules.type && typeof value !== rules.type) {
          errors.push({ field, message: `${field} must be of type ${rules.type}` });
        }

        if (rules.minLength && value.length < rules.minLength) {
          errors.push({ field, message: `${field} must be at least ${rules.minLength} characters` });
        }

        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push({ field, message: `${field} must be at most ${rules.maxLength} characters` });
        }

        if (rules.min && value < rules.min) {
          errors.push({ field, message: `${field} must be at least ${rules.min}` });
        }

        if (rules.max && value > rules.max) {
          errors.push({ field, message: `${field} must be at most ${rules.max}` });
        }

        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push({ field, message: `${field} format is invalid` });
        }

        if (rules.enum && !rules.enum.includes(value)) {
          errors.push({ field, message: `${field} must be one of: ${rules.enum.join(', ')}` });
        }
      }
    }

    if (errors.length > 0) {
      return next(createError.validation('Validation failed', errors));
    }

    next();
  };
}
