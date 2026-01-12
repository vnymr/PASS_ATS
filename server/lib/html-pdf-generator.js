/**
 * HTML to PDF Generator
 *
 * Uses Playwright Chromium to convert HTML resumes to PDF
 * Supports: Browserless Cloud (production) or local Chromium (fallback)
 *
 * NOTE: PDF generation requires Chromium - Firefox/Camoufox cannot be used
 * because Playwright's page.pdf() only works with Chromium-based browsers.
 */

import { chromium } from 'playwright';
import crypto from 'crypto';
import logger from './logger.js';

// PDF cache - stores compiled PDFs by HTML hash
const pdfCache = new Map();
const MAX_CACHE_SIZE = 100;

// Browser instance (reused for performance)
let browserInstance = null;
let browserLaunchPromise = null;
let browserType = null; // 'browserless' or 'local'

/**
 * Connect to Browserless Cloud (Chromium-based)
 * This is the preferred method for production
 */
async function connectToBrowserless() {
  const browserlessUrl = process.env.BROWSERLESS_URL || process.env.BROWSERLESS_ENDPOINT;
  const browserlessToken = process.env.BROWSERLESS_TOKEN;

  if (!browserlessUrl) {
    return null;
  }

  logger.info('Attempting to connect to Browserless Cloud for PDF generation...');

  try {
    // Construct WebSocket URL
    let wsUrl = browserlessUrl;

    // Convert HTTP to WebSocket if needed
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

    const browser = await chromium.connectOverCDP(wsUrl, {
      timeout: 30000
    });

    logger.info('Connected to Browserless Cloud for PDF generation');
    browserType = 'browserless';
    return browser;
  } catch (error) {
    logger.warn({
      error: error.message,
      browserlessUrl: browserlessUrl?.replace(/token=.*/, 'token=***')
    }, 'Browserless connection failed, will try local Chromium');
    return null;
  }
}

/**
 * Launch local Chromium browser
 */
async function launchLocalChromium() {
  logger.info('Launching local Chromium for PDF generation...');

  // Playwright will find its bundled Chromium automatically
  // Only use explicit path if PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is set
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;

  if (executablePath) {
    logger.info(`Using system Chromium at: ${executablePath}`);
  } else {
    logger.info('Using Playwright bundled Chromium (auto-detected)');
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--safebrowsing-disable-auto-update'
    ]
  });

  logger.info('Local Chromium browser launched successfully');
  browserType = 'local';
  return browser;
}

/**
 * Get or create browser instance
 * Priority: Browserless Cloud -> Local Chromium
 */
async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  // Prevent multiple simultaneous browser launches
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  browserLaunchPromise = (async () => {
    try {
      // Priority 1: Try Browserless Cloud (production)
      browserInstance = await connectToBrowserless();

      // Priority 2: Fall back to local Chromium
      if (!browserInstance) {
        browserInstance = await launchLocalChromium();
      }

      // Handle browser disconnect
      browserInstance.on('disconnected', () => {
        logger.info(`Browser disconnected (was: ${browserType})`);
        browserInstance = null;
        browserLaunchPromise = null;
        browserType = null;
      });

      return browserInstance;
    } catch (error) {
      logger.error({
        error: error.message,
        stack: error.stack,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        browserlessUrl: process.env.BROWSERLESS_URL ? 'configured' : 'not configured'
      }, 'Failed to launch browser for PDF generation');
      browserLaunchPromise = null;
      throw new Error(`Browser launch failed: ${error.message}. Ensure Chromium is installed or BROWSERLESS_URL is configured.`);
    }
  })();

  return browserLaunchPromise;
}

/**
 * Convert HTML to PDF
 *
 * @param {string} html - Complete HTML document
 * @param {Object} options - PDF options
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generatePDF(html, options = {}) {
  const {
    format = 'Letter',
    margin = { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    printBackground = true,
    useCache = true
  } = options;

  // Validate HTML before processing
  validateHTML(html);

  // Generate hash for caching
  const htmlHash = crypto.createHash('sha256').update(html).digest('hex');

  // Check cache
  if (useCache && pdfCache.has(htmlHash)) {
    logger.debug(`PDF cache hit for hash ${htmlHash.substring(0, 8)}...`);
    return pdfCache.get(htmlHash);
  }

  logger.debug('Generating PDF from HTML...');

  let browser = null;
  let context = null;
  let page = null;

  try {
    browser = await getBrowser();

    // Create a new context for isolation
    context = await browser.newContext();
    page = await context.newPage();

    // Set content
    await page.setContent(html, {
      waitUntil: 'networkidle'
    });

    // Wait for fonts to load
    await page.waitForTimeout(100);

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format,
      margin,
      printBackground,
      preferCSSPageSize: false
    });

    // Validate PDF is not blank
    validatePDF(pdfBuffer);

    // Cache the PDF
    if (useCache) {
      pdfCache.set(htmlHash, pdfBuffer);

      // Limit cache size
      if (pdfCache.size > MAX_CACHE_SIZE) {
        const firstKey = pdfCache.keys().next().value;
        pdfCache.delete(firstKey);
        logger.debug('PDF cache size limit reached, removed oldest entry');
      }

      logger.debug(`PDF cached with hash ${htmlHash.substring(0, 8)}...`);
    }

    logger.info({ browserType }, 'PDF generated successfully');
    return pdfBuffer;

  } catch (error) {
    logger.error({
      error: error.message,
      browserType
    }, 'PDF generation failed');
    throw new Error(`PDF generation failed: ${error.message}`);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

/**
 * Generate PDF with retries
 */
