/**
 * HTML to PDF Generator
 *
 * Uses Playwright to convert HTML resumes to PDF
 * No LaTeX dependencies - pure HTML/CSS rendering
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

/**
 * Get or create browser instance
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
      logger.info('Launching browser for PDF generation...');

      // Use system Chromium if available (for Docker/production)
      const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
      if (executablePath) {
        logger.info(`Using system Chromium at: ${executablePath}`);
      }

      browserInstance = await chromium.launch({
        headless: true,
        executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process'
        ]
      });

      // Handle browser disconnect
      browserInstance.on('disconnected', () => {
        logger.info('Browser disconnected');
        browserInstance = null;
        browserLaunchPromise = null;
      });

      logger.info('Browser launched successfully');
      return browserInstance;
    } catch (error) {
      logger.error('Failed to launch browser:', error.message);
      browserLaunchPromise = null;
      throw error;
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

  // Generate hash for caching
  const htmlHash = crypto.createHash('sha256').update(html).digest('hex');

  // Check cache
  if (useCache && pdfCache.has(htmlHash)) {
    logger.debug(`PDF cache hit for hash ${htmlHash.substring(0, 8)}...`);
    return pdfCache.get(htmlHash);
  }

  logger.debug('Generating PDF from HTML...');

  let browser = null;
  let page = null;

  try {
    browser = await getBrowser();
    page = await browser.newPage();

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

    logger.info('PDF generated successfully');
    return pdfBuffer;

  } catch (error) {
    logger.error('PDF generation failed:', error.message);
    throw new Error(`PDF generation failed: ${error.message}`);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

/**
 * Generate PDF with retries
 */
async function generatePDFWithRetry(html, options = {}, maxRetries = 2) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generatePDF(html, options);
    } catch (error) {
      lastError = error;
      logger.warn(`PDF generation attempt ${attempt} failed: ${error.message}`);

      // Reset browser on failure
      if (browserInstance) {
        await browserInstance.close().catch(() => {});
        browserInstance = null;
        browserLaunchPromise = null;
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500));
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
  let page = null;

  try {
    browser = await getBrowser();
    page = await browser.newPage();

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
  }
}

/**
 * Validate HTML structure
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
    maxSize: MAX_CACHE_SIZE
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
  closeBrowser,
  clearCache,
  getCacheStats
};

export default {
  generatePDF,
  generatePDFWithRetry,
  generatePreviewImage,
  validateHTML,
  closeBrowser,
  clearCache,
  getCacheStats
};
