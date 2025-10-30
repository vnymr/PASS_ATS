#!/usr/bin/env node
/**
 * Ensure Puppeteer Chromium is installed
 * Runs during npm postinstall to guarantee browser availability
 */

import puppeteer from 'puppeteer';
import { execSync } from 'child_process';

async function ensureChromium() {
  console.log('🔍 Checking for Chromium installation...');

  try {
    // Try to get the executable path
    const browser = await puppeteer.launch({ headless: true });
    await browser.close();
    console.log('✅ Chromium is already installed and working');
    process.exit(0);
  } catch (error) {
    console.log('📥 Chromium not found, installing...');

    try {
      // Force Puppeteer to download Chromium
      execSync('npx puppeteer browsers install chrome', {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ Chromium installed successfully');
      process.exit(0);
    } catch (installError) {
      console.error('❌ Failed to install Chromium:', installError.message);
      console.log('⚠️  Continuing anyway - will try to use system browser');
      process.exit(0); // Don't fail the build
    }
  }
}

ensureChromium();
