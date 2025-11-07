/**
 * Browser Launcher Helper
 * Centralized Playwright browser launching with production support
 * MIGRATED FROM PUPPETEER TO PLAYWRIGHT
 * ENHANCED WITH PLAYWRIGHT-EXTRA STEALTH MODE
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import logger from './logger.js';
import { execSync } from 'child_process';

// Add stealth plugin to playwright-extra
chromium.use(StealthPlugin());

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
 * Launch browser via Browserless Cloud (if configured)
 * Provides advanced stealth features and managed infrastructure
 * @param {Object} options - Launch options
 * @returns {Promise<Browser>} Playwright browser instance
 */
export async function launchBrowserlessBrowser(options = {}) {
  const browserlessUrl = process.env.BROWSERLESS_URL || process.env.BROWSERLESS_ENDPOINT;
  const browserlessToken = process.env.BROWSERLESS_TOKEN;
  
  if (!browserlessUrl) {
    throw new Error('BROWSERLESS_URL or BROWSERLESS_ENDPOINT environment variable not set');
  }

  logger.info({ browserlessUrl: browserlessUrl.replace(/\/\/.*@/, '//***@') }, 'Connecting to Browserless Cloud...');

  try {
    // Construct WebSocket URL for Browserless
    // Format: wss://chrome.browserless.io?token=YOUR_TOKEN
    // Or: ws://localhost:3000 (for self-hosted)
    let wsUrl = browserlessUrl;
    
    // If it's an HTTP URL, convert to WebSocket
    if (wsUrl.startsWith('http://')) {
      wsUrl = wsUrl.replace('http://', 'ws://');
    } else if (wsUrl.startsWith('https://')) {
      wsUrl = wsUrl.replace('https://', 'wss://');
    }
    
    // Add token if provided
    if (browserlessToken && !wsUrl.includes('token=')) {
      const separator = wsUrl.includes('?') ? '&' : '?';
      wsUrl = `${wsUrl}${separator}token=${browserlessToken}`;
    }

    // Connect to Browserless Cloud via CDP (Chrome DevTools Protocol)
    const browser = await chromium.connectOverCDP(wsUrl, {
      timeout: 30000
    });

    logger.info('✅ Connected to Browserless Cloud');
    return browser;
  } catch (error) {
    logger.error({ error: error.message, browserlessUrl: browserlessUrl.replace(/\/\/.*@/, '//***@') }, 'Failed to connect to Browserless Cloud');
    throw new Error(`Browserless connection failed: ${error.message}`);
  }
}

/**
 * Launch browser for stealth mode (auto-apply, form filling)
 * Includes comprehensive bot detection evasion
 * Optionally uses Browserless Cloud if configured
 */
