#!/usr/bin/env node
/**
 * Create a new worker account
 * Usage: node scripts/create-worker.js --email worker@example.com --password secret123 --name "John Doe" [--admin]
 */

import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma-client.js';

async function createWorker() {
  const args = process.argv.slice(2);

  // Parse arguments
  const getArg = (name) => {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 ? args[idx + 1] : null;
  };

  const email = getArg('email');
  const password = getArg('password');
  const name = getArg('name');
  const isAdmin = args.includes('--admin');

  if (!email || !password || !name) {
    console.log('Usage: node scripts/create-worker.js --email <email> --password <password> --name "<name>" [--admin]');
    console.log('');
    console.log('Options:');
    console.log('  --email     Worker email address');
    console.log('  --password  Worker password');
    console.log('  --name      Worker display name');
    console.log('  --admin     Give admin privileges (optional)');
    process.exit(1);
  }

  try {
    // Check if worker already exists
    const existing = await prisma.worker.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existing) {
      console.error(`Error: Worker with email ${email} already exists`);
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create worker
    const worker = await prisma.worker.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        role: isAdmin ? 'ADMIN' : 'OPERATOR',
        isActive: true
      }
    });

    console.log('✅ Worker created successfully!');
    console.log('');
    console.log('Worker Details:');
    console.log(`  ID:    ${worker.id}`);
    console.log(`  Email: ${worker.email}`);
    console.log(`  Name:  ${worker.name}`);
    console.log(`  Role:  ${worker.role}`);
    console.log('');
    console.log('The worker can now log in at /worker/login');

  } catch (error) {
    console.error('Error creating worker:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createWorker();
