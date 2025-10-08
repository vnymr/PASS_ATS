#!/usr/bin/env node

const path = require('path');
const jwt = require(path.join(__dirname, '../server/node_modules/jsonwebtoken'));
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function generateTestToken() {
  try {
    // Get the first user from the database
    const user = await prisma.user.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    if (!user) {
      console.error('❌ No users found in database');
      process.exit(1);
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('❌ JWT_SECRET not found in environment');
      process.exit(1);
    }

    // Generate a token that expires in 24 hours
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Test token generated successfully!\n');
    console.log('User Info:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`\nToken (valid for 24 hours):`);
    console.log(token);
    console.log(`\n\nUsage:`);
    console.log(`export TEST_TOKEN="${token}"`);
    console.log(`\nOr run directly:`);
    console.log(`TEST_TOKEN="${token}" node scripts/test-pdf-download.js`);

  } catch (error) {
    console.error('❌ Error generating token:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

generateTestToken();