async function generatePDFWithRetry(html, options = {}, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generatePDF(html, options);
    } catch (error) {
      lastError = error;
      logger.warn({
        attempt,
        maxRetries,
        error: error.message
      }, `PDF generation attempt ${attempt} failed`);

      // Reset browser on failure
      if (browserInstance) {
        await browserInstance.close().catch(() => {});
        browserInstance = null;
        browserLaunchPromise = null;
        browserType = null;
      }

      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.min(500 * Math.pow(2, attempt - 1), 3000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Generate preview image (PNG) of the first page
 */
async function generatePreviewImage(html, options = {}) {
  const {
    width = 800,
    height = 1035, // Letter aspect ratio
    scale = 1
  } = options;

  let browser = null;
  let context = null;
  let page = null;

  try {
    browser = await getBrowser();
    context = await browser.newContext();
    page = await context.newPage();

    await page.setViewportSize({ width, height });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(100);

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
      scale
    });

    logger.debug('Preview image generated');
    return screenshot;

  } catch (error) {
    logger.error('Preview generation failed:', error.message);
    throw error;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

/**
 * Validate HTML structure and content
 * Ensures HTML has enough content to generate a meaningful resume
 */
function validateHTML(html) {
  if (!html || typeof html !== 'string') {
    throw new Error('HTML content is required');
  }

  if (!html.includes('<!DOCTYPE html>') && !html.includes('<html')) {
    throw new Error('Invalid HTML: missing document structure');
  }

  if (!html.includes('<body')) {
    throw new Error('Invalid HTML: missing body tag');
  }

  // Check for minimum content length (a blank template would still have ~500 chars of CSS/structure)
  // A real resume should have at least 1000 chars including the content
  if (html.length < 1000) {
    logger.warn({ htmlLength: html.length }, 'HTML content appears too short for a resume');
  }

  // Check for resume content markers (at least header should exist)
  if (!html.includes('class="resume"') && !html.includes('class="header"')) {
    logger.warn('HTML missing expected resume structure classes');
  }

  return true;
}

/**
 * Validate PDF output
 * Ensures the generated PDF is valid and has content
 */
function validatePDF(pdfBuffer) {
  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
    throw new Error('Invalid PDF: buffer is empty or not a Buffer');
  }

  // Check minimum size (a blank PDF is typically ~500-1000 bytes, real resume should be 10KB+)
  const MIN_PDF_SIZE = 5000; // 5KB minimum
  if (pdfBuffer.length < MIN_PDF_SIZE) {
    logger.error({ pdfSize: pdfBuffer.length, minExpected: MIN_PDF_SIZE },
      'Generated PDF is too small - likely blank or corrupt');
    throw new Error(`Generated PDF is too small (${pdfBuffer.length} bytes) - resume may be blank`);
  }

  // Check PDF header
  const header = pdfBuffer.slice(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    throw new Error('Invalid PDF: missing PDF header');
  }

  logger.debug({ pdfSize: pdfBuffer.length }, 'PDF validation passed');
  return true;
}

/**
 * Close browser (for cleanup)
 */
async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
    browserLaunchPromise = null;
    browserType = null;
    logger.info('Browser closed');
  }
}

/**
 * Clear PDF cache
 */
function clearCache() {
  pdfCache.clear();
  logger.info('PDF cache cleared');
}

/**
 * Get cache stats
 */
function getCacheStats() {
  return {
    size: pdfCache.size,
    maxSize: MAX_CACHE_SIZE,
    browserType: browserType || 'none',
    browserConnected: browserInstance?.isConnected() || false
  };
}

// Cleanup on process exit
process.on('exit', () => {
  if (browserInstance) {
    browserInstance.close().catch(() => {});
  }
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});

export {
  generatePDF,
  generatePDFWithRetry,
  generatePreviewImage,
  validateHTML,
  validatePDF,
  closeBrowser,
  clearCache,
  getCacheStats
};

export default {
  generatePDF,
  generatePDFWithRetry,
  generatePreviewImage,
  validateHTML,
  validatePDF,
  closeBrowser,
  clearCache,
  getCacheStats
};
