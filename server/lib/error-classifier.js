/**
 * Error Classification System
 * Classifies errors to determine retry strategy
 */

import logger from './logger.js';

/**
 * Error types and their retry policies
 */
export const ErrorType = {
  // Retryable errors
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  SERVER_ERROR: 'SERVER_ERROR',
  CAPTCHA_TIMEOUT: 'CAPTCHA_TIMEOUT',
  PAGE_LOAD_TIMEOUT: 'PAGE_LOAD_TIMEOUT',
  BROWSER_CRASH: 'BROWSER_CRASH',
  DATABASE_TIMEOUT: 'DATABASE_TIMEOUT',
  DATABASE_LOCK: 'DATABASE_LOCK',

  // Non-retryable errors
  INVALID_URL: 'INVALID_URL',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  JOB_CLOSED: 'JOB_CLOSED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  PROFILE_INCOMPLETE: 'PROFILE_INCOMPLETE',
  CAPTCHA_UNSOLVABLE: 'CAPTCHA_UNSOLVABLE',
  FORM_NOT_FOUND: 'FORM_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',

  // Special handling
  CAPTCHA_FAILED: 'CAPTCHA_FAILED',
  DUPLICATE_APPLICATION: 'DUPLICATE_APPLICATION',
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',

  // Unknown
  UNKNOWN: 'UNKNOWN'
};

/**
 * Retry policies for each error type
 */
const RetryPolicies = {
  [ErrorType.NETWORK_TIMEOUT]: { shouldRetry: true, maxRetries: 3, backoffMs: 2000 },
  [ErrorType.NETWORK_ERROR]: { shouldRetry: true, maxRetries: 3, backoffMs: 2000 },
  [ErrorType.RATE_LIMIT]: { shouldRetry: true, maxRetries: 2, backoffMs: 60000 }, // 1 minute
  [ErrorType.SERVER_ERROR]: { shouldRetry: true, maxRetries: 2, backoffMs: 5000 },
  [ErrorType.CAPTCHA_TIMEOUT]: { shouldRetry: true, maxRetries: 2, backoffMs: 30000 },
  [ErrorType.PAGE_LOAD_TIMEOUT]: { shouldRetry: true, maxRetries: 2, backoffMs: 5000 },
  [ErrorType.BROWSER_CRASH]: { shouldRetry: true, maxRetries: 2, backoffMs: 3000 },
  [ErrorType.DATABASE_TIMEOUT]: { shouldRetry: true, maxRetries: 3, backoffMs: 1000 },
  [ErrorType.DATABASE_LOCK]: { shouldRetry: true, maxRetries: 3, backoffMs: 500 },

  [ErrorType.CAPTCHA_FAILED]: { shouldRetry: true, maxRetries: 1, backoffMs: 10000 },

  [ErrorType.INVALID_URL]: { shouldRetry: false, maxRetries: 0, backoffMs: 0 },
  [ErrorType.INVALID_CREDENTIALS]: { shouldRetry: false, maxRetries: 0, backoffMs: 0 },
  [ErrorType.JOB_NOT_FOUND]: { shouldRetry: false, maxRetries: 0, backoffMs: 0 },
  [ErrorType.JOB_CLOSED]: { shouldRetry: false, maxRetries: 0, backoffMs: 0 },
  [ErrorType.USER_NOT_FOUND]: { shouldRetry: false, maxRetries: 0, backoffMs: 0 },
  [ErrorType.PROFILE_INCOMPLETE]: { shouldRetry: false, maxRetries: 0, backoffMs: 0 },
  [ErrorType.CAPTCHA_UNSOLVABLE]: { shouldRetry: false, maxRetries: 0, backoffMs: 0 },
  [ErrorType.FORM_NOT_FOUND]: { shouldRetry: false, maxRetries: 0, backoffMs: 0 },
  [ErrorType.VALIDATION_ERROR]: { shouldRetry: false, maxRetries: 0, backoffMs: 0 },
  [ErrorType.CONFIGURATION_ERROR]: { shouldRetry: false, maxRetries: 0, backoffMs: 0 },
  [ErrorType.DUPLICATE_APPLICATION]: { shouldRetry: false, maxRetries: 0, backoffMs: 0 },
  [ErrorType.INSUFFICIENT_CREDITS]: { shouldRetry: false, maxRetries: 0, backoffMs: 0 },

  [ErrorType.UNKNOWN]: { shouldRetry: true, maxRetries: 1, backoffMs: 5000 }
};

/**
 * Classify an error
 * @param {Error} error - The error to classify
 * @returns {Object} { type: ErrorType, shouldRetry: boolean, userMessage: string }
 */
