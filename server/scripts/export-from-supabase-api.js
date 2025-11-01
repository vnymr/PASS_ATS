/**
 * Export data from Supabase using REST API
 * Then import to Railway PostgreSQL
 */

import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aiewgwtsxwkxybcskfyg.supabase.co';
// Prefer service_role from env; fallback to anon if not provided
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZXdnd3RzeHdreHliY3NrZnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NTU2MDQsImV4cCI6MjA3MzEzMTYwNH0._Mk4FZHB9B3tC7w2ciCEDg0gn1XcZLQVoRwa3OPai5c';

// Railway database
const railway = new PrismaClient();

async function fetchFromSupabase(table) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${table}: ${response.statusText}`);
  }

  return await response.json();
}

async function migrate() {
  try {
    console.log('🚀 Exporting from Supabase API...\n');

    const tables = [
      { api: 'User', prisma: 'user' },
      { api: 'Profile', prisma: 'profile' },
      { api: 'Job', prisma: 'job' },
      { api: 'Artifact', prisma: 'artifact' },
      { api: 'AutoApplication', prisma: 'autoApplication' },
      { api: 'Payment', prisma: 'payment' }
    ];

    for (const table of tables) {
      try {
        console.log(`📦 Fetching ${table.api} from Supabase API...`);
        const data = await fetchFromSupabase(table.api);

        if (data.length === 0) {
          console.log(`   ⏭️  No ${table.api} records\n`);
          continue;
        }

        console.log(`   Found ${data.length} records`);
        console.log(`   💾 Importing to Railway...`);

        let imported = 0;
        for (const record of data) {
          try {
            await railway[table.prisma].upsert({
              where: { id: record.id },
              update: record,
              create: record
            });
            imported++;
          } catch (err) {
            console.log(`   ⚠️  Skip: ${err.message}`);
          }
        }

        console.log(`   ✅ Imported ${imported}/${data.length} ${table.api} records\n`);

      } catch (error) {
        console.log(`   ❌ Error with ${table.api}:`, error.message);
        console.log(`   Continuing...\n`);
      }
    }

    console.log('✅ Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await railway.$disconnect();
  }
}

migrate();
