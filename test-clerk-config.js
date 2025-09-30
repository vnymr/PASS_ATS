#!/usr/bin/env node

// Test script to verify Clerk configuration
// Run this locally to check if your keys are correctly set

const testConfig = {
  frontend: {
    dev: process.env.VITE_CLERK_PUBLISHABLE_KEY || 'Not set',
    prod: 'pk_live_Y2xlcmsuZ2V0cmVzdW1lLnVzJA' // From .env.production
  },
  backend: {
    key: process.env.CLERK_SECRET_KEY || 'Not set'
  }
};

console.log('=== Clerk Configuration Test ===\n');

// Check frontend key
console.log('Frontend Publishable Key:');
if (testConfig.frontend.prod.startsWith('pk_live_')) {
  console.log('✅ Production key detected (pk_live_...)');
} else if (testConfig.frontend.prod.startsWith('pk_test_')) {
  console.log('⚠️  Development key detected (pk_test_...) - This will cause the warning!');
} else {
  console.log('❌ Invalid or missing key');
}

// Check backend key
console.log('\nBackend Secret Key:');
if (testConfig.backend.key.startsWith('sk_live_')) {
  console.log('✅ Production key detected (sk_live_...)');
} else if (testConfig.backend.key.startsWith('sk_test_')) {
  console.log('⚠️  Development key detected (sk_test_...)');
} else if (testConfig.backend.key === 'YOUR_PRODUCTION_CLERK_SECRET_KEY_FROM_RAILWAY_ENV') {
  console.log('❌ Placeholder detected - Set in Railway environment variables!');
} else {
  console.log('❌ Invalid or missing key');
}

console.log('\n=== Action Required ===');
console.log('1. Go to Railway dashboard');
console.log('2. For BACKEND service, set:');
console.log('   CLERK_SECRET_KEY = [your sk_live_ key from Clerk dashboard]');
console.log('3. For FRONTEND service, set:');
console.log('   VITE_CLERK_PUBLISHABLE_KEY = pk_live_Y2xlcmsuZ2V0cmVzdW1lLnVzJA');
console.log('4. Redeploy both services');
console.log('\n=== Important ===');
console.log('- Use Clerk PRODUCTION instance keys, not development');
console.log('- Keys starting with pk_test_ or sk_test_ are DEVELOPMENT keys');
console.log('- Keys starting with pk_live_ or sk_live_ are PRODUCTION keys');