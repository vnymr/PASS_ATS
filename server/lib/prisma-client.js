import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import logger from './logger.js';

// Load environment variables if not already loaded
if (!process.env.DATABASE_URL) {
  dotenv.config();
  dotenv.config({ path: '.env.local' });
}

// Create a single instance of PrismaClient to be shared across the application
const globalForPrisma = global;

/**
 * Configure DATABASE_URL with connection pool parameters
 *
 * Connection Pool Configuration:
 * - connection_limit: 30 (up from default 10)
 *   - API server: ~10 connections
 *   - Background workers (auto-apply, resume generation): ~15 connections
 *   - Cron jobs: ~5 connections
 * - pool_timeout: 20 seconds (prevents deadlocks)
 * - connect_timeout: 10 seconds (faster failure detection)
 */
function configureDatabaseUrl() {
  const baseUrl = process.env.DATABASE_URL;

  if (!baseUrl) {
    logger.error('DATABASE_URL not set');
    return baseUrl;
  }

  try {
    const url = new URL(baseUrl);

    // Add connection pool parameters if not already present
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '30');
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '20');
    }
    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', '10');
    }

    const configuredUrl = url.toString();
    logger.info({
      connectionLimit: url.searchParams.get('connection_limit'),
      poolTimeout: url.searchParams.get('pool_timeout'),
      connectTimeout: url.searchParams.get('connect_timeout')
    }, 'Database connection pool configured');

    return configuredUrl;
  } catch (error) {
    logger.warn({ error: error.message }, 'Failed to parse DATABASE_URL, using as-is');
    return baseUrl;
  }
}

// Prisma Client with configured connection pooling
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
    errorFormat: 'minimal',
    datasources: {
      db: {
        url: configureDatabaseUrl()
      }
    }
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Connection health monitoring and keep-alive
let connectionHealthCheckInterval = null;

/**
 * Start connection health monitoring with keep-alive queries
 * Runs a lightweight query every 2 hours to prevent connection drops
 */
export function startConnectionHealthCheck() {
  if (connectionHealthCheckInterval) {
    return; // Already running
  }

  // Run health check every 2 hours (7200000ms)
  // This is less than PostgreSQL's default idle timeout
  connectionHealthCheckInterval = setInterval(async () => {
    try {
      // Simple query to keep connection alive
      await prisma.$queryRaw`SELECT 1`;
      logger.debug('PostgreSQL connection health check passed');
    } catch (error) {
      logger.error({
        error: error.message,
        code: error.code
      }, 'PostgreSQL connection health check failed - attempting reconnect');

      // Try to reconnect
      try {
        await prisma.$disconnect();
        await prisma.$connect();
        logger.info('PostgreSQL reconnected successfully');
      } catch (reconnectError) {
        logger.error({
          error: reconnectError.message
        }, 'PostgreSQL reconnection failed');
      }
    }
  }, 7200000); // 2 hours

  logger.info('PostgreSQL connection health monitoring started');
}

/**
 * Stop connection health monitoring
 */
export function stopConnectionHealthCheck() {
  if (connectionHealthCheckInterval) {
    clearInterval(connectionHealthCheckInterval);
    connectionHealthCheckInterval = null;
    logger.info('PostgreSQL connection health monitoring stopped');
  }
}

// Auto-start health monitoring in production
if (process.env.NODE_ENV === 'production') {
  startConnectionHealthCheck();
}

// Graceful shutdown handler
async function handleShutdown() {
  logger.info('Shutting down Prisma client...');
  stopConnectionHealthCheck();
  await prisma.$disconnect();
  logger.info('Prisma client disconnected');
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
process.on('beforeExit', handleShutdown);

export default prisma;