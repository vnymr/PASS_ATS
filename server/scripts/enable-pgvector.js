/**
 * Script to enable pgvector extension on the database
 * This needs to be run with appropriate database privileges
 */

import 'dotenv/config';
import postgres from 'postgres';

const DATABASE_URL = process.env.EMBEDDINGS_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ No database URL found');
  process.exit(1);
}

console.log('🔌 Connecting to database...');

// Try different SSL configurations
const sslConfig = DATABASE_URL.includes('sslmode=require')
  ? 'require'
  : DATABASE_URL.includes('localhost')
  ? false
  : { rejectUnauthorized: false };

const sql = postgres(DATABASE_URL, {
  prepare: false,
  ssl: sslConfig,
  max: 1,
  connect_timeout: 10
});

async function enablePgVector() {
  try {
    console.log('📦 Attempting to enable pgvector extension...');

    // Try to create the extension
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;

    console.log('✅ pgvector extension enabled successfully!');

    // Verify it's installed
    const result = await sql`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'vector'
    `;

    if (result.length > 0) {
      console.log('✅ Verified: pgvector version', result[0].extversion);
    } else {
      console.warn('⚠️  Extension created but not found in pg_extension');
    }

    // Check available extensions
    console.log('\n📋 Checking available extensions...');
    const available = await sql`
      SELECT name, default_version, comment
      FROM pg_available_extensions
      WHERE name = 'vector'
    `;

    if (available.length > 0) {
      console.log('✅ pgvector is available:', available[0]);
    } else {
      console.log('❌ pgvector is NOT available on this PostgreSQL instance');
      console.log('\n📖 To enable pgvector on Railway:');
      console.log('1. Railway PostgreSQL may need pgvector to be installed at the system level');
      console.log('2. Contact Railway support or use a database that supports pgvector');
      console.log('3. Alternative: Use Supabase which has pgvector enabled by default');
    }

    await sql.end({ timeout: 5 });
    process.exit(0);

  } catch (error) {
    console.error('❌ Failed to enable pgvector:', error.message);

    if (error.message.includes('not available')) {
      console.log('\n📖 pgvector extension is not installed on this PostgreSQL server.');
      console.log('Options:');
      console.log('1. Use Supabase (has pgvector built-in)');
      console.log('2. Use a PostgreSQL instance with pgvector installed');
      console.log('3. Contact Railway support to enable pgvector');
    } else if (error.message.includes('permission')) {
      console.log('\n📖 You may need superuser permissions to install extensions.');
    }

    await sql.end({ timeout: 5 });
    process.exit(1);
  }
}

enablePgVector();
