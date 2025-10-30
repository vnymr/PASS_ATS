/**
 * Migrate data from Supabase to Railway PostgreSQL
 * This script uses Prisma to copy all data between databases
 */

import { PrismaClient } from '@prisma/client';

// Source: Supabase
const supabase = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.aiewgwtsxwkxybcskfyg:D%40dl0ve0@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require&sslaccept=accept_invalid_certs'
    }
  }
});

// Target: Railway
const railway = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:WzStSQdrfxlcQBcMoHvEBVjRsXjZGreH@hopper.proxy.rlwy.net:45502/railway'
    }
  }
});

async function migrate() {
  try {
    console.log('🚀 Starting data migration from Supabase to Railway...\n');

    // Get all model names from Prisma
    const models = [
      'User',
      'Profile',
      'Job',
      'Artifact',
      'AutoApplication',
      'SubscriptionTier',
      'UserSubscription',
      'Payment'
    ];

    for (const modelName of models) {
      try {
        console.log(`📦 Migrating ${modelName}...`);

        // Read from Supabase
        const data = await supabase[modelName.charAt(0).toLowerCase() + modelName.slice(1)].findMany();

        if (data.length === 0) {
          console.log(`   ⏭️  No ${modelName} records to migrate\n`);
          continue;
        }

        // Write to Railway
        let successCount = 0;
        for (const record of data) {
          try {
            await railway[modelName.charAt(0).toLowerCase() + modelName.slice(1)].create({
              data: record
            });
            successCount++;
          } catch (error) {
            // Handle unique constraint violations (record already exists)
            if (error.code === 'P2002') {
              console.log(`   ⚠️  Skipping duplicate ${modelName} record`);
            } else {
              throw error;
            }
          }
        }

        console.log(`   ✅ Migrated ${successCount}/${data.length} ${modelName} records\n`);
      } catch (error) {
        console.error(`   ❌ Error migrating ${modelName}:`, error.message);
        console.log(`   Continuing with next model...\n`);
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Verify data in Railway dashboard');
    console.log('2. Update DATABASE_URL in Railway environment variables');
    console.log('3. Test your application');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await supabase.$disconnect();
    await railway.$disconnect();
  }
}

migrate();
