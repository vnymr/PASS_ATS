/**
 * End-to-End Auto-Apply Test
 * Tests the complete flow from direct-auto-apply through browser automation
 */

import 'dotenv/config';
import { processAutoApplyDirect } from '../lib/direct-auto-apply.js';
import { prisma } from '../lib/prisma-client.js';

// Test with a real Greenhouse job URL
const TEST_JOB_URL = 'https://boards.greenhouse.io/anthropic/jobs/4183255008';

async function createTestApplication() {
  console.log('\n========================================');
  console.log('STEP 1: Creating Test Application Record');
  console.log('========================================\n');

  // Find an existing user with a profile
  let testUser = await prisma.user.findFirst({
    where: {
      profile: {
        isNot: null
      }
    },
    include: { profile: true }
  });

  if (!testUser) {
    console.error('No user with profile found. Please create a user with profile data first.');
    process.exit(1);
  }

  console.log('Using existing user:', testUser.id, testUser.email);

  // Ensure user has profile data for auto-apply
  const profileData = testUser.profile?.data;
  if (!profileData) {
    console.error('User profile has no data. Please add profile data first.');
    process.exit(1);
  }

  console.log('Profile data keys:', Object.keys(profileData));

  // Find an existing AI-applyable job (prefer Greenhouse for testing)
  let testJob = await prisma.aggregatedJob.findFirst({
    where: {
      aiApplyable: true,
      isActive: true,
      atsType: 'greenhouse'
    },
    orderBy: { postedDate: 'desc' }
  });

  // Fallback to any AI-applyable job
  if (!testJob) {
    testJob = await prisma.aggregatedJob.findFirst({
      where: {
        aiApplyable: true,
        isActive: true
      },
      orderBy: { postedDate: 'desc' }
    });
  }

  if (!testJob) {
    console.error('No AI-applyable jobs found in database.');
    console.error('Run the job aggregation first to populate jobs.');
    process.exit(1);
  }

  console.log('Using existing job:', testJob.id, testJob.title, 'at', testJob.company);
  console.log('ATS Type:', testJob.atsType);
  console.log('Apply URL:', testJob.applyUrl);

  // Create application record
  console.log('Creating application record...');

  // First delete any existing application for this user/job
  await prisma.autoApplication.deleteMany({
    where: {
      userId: testUser.id,
      jobId: testJob.id
    }
  });

  const application = await prisma.autoApplication.create({
    data: {
      userId: testUser.id,
      jobId: testJob.id,
      status: 'QUEUED',
      method: 'AI_AUTO'
    }
  });

  console.log('Application created:', application.id);

  return {
    application,
    job: testJob,
    user: testUser
  };
}

async function testDirectAutoApply() {
  console.log('\n========================================');
  console.log('STEP 2: Testing Direct Auto-Apply');
  console.log('========================================\n');

  const { application, job, user } = await createTestApplication();

  console.log('Starting auto-apply process...');
  console.log(`Job URL: ${job.applyUrl}`);
  console.log(`ATS Type: ${job.atsType}`);
  console.log('');

  try {
    const result = await processAutoApplyDirect({
      applicationId: application.id,
      jobUrl: job.applyUrl,
      atsType: job.atsType,
      userId: user.id,
      user: user
    });

    console.log('\n--- Result ---');
    console.log('Success:', result.success);
    console.log('Application ID:', result.applicationId);
    console.log('Method:', result.method);

    // Check final application status
    const finalApplication = await prisma.autoApplication.findUnique({
      where: { id: application.id }
    });

    console.log('\n--- Final Application Status ---');
    console.log('Status:', finalApplication.status);
    console.log('Error:', finalApplication.error || 'None');
    console.log('Submitted At:', finalApplication.submittedAt);

    return result;

  } catch (error) {
    console.error('\n--- Error ---');
    console.error('Message:', error.message);

    // Check application status after error
    const finalApplication = await prisma.autoApplication.findUnique({
      where: { id: application.id }
    });

    console.log('\n--- Application Status After Error ---');
    console.log('Status:', finalApplication?.status);
    console.log('Error:', finalApplication?.error);

    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('END-TO-END AUTO-APPLY TEST');
  console.log('='.repeat(50));
  console.log('');
  console.log('This test will:');
  console.log('1. Create a test application record');
  console.log('2. Run processAutoApplyDirect()');
  console.log('3. Verify browser automation works');
  console.log('');
  console.log('Environment:');
  console.log(`  USE_CAMOUFOX: ${process.env.USE_CAMOUFOX}`);
  console.log(`  CAMOUFOX_WS_ENDPOINT: ${process.env.CAMOUFOX_WS_ENDPOINT}`);
  console.log('');

  try {
    const result = await testDirectAutoApply();

    console.log('\n' + '='.repeat(50));
    console.log('TEST COMPLETE');
    console.log('='.repeat(50));
    console.log('');
    console.log(`Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);

    if (!result.success) {
      console.log(`Error: ${result.error}`);
    }

  } catch (error) {
    console.error('\nTest failed with error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
