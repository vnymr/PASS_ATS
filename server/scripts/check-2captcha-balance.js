/**
 * Check 2Captcha Balance
 */

import 'dotenv/config';
import CaptchaSolver from '../lib/captcha-solver.js';

async function checkBalance() {
  console.log('🔍 Checking 2Captcha Balance\n');
  console.log('='.repeat(60));

  if (!process.env.TWOCAPTCHA_API_KEY) {
    console.error('❌ TWOCAPTCHA_API_KEY not configured in .env file');
    process.exit(1);
  }

  console.log('✅ 2Captcha API Key: ' + process.env.TWOCAPTCHA_API_KEY.substring(0, 10) + '...');

  try {
    const solver = new CaptchaSolver();
    const balance = await solver.getBalance();

    console.log('\n💰 Current Balance: $' + balance.toFixed(2));

    if (balance < 0.50) {
      console.warn('\n⚠️  WARNING: Low balance!');
      console.warn('   Add funds at: https://2captcha.com');
      console.warn('   Minimum recommended: $3.00');
    } else {
      console.log('\n✅ Balance is sufficient for testing');
      console.log(`   Estimated CAPTCHAs you can solve: ${Math.floor(balance / 0.03)}`);
    }

    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Failed to check balance:', error.message);
    console.error('\nPossible reasons:');
    console.error('  - Invalid API key');
    console.error('  - Network connectivity issues');
    console.error('  - 2Captcha service is down');
    process.exit(1);
  }
}

checkBalance();
