/**
 * Dedicated embeddings database client using pgvector
 * Uses EMBEDDINGS_DATABASE_URL with fallback to DATABASE_URL
 */

import 'dotenv/config';
import postgres from 'postgres';
import logger from './logger.js';

// Read connection URL with fallback
const EMB_URL = process.env.EMBEDDINGS_DATABASE_URL || process.env.DATABASE_URL;

if (!EMB_URL) {
  logger.error('Neither EMBEDDINGS_DATABASE_URL nor DATABASE_URL is set');
  throw new Error('Database URL for embeddings not configured');
}

// Initialize postgres client for embeddings
// Note: SSL disabled as Railway embeddings DB doesn't support it
export const embeddingsDb = postgres(EMB_URL, {
  prepare: false,
  ssl: false,
  max: 10, // Connection pool size
  idle_timeout: 20,
  connect_timeout: 10,
});

/**
 * Execute a SQL statement (INSERT, UPDATE, DELETE)
 * @param {string} sql - SQL statement with $1, $2, etc. placeholders
 * @param {...any} params - Parameters for the query
 * @returns {Promise<Array>} - Result rows
 */
export async function execute(sql, ...params) {
  try {
    return await embeddingsDb.unsafe(sql, params);
  } catch (error) {
    logger.error({ error: error.message, sql: sql.substring(0, 100) }, 'Embeddings DB execute failed');
    throw error;
  }
}

/**
 * Query and return results (SELECT)
 * @param {string} sql - SQL query with $1, $2, etc. placeholders
 * @param {...any} params - Parameters for the query
 * @returns {Promise<Array>} - Result rows
 */
export async function query(sql, ...params) {
  try {
    return await embeddingsDb.unsafe(sql, params);
  } catch (error) {
    logger.error({ error: error.message, sql: sql.substring(0, 100) }, 'Embeddings DB query failed');
    throw error;
  }
}

/**
 * Test database connection
 * @returns {Promise<boolean>}
 */
export async function testConnection() {
  try {
    const result = await embeddingsDb`SELECT 1 as test`;
    logger.info({ result: result[0] }, 'Embeddings DB connection test successful');
    return true;
  } catch (error) {
    logger.error({ error: error.message }, 'Embeddings DB connection test failed');
    return false;
  }
}

/**
 * Close database connection (for graceful shutdown)
 */
export async function closeConnection() {
  try {
    await embeddingsDb.end({ timeout: 5 });
    logger.info('Embeddings DB connection closed');
  } catch (error) {
    logger.error({ error: error.message }, 'Error closing embeddings DB connection');
  }
}
