/**
 * Frontend logger utility
 * - Respects log levels based on environment
 * - Sanitizes sensitive information
 * - Production-safe logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDevelopment = import.meta.env.DEV;
const logLevel: LogLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel) || (isDevelopment ? 'debug' : 'info');

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[logLevel];

/**
 * Sanitize sensitive data from logs
 */
function sanitize(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  // Remove sensitive fields
  const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'authorization', 'cookie'];

  for (const key in sanitized) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Format log message with timestamp in development
 */
function formatMessage(level: string, message: string, ...args: any[]): any[] {
  if (isDevelopment) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    return [`[${timestamp}] [${level.toUpperCase()}]`, message, ...args.map(sanitize)];
  }
  return [message, ...args.map(sanitize)];
}

class Logger {
  debug(message: string, ...args: any[]) {
    if (currentLevel <= LOG_LEVELS.debug && isDevelopment) {
      console.log(...formatMessage('debug', message, ...args));
    }
  }

  info(message: string, ...args: any[]) {
    if (currentLevel <= LOG_LEVELS.info) {
      console.log(...formatMessage('info', message, ...args));
    }
  }

  warn(message: string, ...args: any[]) {
    if (currentLevel <= LOG_LEVELS.warn) {
      console.warn(...formatMessage('warn', message, ...args));
    }
  }

  error(message: string, ...args: any[]) {
    if (currentLevel <= LOG_LEVELS.error) {
      console.error(...formatMessage('error', message, ...args));
    }
  }

  /**
   * Create child logger with context
   */
  child(context: Record<string, any>) {
    const childLogger = new Logger();
    const sanitizedContext = sanitize(context);

    // Override methods to include context
    ['debug', 'info', 'warn', 'error'].forEach((method) => {
      const originalMethod = (childLogger as any)[method].bind(childLogger);
      (childLogger as any)[method] = (message: string, ...args: any[]) => {
        originalMethod(message, { ...sanitizedContext, ...args[0] }, ...args.slice(1));
      };
    });

    return childLogger;
  }
}

const logger = new Logger();

/**
 * API logger for request/response logging
 */
export const apiLogger = {
  request: (method: string, url: string, data?: any) => {
    logger.debug(`API Request: ${method} ${url}`, data ? sanitize(data) : undefined);
  },

  response: (method: string, url: string, status: number, data?: any) => {
    if (status >= 400) {
      logger.warn(`API Response: ${method} ${url} - ${status}`, data ? sanitize(data) : undefined);
    } else {
      logger.debug(`API Response: ${method} ${url} - ${status}`, data ? sanitize(data) : undefined);
    }
  },

  error: (method: string, url: string, error: Error) => {
    logger.error(`API Error: ${method} ${url}`, {
      message: error.message,
      name: error.name,
    });
  },
};

/**
 * UI logger for user interactions and component lifecycle
 */
export const uiLogger = {
  interaction: (component: string, action: string, details?: any) => {
    logger.debug(`UI: ${component} - ${action}`, details);
  },

  render: (component: string, props?: any) => {
    logger.debug(`Render: ${component}`, props ? sanitize(props) : undefined);
  },

  error: (component: string, error: Error) => {
    logger.error(`UI Error: ${component}`, {
      message: error.message,
      name: error.name,
    });
  },
};

/**
 * Auth logger for authentication events
 */
export const authLogger = {
  attempt: (method: string) => {
    logger.debug(`Auth attempt: ${method}`);
  },

  success: (userId: string) => {
    logger.info(`Auth success`, { userId });
  },

  failure: (reason: string) => {
    logger.warn(`Auth failure: ${reason}`);
  },

  logout: () => {
    logger.info('User logged out');
  },
};

export default logger;
