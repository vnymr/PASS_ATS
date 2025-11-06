/**
 * Browser Launcher Helper
 * Centralized Playwright browser launching with production support
 * MIGRATED FROM PUPPETEER TO PLAYWRIGHT
 */

import { chromium } from 'playwright';
import logger from './logger.js';
import { execSync } from 'child_process';

/**
 * Find Chromium executable path
 * Handles Railway/Nixpacks environment with dynamic path resolution
 */
function findChromiumPath() {
  // If PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is explicitly set, use it
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH &&
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH !== '*') {
    logger.info(`Using PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: ${process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}`);
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }

  // Fallback to PUPPETEER_EXECUTABLE_PATH for backwards compatibility
  if (process.env.PUPPETEER_EXECUTABLE_PATH &&
      process.env.PUPPETEER_EXECUTABLE_PATH !== '*') {
    logger.info(`Using PUPPETEER_EXECUTABLE_PATH (backwards compat): ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // Try to find Playwright's bundled Chromium (most reliable)
  try {
    // Look for Playwright's cache directory
    const homeDir = process.env.HOME || '/root';
    const playwrightCachePaths = [
      `${homeDir}/Library/Caches/ms-playwright`,
      `${homeDir}/.cache/ms-playwright`,
      '/root/.cache/ms-playwright'
    ];

    for (const cachePath of playwrightCachePaths) {
      try {
        const chromiumPath = execSync(`find ${cachePath} -name chrome -o -name chromium -type f 2>/dev/null | head -1`,
          { encoding: 'utf8' }
        ).trim();

        if (chromiumPath) {
          logger.info(`Found Playwright bundled Chromium: ${chromiumPath}`);
          return chromiumPath;
        }
      } catch (e) {
        // Continue to next path
      }
    }
  } catch (error) {
    logger.debug('Could not find Playwright bundled Chromium');
  }

  // Try to find system chromium using which command
  try {
    const path = execSync('which chromium || which chromium-browser || which google-chrome',
      { encoding: 'utf8' }
    ).trim();

    if (path) {
      logger.info(`Found system Chromium: ${path}`);
      return path;
    }
  } catch (error) {
    logger.debug('Could not find system Chromium');
  }

  // Try Nix store path (Railway with Nixpacks)
  try {
    const nixPath = execSync('find /nix/store -name chromium -type f 2>/dev/null | head -1',
      { encoding: 'utf8' }
    ).trim();

    if (nixPath) {
      logger.info(`Found Chromium in Nix store: ${nixPath}`);
      return nixPath;
    }
  } catch (error) {
    logger.debug('Could not find Chromium in Nix store');
  }

  logger.info('Using Playwright default bundled Chromium');
  return undefined;
}

/**
 * Get standard browser launch arguments
 * Optimized for production containerized environments
 */
function getStandardArgs(options = {}) {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu'
  ];

  if (options.stealth) {
    args.push(
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process'
    );
  }

  if (options.extraArgs) {
    args.push(...options.extraArgs);
  }

  return args;
}

/**
 * Launch browser with production support
 * @param {Object} options - Launch options
 * @param {boolean} options.headless - Run in headless mode (default: true in production)
 * @param {boolean} options.stealth - Use stealth mode to avoid detection (default: false)
 * @param {string} options.windowSize - Window size (default: 1920x1080)
 * @param {string[]} options.extraArgs - Additional Chrome arguments
 * @returns {Promise<Browser>} Playwright browser instance
 */
export async function launchBrowser(options = {}) {
  const executablePath = findChromiumPath();

  // Parse window size (default 1920x1080)
  const windowSize = options.windowSize || '1920,1080';
  const [width, height] = windowSize.split(',').map(Number);

  const launchOptions = {
    headless: options.headless !== false,
    args: getStandardArgs(options),
    viewport: { width, height }
  };

  // Add executable path if found
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  logger.debug({ launchOptions }, 'Launching Playwright browser');

  try {
    const browser = await chromium.launch(launchOptions);
    logger.info('✅ Playwright browser launched successfully');
    return browser;
  } catch (error) {
    logger.error({
      error: error.message,
      executablePath,
      args: launchOptions.args
    }, 'Failed to launch Playwright browser');
    throw new Error(`Browser launch failed: ${error.message}`);
  }
}

/**
 * Launch browser for stealth mode (auto-apply, form filling)
 */
export async function launchStealthBrowser(options = {}) {
  return launchBrowser({
    ...options,
    stealth: true,
    headless: process.env.PUPPETEER_HEADLESS !== 'false' && process.env.PLAYWRIGHT_HEADLESS !== 'false'
  });
}

/**
 * Launch browser for pooling (multiple instances)
 */
export async function launchPooledBrowser(options = {}) {
  return launchBrowser({
    ...options,
    headless: true,
    extraArgs: [
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-images',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-extensions-with-background-pages',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding',
      '--enable-features=NetworkService,NetworkServiceInProcess',
      '--force-color-profile=srgb',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio'
    ]
  });
}

export default {
  launchBrowser,
  launchStealthBrowser,
  launchPooledBrowser
};
