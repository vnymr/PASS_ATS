import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

// Create a single instance of PrismaClient to be shared across the application
const globalForPrisma = global;

// Prisma Client configuration
// Note: Using Railway PostgreSQL database
// Prisma manages its own connection pool internally
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
    errorFormat: 'minimal',
    // Connection pool is managed by Prisma internally
    // DATABASE_URL is provided by Railway environment variables
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