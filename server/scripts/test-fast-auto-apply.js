/**
 * Test Fast AI Auto-Apply
 * Tests the full flow: AI fills form AND submits (no worker)
 */

import { PrismaClient } from '@prisma/client';
import { processAutoApplyDirect } from '../lib/direct-auto-apply.js';

const prisma = new PrismaClient();

async function testFastAutoApply() {
  console.log('🚀 Testing Fast AI Auto-Apply\n');
  console.log('Fast Mode Features:');
  console.log('  - No cursor movements');
  console.log('  - 50-150ms delays between fields');
  console.log('  - Direct page.fill() (no character-by-character typing)');
  console.log('  - Target: Form fill in 5-10 seconds\n');

  try {
    // Find a user with profile
    const user = await prisma.user.findFirst({
      where: { profile: { isNot: null } },
      include: { profile: true }
    });

    if (!user) {
      console.log('❌ No user with profile found');
      return;
    }

    console.log(`Using user: ${user.email}`);

    // Find a Greenhouse job (simple forms)
    const job = await prisma.aggregatedJob.findFirst({
      where: {
        atsType: 'GREENHOUSE',
        isActive: true
      }
    });

    if (!job) {
      console.log('❌ No active Greenhouse job found');
      return;
    }

    console.log(`\nJob: ${job.title} at ${job.company}`);
    console.log(`URL: ${job.applyUrl}`);
    console.log(`ATS: ${job.atsType}\n`);

    // Create or find AutoApplication
    let autoApp = await prisma.autoApplication.findUnique({
      where: {
        userId_jobId: { userId: user.id, jobId: job.id }
      }
    });

    if (!autoApp) {
      autoApp = await prisma.autoApplication.create({
        data: {
          userId: user.id,
          jobId: job.id,
          status: 'QUEUED',
          method: 'AI_AUTO'
        }
      });
      console.log('Created AutoApplication:', autoApp.id);
    } else {
      // Reset status if exists
      await prisma.autoApplication.update({
        where: { id: autoApp.id },
        data: { status: 'QUEUED', error: null }
      });
      console.log('Using existing AutoApplication:', autoApp.id);
    }

    // Run the auto-apply
    console.log('\n⏱️  Starting timer...');
    const startTime = Date.now();

    const result = await processAutoApplyDirect({
      applicationId: autoApp.id,
      jobUrl: job.applyUrl,
      atsType: job.atsType,
      userId: user.id,
      user: user
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️  Total time: ${elapsed} seconds`);

    if (result.success) {
      console.log('\n✅ Auto-apply completed successfully!');
      console.log(`   Fields filled: ${result.fieldsFilled || 'N/A'}`);
      console.log(`   Status: ${result.status}`);
    } else {
      console.log('\n❌ Auto-apply failed');
      console.log(`   Error: ${result.error}`);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testFastAutoApply();
