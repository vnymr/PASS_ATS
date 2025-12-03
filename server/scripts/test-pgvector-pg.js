/**
 * Test pgvector using pg library (alternative to postgres)
 */

import 'dotenv/config';
import pg from 'pg';

const DATABASE_URL = process.env.EMBEDDINGS_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ No database URL found');
  process.exit(1);
}

console.log('🔌 Connecting to database with pg library...');
console.log('📍 Host:', DATABASE_URL.match(/@([^:]+)/)?.[1]);

const client = new pg.Client({
  connectionString: DATABASE_URL
  // No SSL - Railway doesn't support it for this database
});

async function testPgVector() {
  try {
    await client.connect();
    console.log('✅ Connected successfully!');

    // Check if vector extension exists
    const extCheck = await client.query(`
      SELECT * FROM pg_available_extensions WHERE name = 'vector'
    `);

    if (extCheck.rows.length > 0) {
      console.log('✅ pgvector is available:', extCheck.rows[0]);

      // Try to enable it
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      console.log('✅ pgvector extension enabled!');

      // Verify it's enabled
      const verify = await client.query(`
        SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'
      `);

      if (verify.rows.length > 0) {
        console.log('✅ Verified pgvector version:', verify.rows[0].extversion);
      }
    } else {
      console.log('❌ pgvector is NOT available on this database');
    }

    await client.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

testPgVector();