export async function launchStealthBrowser(options = {}) {
  // Check if Browserless Cloud is configured
  const useBrowserless = process.env.USE_BROWSERLESS === 'true' || 
                         process.env.BROWSERLESS_URL || 
                         process.env.BROWSERLESS_ENDPOINT;

  if (useBrowserless) {
    logger.info('Using Browserless Cloud for enhanced stealth');
    try {
      const browser = await launchBrowserlessBrowser(options);
      logger.info('✅ Browserless Cloud browser launched');
      return browser;
    } catch (error) {
      logger.warn({ error: error.message }, 'Browserless Cloud failed, falling back to local browser');
      // Fall through to local browser
    }
  }

  // Use local browser with stealth techniques
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

/**
 * Human Behavior Simulation
 * Adds realistic human-like interactions to avoid bot detection
 */

/**
 * Random delay with human-like timing variance
 * @param {number} min - Minimum delay in ms (default: 1000)
 * @param {number} max - Maximum delay in ms (default: 3000)
 */
export async function humanDelay(min = 1000, max = 3000) {
  const delay = min + Math.random() * (max - min);
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Simulate random scrolling like a human reading a page
 * @param {Page} page - Playwright page
 * @param {Object} options - Scroll options
 */
export async function humanScroll(page, options = {}) {
  const scrolls = options.scrolls || (2 + Math.floor(Math.random() * 3)); // 2-4 scrolls

  logger.debug(`Simulating ${scrolls} human-like scrolls`);

  for (let i = 0; i < scrolls; i++) {
    // Scroll down a random amount (200-800px)
    const scrollAmount = 200 + Math.random() * 600;

    await page.evaluate((amount) => {
      window.scrollBy({
        top: amount,
        left: 0,
        behavior: 'smooth'
      });
    }, scrollAmount);

    // Wait a bit (simulating reading)
    await humanDelay(500, 1500);

    // Occasionally scroll up a bit (like re-reading)
    if (Math.random() > 0.7) {
      const scrollBack = 50 + Math.random() * 150;
      await page.evaluate((amount) => {
        window.scrollBy({
          top: -amount,
          left: 0,
          behavior: 'smooth'
        });
      }, scrollBack);
      await humanDelay(300, 800);
    }
  }

  logger.debug('✅ Human-like scrolling complete');
}

/**
 * Random mouse movements to simulate human presence
 * @param {Page} page - Playwright page
 * @param {number} movements - Number of random movements (default: 3-5)
 */
export async function randomMouseJiggles(page, movements = null) {
  const numMovements = movements || (3 + Math.floor(Math.random() * 3));

  logger.debug(`Performing ${numMovements} random mouse movements`);

  for (let i = 0; i < numMovements; i++) {
    const x = 100 + Math.random() * 1720; // Random X within 1920px width
    const y = 100 + Math.random() * 880;  // Random Y within 1080px height

    await moveMouseHumanLike(page, x, y);
    await humanDelay(300, 1000);
  }

  logger.debug('✅ Random mouse movements complete');
}

/**
 * Type text like a human (with realistic delays and occasional typos)
 * @param {Page} page - Playwright page
 * @param {string} selector - Input field selector
 * @param {string} text - Text to type
 * @param {Object} options - Typing options
 */
export async function humanType(page, selector, text, options = {}) {
  const element = await page.$(selector);
  if (!element) {
    logger.warn(`Element not found: ${selector}`);
    return false;
  }

  // Clear existing content first
  await element.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');

  // Type with human-like delays
  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Occasional typo (5% chance) - type wrong char then backspace
    if (Math.random() < 0.05 && i < text.length - 1) {
      const wrongChar = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      await page.keyboard.type(wrongChar);
      await humanDelay(100, 300);
      await page.keyboard.press('Backspace');
      await humanDelay(50, 150);
    }

    // Type the correct character
    await page.keyboard.type(char);

    // Variable typing speed (30-150ms between keys)
    // Faster for common keys, slower for special chars
    const isSpace = char === ' ';
    const isPunctuation = /[.,!?;:]/.test(char);

    let delay = 30 + Math.random() * 50; // Base delay: 30-80ms
    if (isSpace) delay += 50; // Longer pause after space
    if (isPunctuation) delay += 30; // Slightly longer for punctuation

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  logger.debug(`✅ Typed text into ${selector} with human-like behavior`);
  return true;
}

/**
 * Simulate complete human page visit behavior
 * Includes: scrolling, mouse movements, random pauses
 * @param {Page} page - Playwright page
 * @param {Object} options - Behavior options
 */
export async function simulateHumanPageVisit(page, options = {}) {
  logger.info('🤖 Simulating human page visit behavior...');

  // Initial pause (like reading the page title/header)
  await humanDelay(800, 1500);

  // Random mouse movements (like moving cursor while reading)
  await randomMouseJiggles(page, 2);

  // Scroll down to explore the page
  await humanScroll(page, { scrolls: options.scrolls || 2 });

  // More mouse movements
  await randomMouseJiggles(page, 1);

  // Final pause before interaction
  await humanDelay(500, 1200);

  logger.info('✅ Human behavior simulation complete');
}

export default {
  launchBrowser,
  launchStealthBrowser,
  launchPooledBrowser,
  launchBrowserlessBrowser,
  applyStealthToPage,
  createStealthContext,
  moveMouseHumanLike,
  humanDelay,
  humanScroll,
  randomMouseJiggles,
  humanType,
  simulateHumanPageVisit
};
