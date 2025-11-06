/**
 * Playwright Migration Validation Test
 * Verifies that the Playwright migration is working correctly
 */

import { launchBrowser, launchStealthBrowser, launchPooledBrowser } from './lib/browser-launcher.js';
import BrowserPool from './lib/browser-pool.js';
import logger from './lib/logger.js';

console.log('🧪 Playwright Migration Validation Test\n');

async function testBrowserLauncher() {
  console.log('1️⃣ Testing browser-launcher.js...');

  try {
    // Test basic browser launch
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://example.com', { waitUntil: 'networkidle' });
    const title = await page.title();

    console.log(`   ✅ Basic browser launch: ${title}`);

    await browser.close();

    // Test stealth browser
    const stealthBrowser = await launchStealthBrowser({ headless: true });
    const stealthContext = await stealthBrowser.newContext();
    const stealthPage = await stealthContext.newPage();

    await stealthPage.goto('https://example.com', { waitUntil: 'networkidle' });
    await stealthBrowser.close();

    console.log('   ✅ Stealth browser launch');

    // Test pooled browser
    const pooledBrowser = await launchPooledBrowser();
    const pooledContext = await pooledBrowser.newContext();
    const pooledPage = await pooledContext.newPage();

    await pooledPage.goto('https://example.com', { waitUntil: 'networkidle' });
    await pooledBrowser.close();

    console.log('   ✅ Pooled browser launch');

    return true;
  } catch (error) {
    console.error(`   ❌ Browser launcher test failed: ${error.message}`);
    return false;
  }
}

async function testBrowserPool() {
  console.log('\n2️⃣ Testing browser-pool.js...');

  try {
    const pool = new BrowserPool({ maxBrowsers: 2, maxPagesPerBrowser: 2 });

    // Get a page from the pool
    const { browser: browser1, page: page1 } = await pool.getPage();
    console.log('   ✅ Got page from pool');

    // Navigate to a test page
    await page1.goto('https://example.com', { waitUntil: 'networkidle' });
    console.log('   ✅ Navigated with pooled page');

    // Release the page
    await pool.releasePage(browser1, page1);
    console.log('   ✅ Released page back to pool');

    // Get pool stats
    const stats = pool.getStats();
    console.log(`   ✅ Pool stats: ${stats.activeBrowsers} browsers, ${stats.activePages} pages`);

    // Close all browsers
    await pool.closeAll();
    console.log('   ✅ Closed all pool browsers');

    return true;
  } catch (error) {
    console.error(`   ❌ Browser pool test failed: ${error.message}`);
    return false;
  }
}

async function testFormInteraction() {
  console.log('\n3️⃣ Testing form interaction APIs...');

  try {
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Test basic page navigation
    await page.goto('https://httpbin.org/forms/post', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('   ✅ Navigated to test form');

    // Test fill (Playwright-specific)
    await page.fill('input[name="custname"]', 'Test User');
    console.log('   ✅ Filled text input');

    // Test selectOption (Playwright-specific)
    await page.selectOption('select[name="size"]', 'Large');
    console.log('   ✅ Selected dropdown option');

    // Test check (Playwright-specific)
    await page.check('input[name="topping"][value="bacon"]');
    console.log('   ✅ Checked checkbox');

    // Test click
    await page.click('input[name="topping"][value="cheese"]');
    console.log('   ✅ Clicked radio button');

    await browser.close();

    return true;
  } catch (error) {
    console.error(`   ❌ Form interaction test failed: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

async function testAutoWaiting() {
  console.log('\n4️⃣ Testing Playwright auto-waiting...');

  try {
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://example.com', { waitUntil: 'networkidle' });

    // Test auto-waiting with click (Playwright waits automatically)
    const startTime = Date.now();
    await page.click('a');
    const duration = Date.now() - startTime;

    console.log(`   ✅ Auto-waiting works (took ${duration}ms)`);

    await browser.close();

    return true;
  } catch (error) {
    console.error(`   ❌ Auto-waiting test failed: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('Starting Playwright migration validation tests...\n');

  const results = {
    browserLauncher: await testBrowserLauncher(),
    browserPool: await testBrowserPool(),
    formInteraction: await testFormInteraction(),
    autoWaiting: await testAutoWaiting()
  };

  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results:');
  console.log('='.repeat(50));

  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(r => r === true).length;
  const failed = total - passed;

  Object.entries(results).forEach(([name, result]) => {
    console.log(`${result ? '✅' : '❌'} ${name}: ${result ? 'PASSED' : 'FAILED'}`);
  });

  console.log('='.repeat(50));
  console.log(`Total: ${passed}/${total} passed, ${failed}/${total} failed`);
  console.log('='.repeat(50));

  if (passed === total) {
    console.log('\n🎉 All tests passed! Playwright migration is successful!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
