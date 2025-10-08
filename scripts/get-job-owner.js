#!/usr/bin/env node

const path = require('path');
const jwt = require(path.join(__dirname, '../server/node_modules/jsonwebtoken'));
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function getJobOwner() {
  try {
    const jobId = process.argv[2] || 'cmghek1ny00071474tiv4nhiu';

    console.log(`🔍 Finding owner of job: ${jobId}\n`);

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        user: true,
        _count: {
          select: { artifacts: true }
        }
      }
    });

    if (!job) {
      console.log('❌ Job not found');
      process.exit(1);
    }

    console.log('Job Info:');
    console.log(`  ID: ${job.id}`);
    console.log(`  Status: ${job.status}`);
    console.log(`  User ID: ${job.userId}`);
    console.log(`  User Email: ${job.user.email}`);
    console.log(`  Created: ${job.createdAt}`);
    console.log(`  Artifacts: ${job._count.artifacts}`);
    console.log('');

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('❌ JWT_SECRET not found');
      process.exit(1);
    }

    const token = jwt.sign(
      { id: job.user.id, email: job.user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Test token generated for this job\'s owner:\n');
    console.log(token);
    console.log(`\n\nUsage:`);
    console.log(`export TEST_TOKEN="${token}"`);
    console.log(`export JOB_ID="${jobId}"`);
    console.log(`\nOr run directly:`);
    console.log(`TEST_TOKEN="${token}" JOB_ID="${jobId}" node scripts/test-pdf-download.js`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

getJobOwner();
