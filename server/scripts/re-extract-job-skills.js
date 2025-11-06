/**
 * Re-extract skills from existing jobs using enhanced extraction
 * This will update all jobs with comprehensive skill extraction
 */

import { prisma } from '../lib/prisma-client.js';
import { extractJobMetadata } from '../lib/job-metadata-extractor.js';
import logger from '../lib/logger.js';

async function reExtractJobSkills() {
  try {
    console.log('🔄 Re-extracting skills from existing jobs with enhanced extraction...\n');

    // Get jobs that need re-extraction (no skills or old extraction)
    const jobs = await prisma.aggregatedJob.findMany({
      where: {
        isActive: true,
        OR: [
          { extractedSkills: { isEmpty: true } },
          { lastExtractedAt: null },
          { lastExtractedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } // Older than 30 days
        ]
      },
      take: 100, // Process 100 at a time
      select: {
        id: true,
        title: true,
        company: true,
        description: true,
        requirements: true,
        extractedSkills: true
      }
    });

    if (jobs.length === 0) {
      console.log('✓ All jobs already have skills extracted!');
      return;
    }

    console.log(`Found ${jobs.length} jobs to re-extract\n`);

    let successCount = 0;
    let failCount = 0;

    // Process jobs in batches of 5 to avoid rate limits
    for (let i = 0; i < jobs.length; i += 5) {
      const batch = jobs.slice(i, i + 5);
      console.log(`Processing batch ${Math.floor(i / 5) + 1}/${Math.ceil(jobs.length / 5)}...`);

      const results = await Promise.allSettled(
        batch.map(async (job) => {
          // Extract metadata with enhanced extraction
          const metadata = await extractJobMetadata(job.title, job.description, job.requirements);

          // Update job with new metadata
          await prisma.aggregatedJob.update({
            where: { id: job.id },
            data: {
              extractedSkills: metadata.extractedSkills,
              extractedExperience: metadata.extractedExperience,
              extractedEducation: metadata.extractedEducation,
              extractedJobLevel: metadata.extractedJobLevel,
              extractedKeywords: metadata.extractedKeywords,
              extractedBenefits: metadata.extractedBenefits,
              extractionConfidence: metadata.extractionConfidence,
              lastExtractedAt: metadata.lastExtractedAt
            }
          });

          return {
            title: job.title,
            company: job.company,
            oldSkillCount: job.extractedSkills?.length || 0,
            newSkillCount: metadata.extractedSkills.length
          };
        })
      );

      // Process results
      results.forEach((result, idx) => {
        const job = batch[idx];
        if (result.status === 'fulfilled') {
          successCount++;
          const { oldSkillCount, newSkillCount } = result.value;
          console.log(`  ✓ ${job.title} at ${job.company}`);
          console.log(`    Skills: ${oldSkillCount} → ${newSkillCount}`);
        } else {
          failCount++;
          console.log(`  ✗ ${job.title} at ${job.company}`);
          console.log(`    Error: ${result.reason.message}`);
        }
      });

      console.log('');

      // Small delay between batches
      if (i + 5 < jobs.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  Success: ${successCount}`);
    console.log(`  Failed: ${failCount}`);
    console.log(`  Total: ${jobs.length}`);

    // Show sample of updated jobs
    console.log('\n📋 Sample of updated jobs:');
    const updatedJobs = await prisma.aggregatedJob.findMany({
      where: {
        id: { in: jobs.slice(0, 3).map(j => j.id) }
      },
      select: {
        title: true,
        company: true,
        extractedSkills: true,
        extractedKeywords: true,
        extractionConfidence: true
      }
    });

    updatedJobs.forEach((job, idx) => {
      console.log(`\n${idx + 1}. ${job.title} at ${job.company}`);
      console.log(`   Skills (${job.extractedSkills.length}): ${job.extractedSkills.slice(0, 10).join(', ')}${job.extractedSkills.length > 10 ? '...' : ''}`);
      console.log(`   Keywords (${job.extractedKeywords.length}): ${job.extractedKeywords.slice(0, 8).join(', ')}${job.extractedKeywords.length > 8 ? '...' : ''}`);
      console.log(`   Confidence: ${(job.extractionConfidence * 100).toFixed(0)}%`);
    });

    console.log('\n✅ Re-extraction completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
reExtractJobSkills();
