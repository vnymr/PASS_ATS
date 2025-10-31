/**
 * CAPTCHA Solver - Production Ready (Simplified)
 * Integrates with 2Captcha API to solve CAPTCHAs automatically
 * Strategy: Try reCAPTCHA v2 first (95% of job sites), fallback to v3 if needed
 */

import logger from './logger.js';
import axios from 'axios';

// Configure axios with timeout to prevent hanging requests
const http = axios.create({
  timeout: 30000, // 30 seconds
});

class CaptchaSolver {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.TWOCAPTCHA_API_KEY;
    this.baseUrl = 'https://2captcha.com';
    this.pollingInterval = 5000; // 5 seconds (2captcha recommendation)
    this.timeout = 120000; // 2 minutes total timeout

    if (!this.apiKey) {
      logger.warn('2Captcha API key not configured. CAPTCHA solving will be disabled.');
    }
  }

  /**
   * Solve reCAPTCHA v2
   * @param {string} siteKey - The site key from the CAPTCHA
   * @param {string} pageUrl - The URL where the CAPTCHA is located
   * @returns {Promise<string>} The solved CAPTCHA token
   */
  async solveRecaptchaV2(siteKey, pageUrl) {
    if (!this.apiKey) {
      throw new Error('2Captcha API key not configured');
    }

    logger.info({ siteKey: siteKey.substring(0, 15) + '...' }, 'Solving reCAPTCHA v2');

    try {
      const response = await http.get(`${this.baseUrl}/in.php`, {
        params: {
          key: this.apiKey,
          method: 'userrecaptcha',
          googlekey: siteKey,
          pageurl: pageUrl,
          json: 1,
        }
      });

      if (response.data.status !== 1) {
        throw new Error(`2Captcha error: ${response.data.request}`);
      }

      const taskId = response.data.request;
      logger.info({ taskId }, 'CAPTCHA submitted, waiting for solution...');

      const solution = await this.pollForSolution(taskId);
      logger.info('reCAPTCHA v2 solved successfully');
      return solution;

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to solve reCAPTCHA v2');
      throw error;
    }
  }

  /**
   * Solve reCAPTCHA v3
   * @param {string} siteKey - The site key
   * @param {string} pageUrl - The page URL
   * @param {string} action - The action name (default: 'submit')
   * @returns {Promise<string>} The solved CAPTCHA token
   */
  async solveRecaptchaV3(siteKey, pageUrl, action = 'submit') {
    if (!this.apiKey) {
      throw new Error('2Captcha API key not configured');
    }

    logger.info({ siteKey: siteKey.substring(0, 15) + '...' }, 'Solving reCAPTCHA v3');

    try {
      const response = await http.get(`${this.baseUrl}/in.php`, {
        params: {
          key: this.apiKey,
          method: 'userrecaptcha',
          version: 'v3',
          googlekey: siteKey,
          pageurl: pageUrl,
          action: action,
          min_score: 0.3,
          json: 1
        }
      });

      if (response.data.status !== 1) {
        throw new Error(`2Captcha error: ${response.data.request}`);
      }

      const taskId = response.data.request;
      logger.info({ taskId }, 'CAPTCHA submitted, waiting for solution...');

      const solution = await this.pollForSolution(taskId);
      logger.info('reCAPTCHA v3 solved successfully');
      return solution;

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to solve reCAPTCHA v3');
      throw error;
    }
  }

  /**
   * Solve hCaptcha
   * @param {string} siteKey - The site key
   * @param {string} pageUrl - The page URL
   * @returns {Promise<string>} The solved CAPTCHA token
   */
  async solveHCaptcha(siteKey, pageUrl) {
    if (!this.apiKey) {
      throw new Error('2Captcha API key not configured');
    }

    logger.info({ siteKey: siteKey.substring(0, 15) + '...' }, 'Solving hCaptcha');

    try {
      const response = await http.get(`${this.baseUrl}/in.php`, {
        params: {
          key: this.apiKey,
          method: 'hcaptcha',
          sitekey: siteKey,
          pageurl: pageUrl,
          json: 1
        }
      });

      if (response.data.status !== 1) {
        throw new Error(`2Captcha error: ${response.data.request}`);
      }

      const taskId = response.data.request;
      logger.info({ taskId }, 'CAPTCHA submitted, waiting for solution...');

      const solution = await this.pollForSolution(taskId);
      logger.info('hCaptcha solved successfully');
      return solution;

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to solve hCaptcha');
      throw error;
    }
  }

  /**
   * Solve Cloudflare Turnstile
   * @param {string} siteKey - The site key
   * @param {string} pageUrl - The page URL
   * @returns {Promise<string>} The solved CAPTCHA token
   */
  async solveTurnstile(siteKey, pageUrl) {
    if (!this.apiKey) {
      throw new Error('2Captcha API key not configured');
    }

    logger.info({ siteKey: siteKey.substring(0, 15) + '...' }, 'Solving Cloudflare Turnstile');

    try {
      const response = await http.get(`${this.baseUrl}/in.php`, {
        params: {
          key: this.apiKey,
          method: 'turnstile',
          sitekey: siteKey,
          pageurl: pageUrl,
          json: 1
        }
      });

      if (response.data.status !== 1) {
        throw new Error(`2Captcha error: ${response.data.request}`);
      }

      const taskId = response.data.request;
      logger.info({ taskId }, 'CAPTCHA submitted, waiting for solution...');

      const solution = await this.pollForSolution(taskId);
      logger.info('Turnstile solved successfully');
      return solution;

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to solve Turnstile');
      throw error;
    }
  }

  /**
   * Poll for CAPTCHA solution
   * Follows 2captcha official library pattern: 5s interval, 2min timeout
   * @param {string} taskId - The task ID from 2Captcha
   * @returns {Promise<string>} The CAPTCHA solution
   */
  async pollForSolution(taskId) {
    const maxAttempts = Math.floor(this.timeout / this.pollingInterval); // 24 attempts = 2 minutes

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Wait before polling (2captcha recommends 5s minimum)
      await new Promise(resolve => setTimeout(resolve, this.pollingInterval));

      try {
        const response = await http.get(`${this.baseUrl}/res.php`, {
          params: {
            key: this.apiKey,
            action: 'get',
            id: taskId,
            json: 1
          }
        });

        // Solution ready
        if (response.data.status === 1) {
          return response.data.request;
        }

        // Still processing
        if (response.data.request === 'CAPCHA_NOT_READY') {
          const elapsed = Math.floor(((attempt + 1) * this.pollingInterval) / 1000);
          logger.debug({ elapsed, attempt: attempt + 1 }, 'CAPTCHA still processing...');
          continue;
        }

        // Handle specific errors
        if (response.data.request === 'ERROR_CAPTCHA_UNSOLVABLE') {
          throw new Error('CAPTCHA cannot be solved by 2Captcha workers');
        }

        if (response.data.request === 'ERROR_ZERO_BALANCE') {
          throw new Error('2Captcha account has no balance');
        }

        // Any other error
        throw new Error(`2Captcha error: ${response.data.request}`);

      } catch (error) {
        // Rethrow our errors
        if (error.message.includes('2Captcha') || error.message.includes('CAPTCHA')) {
          throw error;
        }

        // Network errors - log and retry
        logger.warn({ attempt: attempt + 1, error: error.message }, 'Poll attempt failed, retrying...');
      }
    }

    throw new Error('CAPTCHA solving timed out after 2 minutes');
  }

  /**
   * Extract siteKey from page (simplified - don't worry about type)
   * Searches iframes, scripts, and DOM for any Google/hCaptcha/Turnstile sitekey
   * @param {Page} page - Puppeteer page object
   * @returns {Promise<string|null>} siteKey if found, null otherwise
   */
  async extractSiteKey(page) {
    const siteKey = await page.evaluate(() => {
      // Check iframes for any reCAPTCHA/hCaptcha/Turnstile
      const iframes = Array.from(document.querySelectorAll('iframe'));
      for (const iframe of iframes) {
        const src = iframe.src || '';

        // Google reCAPTCHA (v2 or v3)
        if (src.includes('google.com/recaptcha')) {
          const match = src.match(/[?&]k=([^&]+)/);
          if (match) return decodeURIComponent(match[1]);
        }

        // hCaptcha
        if (src.includes('hcaptcha.com')) {
          const match = src.match(/[?&]sitekey=([^&]+)/);
          if (match) return decodeURIComponent(match[1]);
        }

        // Turnstile
        if (src.includes('challenges.cloudflare.com/turnstile')) {
          const match = src.match(/[?&]sitekey=([^&]+)/);
          if (match) return decodeURIComponent(match[1]);
        }
      }

      // Check script src for reCAPTCHA
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      for (const script of scripts) {
        const src = script.src;
        if (src.includes('google.com/recaptcha') && src.includes('render=')) {
          const match = src.match(/[?&]render=([^&]+)/);
          if (match) return decodeURIComponent(match[1]);
        }
      }

      // Check inline scripts
      const inlineScripts = Array.from(document.querySelectorAll('script:not([src])'));
      for (const script of inlineScripts) {
        const content = script.textContent || '';
        if (content.includes('grecaptcha')) {
          const match = content.match(/['"]sitekey['"]:\s*['"]([^'"]+)['"]/);
          if (match) return match[1];

          const execMatch = content.match(/grecaptcha\.execute\(['"]([^'"]+)['"]/);
          if (execMatch) return execMatch[1];
        }
      }

      // Check DOM elements
      const recaptcha = document.querySelector('.g-recaptcha');
      if (recaptcha) {
        return recaptcha.getAttribute('data-sitekey');
      }

      const hcaptcha = document.querySelector('.h-captcha');
      if (hcaptcha) {
        return hcaptcha.getAttribute('data-sitekey');
      }

      const turnstile = document.querySelector('.cf-turnstile');
      if (turnstile) {
        return turnstile.getAttribute('data-sitekey');
      }

      return null;
    });

    if (siteKey) {
      logger.info({ siteKey: siteKey.substring(0, 15) + '...' }, 'Found CAPTCHA siteKey');
    }

    return siteKey;
  }

  /**
   * Solve and inject CAPTCHA solution into page
   * Strategy: Try reCAPTCHA v2 first (95% of job sites), fallback to v3
   * @param {Page} page - Puppeteer page object
   * @returns {Promise<boolean>} Success status
   */
  async solveAndInject(page) {
    if (!this.apiKey) {
      throw new Error('2Captcha API key not configured');
    }

    // Step 1: Find any sitekey
    const siteKey = await this.extractSiteKey(page);

    if (!siteKey) {
      logger.debug('No CAPTCHA detected on page');
      return false;
    }

    const pageUrl = page.url();
    logger.info('CAPTCHA detected, attempting to solve...');

    // Step 2: Try reCAPTCHA v2 first (most common for job sites)
    try {
      logger.info('Trying reCAPTCHA v2...');
      const solution = await this.solveRecaptchaV2(siteKey, pageUrl);
      await this.injectRecaptchaV2(page, solution);
      logger.info('✓ CAPTCHA solved and injected (v2)');
      return true;
    } catch (error) {
      logger.warn({ error: error.message }, 'reCAPTCHA v2 failed, trying v3...');
    }

    // Step 3: Fallback to reCAPTCHA v3
    try {
      const solution = await this.solveRecaptchaV3(siteKey, pageUrl);
      await this.injectRecaptchaV3(page, solution);
      logger.info('✓ CAPTCHA solved and injected (v3)');
      return true;
    } catch (error) {
      logger.error({ error: error.message }, 'Both v2 and v3 failed');
      throw new Error('Failed to solve CAPTCHA with both v2 and v3 methods');
    }
  }

  /**
   * Inject reCAPTCHA v2 solution into page
   * @param {Page} page - Puppeteer page
   * @param {string} token - Solved CAPTCHA token
   */
  async injectRecaptchaV2(page, token) {
    await page.evaluate((token) => {
      // Find response textarea
      let textarea = document.querySelector('#g-recaptcha-response') ||
                    document.querySelector('textarea[name="g-recaptcha-response"]');

      if (textarea) {
        textarea.value = token;
        textarea.style.display = 'block';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Override getResponse
      if (window.grecaptcha) {
        window.grecaptcha.getResponse = () => token;
      }
    }, token);
  }

  /**
   * Inject reCAPTCHA v3 solution into page
   * @param {Page} page - Puppeteer page
   * @param {string} token - Solved CAPTCHA token
   */
  async injectRecaptchaV3(page, token) {
    await page.evaluate((token) => {
      // Create or find hidden input
      let input = document.querySelector('input[name="g-recaptcha-response"]') ||
                  document.querySelector('textarea[name="g-recaptcha-response"]');

      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'g-recaptcha-response';
        const form = document.querySelector('form');
        if (form) {
          form.appendChild(input);
        } else {
          document.body.appendChild(input);
        }
      }

      input.value = token;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      // Override execute to return our token
      if (window.grecaptcha && window.grecaptcha.execute) {
        window.grecaptcha.execute = async () => token;
      }
    }, token);
  }
}

export default CaptchaSolver;
