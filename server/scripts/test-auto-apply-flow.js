/**
 * Test Auto-Apply Flow
 * Tests the complete auto-apply flow including python-browser connection
 */

import 'dotenv/config';
import { firefox, chromium } from 'playwright-core';

const CAMOUFOX_WS_ENDPOINT = process.env.CAMOUFOX_WS_ENDPOINT || 'ws://localhost:3001/browser';
const USE_CAMOUFOX = process.env.USE_CAMOUFOX === 'true';

async function testCamoufoxConnection() {
  console.log('\n========================================');
  console.log('TEST 1: Python-Browser (Camoufox) Connection');
  console.log('========================================\n');

  console.log(`USE_CAMOUFOX: ${USE_CAMOUFOX}`);
  console.log(`CAMOUFOX_WS_ENDPOINT: ${CAMOUFOX_WS_ENDPOINT}`);
  console.log('');

  if (!USE_CAMOUFOX) {
    console.log('Camoufox is disabled (USE_CAMOUFOX != true)');
    console.log('To enable, set USE_CAMOUFOX=true in your .env file');
    return { success: false, reason: 'disabled' };
  }

  try {
    console.log('Attempting to connect to Camoufox...');
    const browser = await firefox.connect(CAMOUFOX_WS_ENDPOINT, {
      timeout: 15000
    });

    console.log('Connected to Camoufox successfully!');

    // Create a page and test basic functionality
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      locale: 'en-US'
    });

    const page = await context.newPage();
    console.log('Created new page');

    // Navigate to a test page
    console.log('Navigating to httpbin.org to test browser...');
    await page.goto('https://httpbin.org/headers', { timeout: 30000 });

    // Get page content
    const content = await page.textContent('body');
    console.log('Page loaded successfully');
    console.log('Headers received by server:', content.slice(0, 500));

    await browser.close();
    console.log('\nCamoufox connection test PASSED');
    return { success: true };

  } catch (error) {
    console.error('\nCamoufox connection test FAILED');
    console.error(`Error: ${error.message}`);

    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n--- Troubleshooting ---');
      console.log('1. Is the python-browser service running?');
      console.log('   - Local: docker-compose up python-browser');
      console.log('   - Or: cd python-service && python server.py');
      console.log('2. Check if port 3001 (local) or internal Railway URL is accessible');
      console.log('3. For local dev, set: CAMOUFOX_WS_ENDPOINT=ws://localhost:3001/browser');
    }

    return { success: false, error: error.message };
  }
}

async function testLocalBrowserFallback() {
  console.log('\n========================================');
  console.log('TEST 2: Local Browser Fallback');
  console.log('========================================\n');

  try {
    console.log('Launching local Chromium with stealth settings...');

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    console.log('Local browser launched successfully');

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      locale: 'en-US'
    });

    const page = await context.newPage();

    // Apply basic stealth
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    console.log('Navigating to test page...');
    await page.goto('https://httpbin.org/headers', { timeout: 30000 });

    const content = await page.textContent('body');
    console.log('Page loaded successfully');
    console.log('Headers:', content.slice(0, 300));

    await browser.close();
    console.log('\nLocal browser fallback test PASSED');
    return { success: true };

  } catch (error) {
    console.error('\nLocal browser fallback test FAILED');
    console.error(`Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testBrowserLauncher() {
  console.log('\n========================================');
  console.log('TEST 3: Centralized Browser Launcher');
  console.log('========================================\n');

  try {
    const { launchStealthBrowser, createStealthContext, applyStealthToPage } = await import('../lib/browser-launcher.js');

    console.log('Testing launchStealthBrowser()...');
    console.log('This will try: Camoufox -> Browserless -> Local (in order)');
    console.log('');

    const browser = await launchStealthBrowser({ headless: true });
    console.log('Browser launched successfully');

    const context = await createStealthContext(browser);
    const page = await context.newPage();
    await applyStealthToPage(page);

    console.log('Stealth context and page created');

    // Test navigation
    console.log('Navigating to bot detection test...');
    await page.goto('https://bot.sannysoft.com/', { timeout: 30000 });

    // Wait for page to load
    await new Promise(r => setTimeout(r, 3000));

    // Take screenshot for verification
    const fs = await import('fs');
    const outputDir = './test-output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const screenshotPath = `${outputDir}/stealth-test-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);

    await browser.close();
    console.log('\nCentralized browser launcher test PASSED');
    return { success: true, screenshot: screenshotPath };

  } catch (error) {
    console.error('\nCentralized browser launcher test FAILED');
    console.error(`Error: ${error.message}`);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('='.repeat(50));
  console.log('AUTO-APPLY FLOW TESTS');
  console.log('='.repeat(50));
  console.log('');
  console.log('Environment:');
  console.log(`  USE_CAMOUFOX: ${process.env.USE_CAMOUFOX}`);
  console.log(`  CAMOUFOX_WS_ENDPOINT: ${process.env.CAMOUFOX_WS_ENDPOINT}`);
  console.log(`  USE_BROWSERLESS: ${process.env.USE_BROWSERLESS}`);
  console.log('');

  const results = {
    camoufox: null,
    localFallback: null,
    browserLauncher: null
  };

  // Test 1: Camoufox connection
  results.camoufox = await testCamoufoxConnection();

  // Test 2: Local browser fallback
  results.localFallback = await testLocalBrowserFallback();

  // Test 3: Centralized browser launcher
  results.browserLauncher = await testBrowserLauncher();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('TEST SUMMARY');
  console.log('='.repeat(50));
  console.log('');
  console.log(`1. Camoufox Connection: ${results.camoufox.success ? 'PASSED' : 'FAILED'}`);
  console.log(`2. Local Browser Fallback: ${results.localFallback.success ? 'PASSED' : 'FAILED'}`);
  console.log(`3. Browser Launcher: ${results.browserLauncher.success ? 'PASSED' : 'FAILED'}`);
  console.log('');

  // Recommendations
  if (!results.camoufox.success && results.camoufox.reason !== 'disabled') {
    console.log('RECOMMENDATION: Start the python-browser service:');
    console.log('  docker-compose up python-browser');
    console.log('  OR set CAMOUFOX_WS_ENDPOINT=ws://localhost:3001/browser for local dev');
    console.log('');
  }

  if (results.browserLauncher.success) {
    console.log('The auto-apply system is ready to use!');
    console.log('It will use the best available browser (Camoufox > Browserless > Local)');
  }

  process.exit(results.browserLauncher.success ? 0 : 1);
}

runAllTests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
