#!/usr/bin/env node

/**
 * Alternative migration approach using Node.js and pg library
 * This bypasses potential DNS/connectivity issues with psql
 */

import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configurations
const SUPABASE_CONFIG = {
  connectionString: 'postgresql://postgres.aiewgwtsxwkxybcskfyg:D@dl0ve0@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require&sslaccept=accept_invalid_certs',
  ssl: { rejectUnauthorized: false }
};

let RAILWAY_CONFIG = null;

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testConnection(config, name) {
  const client = new Client(config);
  try {
    await client.connect();
    await client.query('SELECT 1');
    log(`✅ ${name} connection successful`, 'green');
    await client.end();
    return true;
  } catch (error) {
    log(`❌ ${name} connection failed: ${error.message}`, 'red');
    await client.end().catch(() => {});
    return false;
  }
}

async function getTableCounts(config, name) {
  const client = new Client(config);
  try {
    await client.connect();

    const result = await client.query(`
      SELECT
        tablename,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);

    log(`\n📊 ${name} Table Counts:`, 'blue');
    console.table(result.rows);

    await client.end();
    return result.rows;
  } catch (error) {
    log(`❌ Failed to get table counts: ${error.message}`, 'red');
    await client.end().catch(() => {});
    return [];
  }
}

async function exportTable(sourceClient, tableName) {
  try {
    // Get all data from table
    const result = await sourceClient.query(`SELECT * FROM "${tableName}"`);
    return result.rows;
  } catch (error) {
    log(`  ⚠️  Error reading ${tableName}: ${error.message}`, 'yellow');
    return [];
  }
}

async function getTableSchema(client, tableName) {
  const result = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position;
  `, [tableName]);
  return result.rows;
}

async function migrateTable(sourceClient, targetClient, tableName) {
  try {
    log(`\n📦 Migrating table: ${tableName}`, 'blue');

    // Get data from source
    const data = await exportTable(sourceClient, tableName);

    if (data.length === 0) {
      log(`  ⏭️  No data to migrate`, 'yellow');
      return { success: true, count: 0 };
    }

    log(`  📊 Found ${data.length} rows`);

    // Get column names
    const columns = Object.keys(data[0]);
    const columnNames = columns.map(c => `"${c}"`).join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    // Insert data in batches
    let successCount = 0;
    let errorCount = 0;
    const batchSize = 100;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);

      for (const row of batch) {
        try {
          const values = columns.map(col => row[col]);
          await targetClient.query(
            `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`,
            values
          );
          successCount++;
        } catch (error) {
          // Check if it's a duplicate key error
          if (error.code === '23505') {
            log(`  ⚠️  Skipping duplicate row`, 'yellow');
          } else {
            log(`  ❌ Error inserting row: ${error.message}`, 'red');
            errorCount++;
          }
        }
      }

      // Progress update
      const progress = Math.min(i + batchSize, data.length);
      process.stdout.write(`  Progress: ${progress}/${data.length} rows\r`);
    }

    console.log(''); // New line after progress
    log(`  ✅ Migrated ${successCount}/${data.length} rows (${errorCount} errors)`, 'green');

    return { success: true, count: successCount, errors: errorCount };
  } catch (error) {
    log(`  ❌ Failed to migrate ${tableName}: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function fixSequences(client) {
  try {
    log('\n🔧 Fixing auto-increment sequences...', 'blue');

    await client.query(`
      DO $$
      DECLARE
          r RECORD;
          max_id INTEGER;
      BEGIN
          FOR r IN
              SELECT
                  table_name,
                  column_name,
                  pg_get_serial_sequence(table_name::text, column_name::text) as seq_name
              FROM information_schema.columns
              WHERE table_schema = 'public'
              AND column_default LIKE 'nextval%'
          LOOP
              IF r.seq_name IS NOT NULL THEN
                  EXECUTE format('SELECT COALESCE(MAX(%I), 0) + 1 FROM %I', r.column_name, r.table_name) INTO max_id;
                  EXECUTE format('ALTER SEQUENCE %s RESTART WITH %s', r.seq_name, max_id);
                  RAISE NOTICE 'Fixed sequence % to start at %', r.seq_name, max_id;
              END IF;
          END LOOP;
      END
      $$;
    `);

    log('✅ Sequences fixed', 'green');
  } catch (error) {
    log(`⚠️  Warning fixing sequences: ${error.message}`, 'yellow');
  }
}

async function main() {
  log('\n🚀 Supabase to Railway Migration (Node.js Method)\n', 'blue');
  log('='.repeat(60), 'blue');

  // Get Railway URL from user
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const railwayUrl = await new Promise(resolve => {
    rl.question('Enter Railway DATABASE_URL: ', answer => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (!railwayUrl) {
    log('❌ Railway URL is required', 'red');
    process.exit(1);
  }

  RAILWAY_CONFIG = {
    connectionString: railwayUrl,
    // Always allow connecting even if the cert chain is self-signed (hosted DBs)
    ssl: { rejectUnauthorized: false }
  };

  // Step 1: Test connections
  log('\n📡 Testing database connections...', 'blue');
  const supabaseOk = await testConnection(SUPABASE_CONFIG, 'Supabase');
  const railwayOk = await testConnection(RAILWAY_CONFIG, 'Railway');

  if (!supabaseOk || !railwayOk) {
    log('\n❌ Cannot proceed with migration - connection failed', 'red');
    process.exit(1);
  }

  // Step 2: Get statistics
  await getTableCounts(SUPABASE_CONFIG, 'Supabase (Source)');

  // Step 3: Confirm migration
  const confirmRl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const confirm = await new Promise(resolve => {
    confirmRl.question('\n⚠️  This will overwrite data in Railway. Continue? (yes/no): ', answer => {
      confirmRl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });

  if (!confirm) {
    log('❌ Migration cancelled', 'red');
    process.exit(0);
  }

  // Step 4: Perform migration
  const sourceClient = new Client(SUPABASE_CONFIG);
  const targetClient = new Client(RAILWAY_CONFIG);

  try {
    await sourceClient.connect();
    await targetClient.connect();

    log('\n🔄 Starting migration...', 'blue');

    // Get list of tables in correct order (respecting foreign keys)
    const tablesResult = await sourceClient.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);

    const tables = tablesResult.rows.map(r => r.tablename);

    // Define migration order to respect foreign keys
    const migrationOrder = [
      'User',
      'Profile',
      'Subscription',
      'UsageTracking',
      'Payment',
      'Job',
      'Artifact',
      'Embedding',
      'AggregatedJob',
      'AutoApplication',
      'ApplicationRecipe',
      'RecipeExecution',
      'DiscoveredCompany'
    ];

    // Migrate tables that exist in both lists
    const tablesToMigrate = migrationOrder.filter(t =>
      tables.includes(t) || tables.includes(t.toLowerCase())
    );

    const results = {};

    for (const table of tablesToMigrate) {
      const actualTableName = tables.find(t => t.toLowerCase() === table.toLowerCase()) || table;
      results[actualTableName] = await migrateTable(sourceClient, targetClient, actualTableName);
    }

    // Fix sequences
    await fixSequences(targetClient);

    // Final verification
    log('\n📊 Migration Results:', 'blue');
    await getTableCounts(RAILWAY_CONFIG, 'Railway (Target)');

    log('\n✅ Migration completed!', 'green');
    log('\nNext steps:', 'blue');
    log('1. Verify data in Railway dashboard');
    log('2. Update DATABASE_URL in Railway environment');
    log('3. Test your application');

  } catch (error) {
    log(`\n❌ Migration failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await sourceClient.end().catch(() => {});
    await targetClient.end().catch(() => {});
  }
}

main().catch(console.error);
