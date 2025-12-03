/**
 * Test Worker End-to-End Flow
 * Tests the complete auto-apply flow: queue job → worker processes → result
 */

import { queueAutoApply, getQueueStats } from '../lib/auto-apply-queue.js';
import { prisma } from '../lib/prisma-client.js';
import logger from '../lib/logger.js';

// Test configuration
const TEST_USER_ID = 3; // Replace with actual test user ID
const TEST_JOB_URL = 'https://httpbin.org/forms/post'; // Test form
const TEST_ATS_TYPE = 'GENERIC';

async function runTest() {
  console.log('🧪 Testing Worker End-to-End Flow\n');
  console.log('=' .repeat(80));

  try {
    // Step 1: Check if user exists and has profile
    console.log('\n📋 Step 1: Checking user profile...');
    const user = await prisma.user.findUnique({
      where: { id: TEST_USER_ID },
      include: { profile: true }
    });

    if (!user) {
      console.error('❌ Test user not found! Please create a test user first.');
      console.log('\nRun this SQL to create a test user:');
      console.log(`
INSERT INTO "User" (email, "clerkUserId", "createdAt", "updatedAt")
VALUES ('test-worker@example.com', 'test_worker_001', NOW(), NOW())
RETURNING id;
      `);
      process.exit(1);
    }

    console.log(`✅ User found: ${user.email}`);

    if (!user.profile || !user.profile.data?.applicationData) {
      console.error('❌ User profile incomplete!');
      console.log('\nUser needs profile data with:');
      console.log('  - personalInfo (fullName, email, phone)');
      console.log('  - experience');
      console.log('  - education');
      console.log('  - skills');
      process.exit(1);
    }

    console.log('✅ Profile complete');

    // Step 2: Create application record
    console.log('\n📝 Step 2: Creating application record...');
    const application = await prisma.autoApplication.create({
      data: {
        userId: user.id,
        jobId: 'test-job-123',
        jobUrl: TEST_JOB_URL,
        atsType: TEST_ATS_TYPE,
        status: 'QUEUED'
      }
    });

    console.log(`✅ Application created: ${application.id}`);

    // Step 3: Queue the job
    console.log('\n📤 Step 3: Queueing auto-apply job...');
    const job = await queueAutoApply({
      applicationId: application.id,
      jobUrl: TEST_JOB_URL,
      atsType: TEST_ATS_TYPE,
      userId: user.id
    });

    console.log(`✅ Job queued: ${job.id}`);

    // Step 4: Monitor queue
    console.log('\n👀 Step 4: Monitoring queue...');
    console.log('   (Make sure worker is running: node auto-apply-worker.js)');
    console.log('   Checking status every 2 seconds...\n');

    let completed = false;
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds max

    while (!completed && attempts < maxAttempts) {
      attempts++;

      // Get current application status
      const currentApp = await prisma.autoApplication.findUnique({
        where: { id: application.id }
      });

      const stats = await getQueueStats();

      console.log(`   [${attempts}] Status: ${currentApp.status} | Queue: ${stats.queue.active} active, ${stats.queue.waiting} waiting`);

      if (currentApp.status === 'SUBMITTED') {
        console.log('\n✅ Application SUBMITTED successfully!');
        console.log(`   Method: ${currentApp.method}`);
        console.log(`   Cost: $${currentApp.cost?.toFixed(4) || '0.0000'}`);
        console.log(`   Duration: ${currentApp.completedAt - currentApp.startedAt}ms`);

        if (currentApp.confirmationUrl) {
          console.log(`   Screenshot: ${currentApp.confirmationUrl.substring(0, 50)}...`);
        }

        if (currentApp.confirmationData) {
          console.log('\n   Details:');
          console.log(`     Fields extracted: ${currentApp.confirmationData.fieldsExtracted}`);
          console.log(`     Fields filled: ${currentApp.confirmationData.fieldsFilled}`);
          console.log(`     Complexity: ${currentApp.confirmationData.complexity}`);
          console.log(`     AI cost: $${currentApp.confirmationData.aiCost?.toFixed(4) || '0.0000'}`);
        }

        completed = true;
        break;
      }

      if (currentApp.status === 'FAILED') {
        console.log('\n❌ Application FAILED');
        console.log(`   Error: ${currentApp.error}`);
        console.log(`   Error Type: ${currentApp.errorType}`);
        console.log(`   Retry Count: ${currentApp.retryCount}`);
        completed = true;
        break;
      }

      if (currentApp.status === 'APPLYING') {
        console.log('   🤖 AI is filling the form...');
      }

      // Wait 2 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!completed) {
      console.log('\n⏱️  Timeout reached (60 seconds)');
      console.log('   Job might still be processing. Check worker logs:');
      console.log('   pm2 logs auto-apply-worker');
    }

    // Step 5: Show final stats
    console.log('\n📊 Final Queue Stats:');
    const finalStats = await getQueueStats();
    console.log(JSON.stringify(finalStats, null, 2));

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Instructions
console.log(`
📋 PRE-REQUISITES:

1. Make sure Redis is running:
   redis-cli ping
   (should return PONG)

2. Start the worker in another terminal:
   node server/auto-apply-worker.js

3. Have a test user with complete profile:
   - User ID: ${TEST_USER_ID}
   - Profile with applicationData (personalInfo, experience, education, skills)

4. Set environment variables:
   - DATABASE_URL
   - REDIS_URL (or default localhost:6379)
   - OPENAI_API_KEY

Press Ctrl+C to cancel, or wait 3 seconds to start...
`);

setTimeout(() => {
  runTest()
    .then(() => {
      console.log('\n✅ Test completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}, 3000);
