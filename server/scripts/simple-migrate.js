/**
 * Simple migration using direct queries
 */

import pg from 'pg';
const { Client } = pg;

// Supabase connection
const supabase = new Client({
  connectionString: 'postgresql://postgres.aiewgwtsxwkxybcskfyg:D@dl0ve0@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

// Railway connection
const railway = new Client({
  connectionString: 'postgresql://postgres:WzStSQdrfxlcQBcMoHvEBVjRsXjZGreH@hopper.proxy.rlwy.net:45502/railway',
  connectionTimeoutMillis: 30000,
});

async function migrate() {
  try {
    console.log('🔌 Connecting to Supabase...');
    await supabase.connect();
    console.log('✅ Connected to Supabase\n');

    console.log('🔌 Connecting to Railway...');
    await railway.connect();
    console.log('✅ Connected to Railway\n');

    // Get table names
    const tables = ['User', 'Profile', 'Job', 'Artifact', 'AutoApplication', 'Payment'];

    for (const table of tables) {
      try {
        console.log(`📦 Migrating ${table}...`);

        // Count records in Supabase
        const countResult = await supabase.query(`SELECT COUNT(*) FROM "${table}"`);
        const count = parseInt(countResult.rows[0].count);

        if (count === 0) {
          console.log(`   ⏭️  No ${table} records to migrate\n`);
          continue;
        }

        console.log(`   Found ${count} records`);

        // Get all data
        const data = await supabase.query(`SELECT * FROM "${table}"`);

        // Insert into Railway (we'll use ON CONFLICT DO NOTHING to skip duplicates)
        let inserted = 0;
        for (const row of data.rows) {
          const columns = Object.keys(row);
          const values = Object.values(row);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

          try {
            await railway.query(
              `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')})
               VALUES (${placeholders})
               ON CONFLICT DO NOTHING`,
              values
            );
            inserted++;
          } catch (err) {
            // Ignore conflicts
            if (err.code !== '23505') {
              console.log(`   ⚠️  Error inserting record:`, err.message);
            }
          }
        }

        console.log(`   ✅ Migrated ${inserted}/${count} ${table} records\n`);

      } catch (error) {
        console.log(`   ❌ Error with ${table}:`, error.message);
        console.log(`   Continuing...\n`);
      }
    }

    console.log('✅ Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await supabase.end();
    await railway.end();
  }
}

migrate();