export function classifyError(error) {
  if (!error) {
    return {
      type: ErrorType.UNKNOWN,
      shouldRetry: false,
      userMessage: 'Unknown error occurred'
    };
  }

  const errorMessage = error.message?.toLowerCase() || '';
  const errorStack = error.stack?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';

  // Network errors
  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out') ||
    errorCode === 'etimedout' ||
    errorCode === 'econnaborted'
  ) {
    return {
      type: ErrorType.NETWORK_TIMEOUT,
      shouldRetry: true,
      userMessage: 'Connection timed out. This will be retried automatically.',
      retryPolicy: RetryPolicies[ErrorType.NETWORK_TIMEOUT]
    };
  }

  if (
    errorMessage.includes('network') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('enotfound') ||
    errorCode === 'econnrefused' ||
    errorCode === 'enotfound'
  ) {
    return {
      type: ErrorType.NETWORK_ERROR,
      shouldRetry: true,
      userMessage: 'Network error occurred. This will be retried automatically.',
      retryPolicy: RetryPolicies[ErrorType.NETWORK_ERROR]
    };
  }

  // Rate limiting
  if (
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorMessage.includes('429')
  ) {
    return {
      type: ErrorType.RATE_LIMIT,
      shouldRetry: true,
      userMessage: 'Rate limit exceeded. This will be retried after a delay.',
      retryPolicy: RetryPolicies[ErrorType.RATE_LIMIT]
    };
  }

  // Browser/Page errors
  if (
    errorMessage.includes('browser') ||
    errorMessage.includes('target closed') ||
    errorMessage.includes('target crashed') ||
    errorMessage.includes('disconnected')
  ) {
    return {
      type: ErrorType.BROWSER_CRASH,
      shouldRetry: true,
      userMessage: 'Browser error occurred. This will be retried automatically.',
      retryPolicy: RetryPolicies[ErrorType.BROWSER_CRASH]
    };
  }

  if (
    errorMessage.includes('page.goto') ||
    errorMessage.includes('navigation') ||
    errorMessage.includes('waiting for') ||
    errorMessage.includes('waituntil')
  ) {
    return {
      type: ErrorType.PAGE_LOAD_TIMEOUT,
      shouldRetry: true,
      userMessage: 'Page load timeout. This will be retried automatically.',
      retryPolicy: RetryPolicies[ErrorType.PAGE_LOAD_TIMEOUT]
    };
  }

  // CAPTCHA errors
  if (errorMessage.includes('captcha') && errorMessage.includes('timeout')) {
    return {
      type: ErrorType.CAPTCHA_TIMEOUT,
      shouldRetry: true,
      userMessage: 'CAPTCHA solving timed out. This will be retried.',
      retryPolicy: RetryPolicies[ErrorType.CAPTCHA_TIMEOUT]
    };
  }

  if (errorMessage.includes('captcha') && errorMessage.includes('unsolvable')) {
    return {
      type: ErrorType.CAPTCHA_UNSOLVABLE,
      shouldRetry: false,
      userMessage: 'This job requires a CAPTCHA that cannot be solved automatically.',
      retryPolicy: RetryPolicies[ErrorType.CAPTCHA_UNSOLVABLE]
    };
  }

  if (errorMessage.includes('captcha')) {
    return {
      type: ErrorType.CAPTCHA_FAILED,
      shouldRetry: true,
      userMessage: 'CAPTCHA solving failed. This will be retried once.',
      retryPolicy: RetryPolicies[ErrorType.CAPTCHA_FAILED]
    };
  }

  // Database errors
  if (
    errorMessage.includes('database') &&
    (errorMessage.includes('timeout') || errorMessage.includes('timed out'))
  ) {
    return {
      type: ErrorType.DATABASE_TIMEOUT,
      shouldRetry: true,
      userMessage: 'Database timeout. This will be retried automatically.',
      retryPolicy: RetryPolicies[ErrorType.DATABASE_TIMEOUT]
    };
  }

  if (
    errorMessage.includes('lock') ||
    errorMessage.includes('deadlock') ||
    errorCode === 'p2034' // Prisma transaction conflict
  ) {
    return {
      type: ErrorType.DATABASE_LOCK,
      shouldRetry: true,
      userMessage: 'Database lock detected. This will be retried automatically.',
      retryPolicy: RetryPolicies[ErrorType.DATABASE_LOCK]
    };
  }

  // Validation errors
  if (errorMessage.includes('invalid url') || errorMessage.includes('malformed')) {
    return {
      type: ErrorType.INVALID_URL,
      shouldRetry: false,
      userMessage: 'Invalid job URL. Please check the URL and try again.',
      retryPolicy: RetryPolicies[ErrorType.INVALID_URL]
    };
  }

  if (errorMessage.includes('job not found') || errorMessage.includes('404')) {
    return {
      type: ErrorType.JOB_NOT_FOUND,
      shouldRetry: false,
      userMessage: 'Job not found. It may have been removed or filled.',
      retryPolicy: RetryPolicies[ErrorType.JOB_NOT_FOUND]
    };
  }

  if (errorMessage.includes('job closed') || errorMessage.includes('no longer accepting')) {
    return {
      type: ErrorType.JOB_CLOSED,
      shouldRetry: false,
      userMessage: 'This job is no longer accepting applications.',
      retryPolicy: RetryPolicies[ErrorType.JOB_CLOSED]
    };
  }

  if (errorMessage.includes('profile') && errorMessage.includes('incomplete')) {
    return {
      type: ErrorType.PROFILE_INCOMPLETE,
      shouldRetry: false,
      userMessage: 'Your profile is incomplete. Please complete your profile before applying.',
      retryPolicy: RetryPolicies[ErrorType.PROFILE_INCOMPLETE]
    };
  }

  if (errorMessage.includes('duplicate') || errorMessage.includes('already applied')) {
    return {
      type: ErrorType.DUPLICATE_APPLICATION,
      shouldRetry: false,
      userMessage: 'You have already applied to this job.',
      retryPolicy: RetryPolicies[ErrorType.DUPLICATE_APPLICATION]
    };
  }

  if (errorMessage.includes('form not found') || errorMessage.includes('no fields')) {
    return {
      type: ErrorType.FORM_NOT_FOUND,
      shouldRetry: false,
      userMessage: 'Application form not found on this page.',
      retryPolicy: RetryPolicies[ErrorType.FORM_NOT_FOUND]
    };
  }

  if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
    return {
      type: ErrorType.INSUFFICIENT_CREDITS,
      shouldRetry: false,
      userMessage: 'Insufficient credits for CAPTCHA solving. Please contact support.',
      retryPolicy: RetryPolicies[ErrorType.INSUFFICIENT_CREDITS]
    };
  }

  if (errorMessage.includes('configuration') || errorMessage.includes('config')) {
    return {
      type: ErrorType.CONFIGURATION_ERROR,
      shouldRetry: false,
      userMessage: 'System configuration error. Please contact support.',
      retryPolicy: RetryPolicies[ErrorType.CONFIGURATION_ERROR]
    };
  }

  // Server errors (5xx)
  if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
    return {
      type: ErrorType.SERVER_ERROR,
      shouldRetry: true,
      userMessage: 'Server error occurred. This will be retried automatically.',
      retryPolicy: RetryPolicies[ErrorType.SERVER_ERROR]
    };
  }

  // Unknown error
  logger.warn({
    errorMessage,
    errorCode,
    errorStack: errorStack.substring(0, 500)
  }, 'Unclassified error');

  return {
    type: ErrorType.UNKNOWN,
    shouldRetry: true,
    userMessage: 'An unexpected error occurred. This will be retried.',
    retryPolicy: RetryPolicies[ErrorType.UNKNOWN]
  };
}

