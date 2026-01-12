/**
 * Production Start Script
 * Runs both the API server and the resume generation worker
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('🚀 Starting production services...');

// Run database migrations first
console.log('📦 Running database migrations...');
const migrate = spawn('npx', ['prisma', 'migrate', 'deploy'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

migrate.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Migration failed with code:', code);
    process.exit(1);
  }

  console.log('✅ Migrations complete');
  console.log('');

  // Start the API server
  console.log('🌐 Starting API server...');
  const server = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env }
  });

  server.on('error', (err) => {
    console.error('❌ Server error:', err);
  });

  // Start the worker after a short delay to let server initialize
  setTimeout(() => {
    console.log('⚙️  Starting resume generation worker...');
    const worker = spawn('node', ['worker.js'], {
      cwd: __dirname,
      stdio: 'inherit',
      env: { ...process.env }
    });

    worker.on('error', (err) => {
      console.error('❌ Worker error:', err);
    });

    worker.on('close', (code) => {
      console.error('⚠️  Worker exited with code:', code);
      // Restart worker if it crashes
      if (code !== 0) {
        console.log('🔄 Restarting worker in 5 seconds...');
        setTimeout(() => {
          spawn('node', ['worker.js'], {
            cwd: __dirname,
            stdio: 'inherit',
            env: { ...process.env }
          });
        }, 5000);
      }
    });
  }, 2000);

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down...');
    server.kill('SIGTERM');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down...');
    server.kill('SIGINT');
    process.exit(0);
  });
});
