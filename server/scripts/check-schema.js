/**
 * Check if extraction fields exist in database
 */

import { prisma } from '../lib/prisma-client.js';

async function checkSchema() {
  try {
    console.log('🔍 Checking database schema...\n');

    // Try to query with extraction fields
    const job = await prisma.aggregatedJob.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        company: true,
        extractedSkills: true,
        extractedExperience: true,
        lastExtractedAt: true
      }
    });

    if (job) {
      console.log('✅ Extraction fields exist in database!');
      console.log('\nSample job:');
      console.log(`   Title: ${job.title}`);
      console.log(`   Company: ${job.company}`);
      console.log(`   extractedSkills: ${JSON.stringify(job.extractedSkills)}`);
      console.log(`   extractedExperience: ${job.extractedExperience}`);
      console.log(`   lastExtractedAt: ${job.lastExtractedAt}`);

      // Count jobs with/without extraction
      const stats = await prisma.$queryRaw`
        SELECT
          COUNT(*) FILTER (WHERE "lastExtractedAt" IS NOT NULL) as extracted,
          COUNT(*) FILTER (WHERE "lastExtractedAt" IS NULL) as not_extracted,
          COUNT(*) as total
        FROM "AggregatedJob"
        WHERE "isActive" = true
      `;

      console.log('\n📊 Extraction stats:');
      console.log(`   Extracted: ${stats[0].extracted}`);
      console.log(`   Not extracted: ${stats[0].not_extracted}`);
      console.log(`   Total active jobs: ${stats[0].total}`);
    }

  } catch (error) {
    if (error.code === 'P2021' || error.message.includes('column')) {
      console.error('❌ Extraction fields DO NOT exist in database!');
      console.error('   You need to run the migration first:');
      console.error('   psql $DATABASE_URL -f server/migrations/add_job_extraction_metadata.sql');
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema();
