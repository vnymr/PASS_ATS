#!/usr/bin/env node
/**
 * Verify Chromium Installation
 * Runs during npm postinstall to verify browser is available
 * Note: Chromium is installed via Dockerfile (apk add chromium)
 */

import { execSync } from 'child_process';

function verifyChromium() {
  console.log('🔍 Verifying Chromium installation...');

  // Check if PUPPETEER_EXECUTABLE_PATH is set
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    console.log(`✅ Chromium path configured: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);

    // Verify the executable exists
    try {
      execSync(`test -f ${process.env.PUPPETEER_EXECUTABLE_PATH}`, { encoding: 'utf8' });
      console.log('✅ Chromium executable found');
    } catch (error) {
      console.log(`⚠️  Chromium not found at ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
      console.log('⚠️  Will fall back to system search');
    }
  } else {
    console.log('⚠️  PUPPETEER_EXECUTABLE_PATH not set');
    console.log('ℹ️  Browser launcher will search for Chromium automatically');
  }

  // Try to find chromium in common locations
  try {
    const chromiumPath = execSync('which chromium || which chromium-browser || which chrome || which google-chrome',
      { encoding: 'utf8' }
    ).trim();

    if (chromiumPath) {
      console.log(`✅ Found system Chromium: ${chromiumPath}`);
    }
  } catch (error) {
    console.log('⚠️  No system Chromium found in PATH');
  }

  console.log('✅ Chromium verification complete');
  process.exit(0); // Always succeed - don't fail build
}

verifyChromium();
