/**
 * Initialize the embeddings database with pgvector schema
 * Reads and executes the SQL from scripts/sql/embeddings_init.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { embeddingsDb, testConnection, closeConnection } from '../lib/embeddings-db.js';
import logger from '../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initEmbeddingsDb() {
  try {
    logger.info('Starting embeddings database initialization...');

    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to embeddings database');
    }

    // Check if pgvector extension is available
    let hasVectorExtension = false;
    try {
      await embeddingsDb`CREATE EXTENSION IF NOT EXISTS vector`;
      hasVectorExtension = true;
      logger.info('pgvector extension available');
    } catch (error) {
      logger.warn({ error: error.message }, 'pgvector extension not available - this is required for semantic search');
      logger.warn('To enable pgvector on Railway PostgreSQL:');
      logger.warn('1. Go to your Railway project dashboard');
      logger.warn('2. Select your PostgreSQL database');
      logger.warn('3. Go to Connect > Connection Settings');
      logger.warn('4. Run: CREATE EXTENSION vector; in the Query tab');
      logger.warn('Or use a database that supports pgvector (like Supabase)');
      throw new Error('pgvector extension not available');
    }

    // Read SQL file
    const sqlPath = path.join(__dirname, 'sql', 'embeddings_init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    logger.info({ sqlPath }, 'Loaded SQL initialization script');

    // Execute SQL (postgres library handles multi-statement execution)
    await embeddingsDb.unsafe(sql);

    logger.info('Embeddings database initialized successfully!');

    // Verify the table was created
    const tableCheck = await embeddingsDb`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'conversation_summaries'
    `;

    if (tableCheck.length > 0) {
      logger.info({ table: tableCheck[0].table_name }, 'Verified conversation_summaries table exists');
    } else {
      logger.warn('conversation_summaries table not found after initialization');
    }

    // Check for pgvector extension
    const extensionCheck = await embeddingsDb`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'vector'
    `;

    if (extensionCheck.length > 0) {
      logger.info({ extension: extensionCheck[0].extname, version: extensionCheck[0].extversion }, 'Verified pgvector extension');
    } else {
      logger.warn('pgvector extension not found - vector operations will not work!');
    }

    await closeConnection();
    process.exit(0);

  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Failed to initialize embeddings database');
    process.exit(1);
  }
}

// Run initialization
initEmbeddingsDb();