/**
 * Calculate retry delay with exponential backoff
 * @param {number} attemptNumber - Current attempt (0-indexed)
 * @param {number} baseDelayMs - Base delay in milliseconds
 * @param {number} maxDelayMs - Maximum delay in milliseconds (default: 5 minutes)
 * @returns {number} Delay in milliseconds
 */
export function calculateRetryDelay(attemptNumber, baseDelayMs, maxDelayMs = 300000) {
  // Exponential backoff: baseDelay * 2^attemptNumber
  const exponentialDelay = baseDelayMs * Math.pow(2, attemptNumber);

  // Add jitter (±20%) to prevent thundering herd
  const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);

  const delayWithJitter = exponentialDelay + jitter;

  // Cap at maxDelay
  return Math.min(delayWithJitter, maxDelayMs);
}

/**
 * Determine if error should be retried
 * @param {Error} error - The error
 * @param {number} attemptsMade - Number of attempts already made
 * @returns {Object} { shouldRetry: boolean, delayMs: number, reason: string }
 */
export function shouldRetryError(error, attemptsMade) {
  const classified = classifyError(error);
  const policy = classified.retryPolicy;

  if (!policy.shouldRetry) {
    return {
      shouldRetry: false,
      delayMs: 0,
      reason: 'Error type is not retryable',
      classification: classified
    };
  }

  if (attemptsMade >= policy.maxRetries) {
    return {
      shouldRetry: false,
      delayMs: 0,
      reason: `Maximum retry attempts (${policy.maxRetries}) reached`,
      classification: classified
    };
  }

  const delayMs = calculateRetryDelay(attemptsMade, policy.backoffMs);

  return {
    shouldRetry: true,
    delayMs,
    reason: `Retryable error, attempt ${attemptsMade + 1}/${policy.maxRetries}`,
    classification: classified
  };
}

export default {
  ErrorType,
  classifyError,
  calculateRetryDelay,
  shouldRetryError
};
