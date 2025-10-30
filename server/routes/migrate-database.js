/**
 * Database Migration Endpoint
 * ONE-TIME USE: Migrates data from Supabase to Railway
 *
 * Usage: GET /api/migrate-database?secret=YOUR_SECRET_KEY
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../lib/logger.js';

const router = express.Router();

// Security: Only allow migration if secret key matches
const MIGRATION_SECRET = process.env.MIGRATION_SECRET || 'change-this-secret-key-123';

router.get('/migrate-database', async (req, res) => {
  try {
    // Check secret key
    const { secret } = req.query;
    if (secret !== MIGRATION_SECRET) {
      logger.warn('Unauthorized migration attempt');
      return res.status(403).json({ error: 'Unauthorized - invalid secret key' });
    }

    logger.info('🚀 Starting database migration from Supabase to Railway...');

    // Source: Supabase
    const supabase = new PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://postgres.aiewgwtsxwkxybcskfyg:D%40dl0ve0@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require&sslaccept=accept_invalid_certs'
        }
      }
    });

    // Target: Current Railway DB (from process.env.DATABASE_URL)
    const railway = new PrismaClient();

    const results = {
      success: true,
      tables: {}
    };

    try {
      // Test connections
      await supabase.$connect();
      await railway.$connect();
      logger.info('✅ Both databases connected');

      // Migrate each table
      const tables = [
        { name: 'User', model: 'user' },
        { name: 'Profile', model: 'profile' },
        { name: 'Job', model: 'job' },
        { name: 'Artifact', model: 'artifact' },
        { name: 'AutoApplication', model: 'autoApplication' },
        { name: 'Payment', model: 'payment' }
      ];

      for (const table of tables) {
        try {
          logger.info(`📦 Migrating ${table.name}...`);

          // Read from Supabase
          const data = await supabase[table.model].findMany();

          if (data.length === 0) {
            logger.info(`   ⏭️  No ${table.name} records`);
            results.tables[table.name] = { source: 0, migrated: 0 };
            continue;
          }

          // Write to Railway
          let migrated = 0;
          for (const record of data) {
            try {
              await railway[table.model].upsert({
                where: { id: record.id },
                update: record,
                create: record
              });
              migrated++;
            } catch (err) {
              logger.warn({ error: err.message }, `Error upserting ${table.name} record`);
            }
          }

          logger.info(`   ✅ Migrated ${migrated}/${data.length} ${table.name} records`);
          results.tables[table.name] = { source: data.length, migrated };

        } catch (error) {
          logger.error({ error: error.message }, `Error migrating ${table.name}`);
          results.tables[table.name] = { error: error.message };
        }
      }

    } finally {
      await supabase.$disconnect();
      await railway.$disconnect();
    }

    logger.info('✅ Migration completed');

    res.json({
      success: true,
      message: 'Migration completed successfully',
      results
    });

  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, '❌ Migration failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
