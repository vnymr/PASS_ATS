/**
 * Generate a test JWT token for testing
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Create a test user token
const testUser = {
  id: 3, // Using existing user ID from previous tests
  email: 'test-user@example.com'
};

const token = jwt.sign(testUser, JWT_SECRET, { expiresIn: '24h' });

console.log('🔑 Test Token Generated');
console.log('═══════════════════════════════════════════════════════════');
console.log(`\nToken: ${token}\n`);
console.log('Usage:');
console.log(`TEST_TOKEN="${token}" node scripts/test-performance.js`);
console.log('\nOr export it:');
console.log(`export TEST_TOKEN="${token}"`);
console.log('node scripts/test-performance.js');
console.log('\n═══════════════════════════════════════════════════════════');
