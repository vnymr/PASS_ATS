import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Create a test token for user ID 3 (or specify via command line)
const userId = process.argv[2] ? parseInt(process.argv[2]) : 3;
const email = process.argv[3] || `user_${userId}@test.com`;

const token = jwt.sign(
  { id: userId, email },
  JWT_SECRET,
  { expiresIn: '24h' }
);

console.log('Generated test token:');
console.log(token);
console.log('\nToken details:');
console.log(`  User ID: ${userId}`);
console.log(`  Email: ${email}`);
console.log(`  Expires: 24 hours`);
console.log('\nTo use with test script:');
console.log(`  export TEST_TOKEN="${token}"`);
console.log(`  node scripts/test-complete-flow.js`);
