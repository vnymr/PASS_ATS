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

  // No longer supporting PUPPETEER_EXECUTABLE_PATH - fully migrated to Playwright

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
 * Apply comprehensive stealth techniques to a Playwright page
 * Removes automation indicators to avoid bot detection
 * Based on best practices from: https://zenrows.com/blog/puppeteer-stealth
 */
export async function applyStealthToPage(page) {
  logger.debug('Applying stealth techniques to page...');

  // 1. Remove navigator.webdriver property (most important)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  // 2. Add realistic Chrome runtime object
  await page.addInitScript(() => {
    window.chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {}
    };
  });

  // 3. Override permissions API
  await page.addInitScript(() => {
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });

  // 4. Add realistic plugins
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
  });

  // 5. Add realistic languages
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });

  // 6. Override webdriver property in window
  await page.addInitScript(() => {
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  });

  // 7. Add realistic connection properties
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        rtt: 50,
        downlink: 10,
        effectiveType: '4g',
        saveData: false,
      }),
    });
  });

  // 8. Override toString methods that might reveal automation
  await page.addInitScript(() => {
    const originalToString = Function.prototype.toString;
    Function.prototype.toString = function() {
      if (this === navigator.webdriver) {
        return 'function webdriver() { [native code] }';
      }
      return originalToString.call(this);
    };
  });

  // 9. Add realistic mouse movement tracking
  await page.addInitScript(() => {
    // Create mouse movement history to make it look human
    window.__mouseHistory = [];
    document.addEventListener('mousemove', (e) => {
      window.__mouseHistory.push({ x: e.clientX, y: e.clientY, time: Date.now() });
      // Keep only last 50 movements
      if (window.__mouseHistory.length > 50) {
        window.__mouseHistory.shift();
      }
    });
  });

  logger.debug('✅ Stealth techniques applied to page');
}

/**
 * Add human-like mouse movement before clicking
 */
export async function moveMouseHumanLike(page, x, y) {
  // Move mouse in curved path to target position
  const steps = 10 + Math.floor(Math.random() * 5);
  const currentPos = await page.evaluate(() => {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  });

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    // Use easing for more natural movement
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const currentX = currentPos.x + (x - currentPos.x) * eased;
    const currentY = currentPos.y + (y - currentPos.y) * eased;

    // Add slight randomness
    const jitterX = (Math.random() - 0.5) * 3;
    const jitterY = (Math.random() - 0.5) * 3;

    await page.mouse.move(currentX + jitterX, currentY + jitterY);
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
  }
}

/**
 * Create a stealth browser context with realistic settings
 * @param {Browser} browser - Playwright browser instance
 * @param {Object} options - Context options
 * @returns {Promise<BrowserContext>} Stealth browser context
 */
export async function createStealthContext(browser, options = {}) {
  // Realistic user agents (rotate between common ones)
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  ];

  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: options.userAgent || randomUserAgent,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: ['geolocation'],
    geolocation: { latitude: 40.7128, longitude: -74.0060 }, // NYC coordinates
    colorScheme: 'light',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    },
    ...options
  });

  logger.debug({ userAgent: randomUserAgent }, 'Created stealth browser context');
  return context;
}

/**
 * Launch browser for stealth mode (auto-apply, form filling)
 * Includes comprehensive bot detection evasion
 */
export async function launchStealthBrowser(options = {}) {
  const browser = await launchBrowser({
    ...options,
    stealth: true,
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false'
  });

  logger.info('✅ Stealth browser launched with bot detection evasion');
  return browser;
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
  launchPooledBrowser,
  applyStealthToPage,
  createStealthContext,
  moveMouseHumanLike
};
