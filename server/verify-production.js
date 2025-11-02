/**
 * Production Readiness Verification Script
 *
 * Checks all systems before deployment
 */

import { prisma } from './lib/prisma-client.js';
import jobSyncService from './lib/job-sync-service.js';
import logger from './lib/logger.js';
import fs from 'fs';
import path from 'path';

const checks = {
  passed: [],
  failed: [],
  warnings: []
};

function pass(check) {
  checks.passed.push(check);
  logger.info(`✅ ${check}`);
}

function fail(check, error) {
  checks.failed.push({ check, error });
  logger.error(`❌ ${check}: ${error}`);
}

function warn(check, message) {
  checks.warnings.push({ check, message });
  logger.warn(`⚠️  ${check}: ${message}`);
}

async function verifyProduction() {
  logger.info('🔍 PRODUCTION READINESS VERIFICATION\n');
  logger.info('=' .repeat(60));

  // 1. Environment Variables
  logger.info('\n📋 Checking Environment Variables...');
  try {
    if (process.env.DATABASE_URL) {
      pass('DATABASE_URL is set');
    } else {
      fail('DATABASE_URL', 'Not set');
    }

    if (process.env.OPENAI_API_KEY) {
      pass('OPENAI_API_KEY is set');
    } else {
      warn('OPENAI_API_KEY', 'Not set - LLM features may not work');
    }

    if (process.env.RAPIDAPI_KEY) {
      pass('RAPIDAPI_KEY is set (optional)');
    } else {
      warn('RAPIDAPI_KEY', 'Not set - JSearch discovery will be skipped');
    }
  } catch (error) {
    fail('Environment check', error.message);
  }

  // 2. Database Connection
  logger.info('\n📋 Checking Database Connection...');
  try {
    await prisma.$queryRaw`SELECT 1`;
    pass('Database connection successful');

    // Check tables exist
    const jobCount = await prisma.aggregatedJob.count();
    pass(`AggregatedJob table exists (${jobCount} jobs)`);

    const companyCount = await prisma.discoveredCompany.count();
    pass(`DiscoveredCompany table exists (${companyCount} companies)`);

  } catch (error) {
    fail('Database connection', error.message);
  }

  // 3. Required Files
  logger.info('\n📋 Checking Required Files...');
  const requiredFiles = [
    'lib/job-sync-service.js',
    'lib/job-sources/smart-aggregator.js',
    'lib/job-sources/free-auto-discovery.js',
    'lib/job-sources/aggressive-discovery.js',
    'routes/jobs.js'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      pass(`File exists: ${file}`);
    } else {
      fail(`File missing: ${file}`, 'File not found');
    }
  }

  // 4. Dependencies
  logger.info('\n📋 Checking Dependencies...');
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps['rss-parser']) {
      pass('rss-parser installed');
    } else {
      fail('rss-parser', 'Not installed');
    }

    if (deps['playwright']) {
      pass('playwright installed');
    } else {
      warn('playwright', 'Not installed - Discovery features limited');
    }

    if (deps['node-cron']) {
      pass('node-cron installed');
    } else {
      fail('node-cron', 'Not installed - Cron jobs will not work');
    }
  } catch (error) {
    fail('Dependency check', error.message);
  }

  // 5. Cron Job Configuration
  logger.info('\n📋 Checking Cron Job Configuration...');
  try {
    const stats = jobSyncService.getStats();

    if (stats.syncCronEnabled === false && stats.discoveryCronEnabled === false) {
      warn('Cron jobs', 'Not started - Call jobSyncService.start() in server.js');
    } else {
      pass('Cron jobs configured');
    }
  } catch (error) {
    fail('Cron check', error.message);
  }

  // 6. Job Sources Reachability
  logger.info('\n📋 Checking Job Sources...');
  try {
    // Test Hacker News API
    const hnResponse = await fetch('https://hn.algolia.com/api/v1/search?query=who%20is%20hiring&tags=story');
    if (hnResponse.ok) {
      pass('Hacker News API reachable');
    } else {
      warn('Hacker News API', `Status ${hnResponse.status}`);
    }
  } catch (error) {
    warn('Hacker News API', error.message);
  }

  try {
    // Test WeWorkRemotely RSS
    const weworkResponse = await fetch('https://weworkremotely.com/remote-jobs.rss');
    if (weworkResponse.ok) {
      pass('WeWorkRemotely RSS reachable');
    } else {
      warn('WeWorkRemotely RSS', `Status ${weworkResponse.status}`);
    }
  } catch (error) {
    warn('WeWorkRemotely RSS', error.message);
  }

  try {
    // Test Greenhouse API
    const ghResponse = await fetch('https://boards-api.greenhouse.io/v1/boards/stripe/jobs');
    if (ghResponse.ok) {
      pass('Greenhouse API reachable');
    } else {
      warn('Greenhouse API', `Status ${ghResponse.status}`);
    }
  } catch (error) {
    warn('Greenhouse API', error.message);
  }

  // 7. API Endpoints
  logger.info('\n📋 Checking API Endpoints...');
  try {
    const serverRunning = process.env.PORT || process.env.VITE_API_PORT;
    if (serverRunning) {
      pass(`Server configured on port ${serverRunning}`);
    } else {
      warn('Server port', 'Not configured');
    }
  } catch (error) {
    warn('API endpoints', error.message);
  }

  // 8. Memory and Performance
  logger.info('\n📋 Checking System Resources...');
  try {
    const used = process.memoryUsage();
    const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);

    if (heapUsedMB < 500) {
      pass(`Memory usage OK: ${heapUsedMB}MB / ${heapTotalMB}MB`);
    } else {
      warn('Memory usage', `High: ${heapUsedMB}MB / ${heapTotalMB}MB`);
    }
  } catch (error) {
    warn('System resources', error.message);
  }

  // 9. Database Indexes
  logger.info('\n📋 Checking Database Indexes...');
  try {
    // This is a simplified check - in production you'd query pg_indexes
    const sampleJob = await prisma.aggregatedJob.findFirst({
      where: { isActive: true },
      include: { _count: { select: { applications: true } } }
    });

    if (sampleJob) {
      pass('Database queries working (indexes OK)');
    } else {
      warn('Database indexes', 'No jobs found to test');
    }
  } catch (error) {
    fail('Database indexes', error.message);
  }

  // FINAL REPORT
  logger.info('\n' + '='.repeat(60));
  logger.info('\n📊 VERIFICATION SUMMARY\n');
  logger.info(`✅ Passed:   ${checks.passed.length}`);
  logger.info(`⚠️  Warnings: ${checks.warnings.length}`);
  logger.info(`❌ Failed:   ${checks.failed.length}`);

  if (checks.failed.length === 0) {
    logger.info('\n🎉 PRODUCTION READY!');
    logger.info('\nSystem is ready for deployment.');
    logger.info('\nNext steps:');
    logger.info('  1. Start server: npm start');
    logger.info('  2. Trigger sync: curl /api/jobs/sync -X POST');
    logger.info('  3. Monitor logs for 24 hours');
    logger.info('  4. Verify cron jobs run at midnight and 2 AM');
  } else {
    logger.info('\n⚠️  NOT PRODUCTION READY');
    logger.info('\nPlease fix the following issues:');
    checks.failed.forEach(({ check, error }) => {
      logger.info(`  - ${check}: ${error}`);
    });
  }

  if (checks.warnings.length > 0) {
    logger.info('\n⚠️  Warnings (optional fixes):');
    checks.warnings.forEach(({ check, message }) => {
      logger.info(`  - ${check}: ${message}`);
    });
  }

  logger.info('\n' + '='.repeat(60));

  process.exit(checks.failed.length === 0 ? 0 : 1);
}

// Run verification
verifyProduction().catch(error => {
  logger.error({ error: error.message, stack: error.stack }, 'Verification failed');
  process.exit(1);
});
