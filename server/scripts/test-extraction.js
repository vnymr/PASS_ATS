/**
 * Test job metadata extraction
 */

import { extractJobMetadata } from '../lib/job-metadata-extractor.js';
import { prisma } from '../lib/prisma-client.js';

async function testExtraction() {
  try {
    console.log('🔍 Testing job metadata extraction...\n');

    // Get a sample job from database
    const sampleJob = await prisma.aggregatedJob.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        company: true,
        description: true,
        requirements: true,
        extractedSkills: true,
        extractedExperience: true,
        lastExtractedAt: true
      }
    });

    if (!sampleJob) {
      console.error('❌ No active jobs found in database');
      process.exit(1);
    }

    console.log('📋 Sample Job:');
    console.log(`   Title: ${sampleJob.title}`);
    console.log(`   Company: ${sampleJob.company}`);
    console.log(`   Description length: ${sampleJob.description?.length || 0} chars`);
    console.log(`   Has requirements: ${!!sampleJob.requirements}`);
    console.log(`   Last extracted: ${sampleJob.lastExtractedAt || 'Never'}`);
    console.log(`   Current extracted skills: ${JSON.stringify(sampleJob.extractedSkills)}`);
    console.log(`   Current extracted experience: ${sampleJob.extractedExperience || 'None'}`);
    console.log();

    // Test extraction
    console.log('🤖 Running extraction...\n');
    const metadata = await extractJobMetadata(
      sampleJob.title,
      sampleJob.description,
      sampleJob.requirements
    );

    console.log('✅ Extraction Result:');
    console.log(JSON.stringify(metadata, null, 2));
    console.log();

    // Update the job
    console.log('💾 Updating job in database...');
    await prisma.aggregatedJob.update({
      where: { id: sampleJob.id },
      data: metadata
    });

    console.log('✅ Job updated successfully!');
    console.log();

    // Verify update
    const updated = await prisma.aggregatedJob.findUnique({
      where: { id: sampleJob.id },
      select: {
        extractedSkills: true,
        extractedExperience: true,
        extractedJobLevel: true,
        extractedBenefits: true,
        extractionConfidence: true
      }
    });

    console.log('📊 Verified extracted data:');
    console.log(JSON.stringify(updated, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testExtraction();
