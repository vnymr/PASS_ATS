/**
 * Improved CAPTCHA Handler
 * Handles CAPTCHA detection and solving with proper flow control
 */

import logger from './logger.js';
import CaptchaSolver from './captcha-solver.js';

class ImprovedCaptchaHandler {
  constructor() {
    this.solver = new CaptchaSolver();
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds between retries
  }

  /**
   * Check and solve CAPTCHA if present
   * @param {Page|Frame} target - Puppeteer page or frame object
   * @returns {Object} Result of CAPTCHA handling
   */
  async handleCaptcha(target) {
    const result = {
      captchaDetected: false,
      captchaSolved: false,
      captchaType: null,
      cost: 0,
      error: null,
      attempts: 0
    };

    try {
      // Step 1: Detect CAPTCHA
      logger.info('🔍 Checking for CAPTCHA...');
      const captchaInfo = await this.detectCaptchaImproved(target);

      result.captchaDetected = captchaInfo.found;
      result.captchaType = captchaInfo.type;

      if (!captchaInfo.found) {
        logger.info('✅ No CAPTCHA detected');
        return result;
      }

      logger.info(`🔐 CAPTCHA detected: ${captchaInfo.type}`);

      // Step 2: Check if we can solve it
      if (!process.env.TWOCAPTCHA_API_KEY) {
        result.error = '2Captcha API key not configured';
        logger.warn('⚠️  CAPTCHA detected but 2Captcha not configured');
        return result;
      }

      // Step 3: Attempt to solve with retries
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        result.attempts = attempt;
        logger.info(`🔧 Attempting to solve CAPTCHA (attempt ${attempt}/${this.maxRetries})...`);

        try {
          const solved = await this.solver.solveAndInject(target);

          if (solved) {
            result.captchaSolved = true;
            result.cost = 0.03; // Approximate cost per solve
            logger.info('✅ CAPTCHA solved successfully!');

            // Wait a bit for the page to process the CAPTCHA solution
            await this.sleep(2000);

            return result;
          }
        } catch (solveError) {
          logger.warn(`⚠️  CAPTCHA solve attempt ${attempt} failed: ${solveError.message}`);

          if (attempt < this.maxRetries) {
            logger.info(`⏳ Waiting ${this.retryDelay}ms before retry...`);
            await this.sleep(this.retryDelay);
          } else {
            result.error = `Failed after ${attempt} attempts: ${solveError.message}`;
          }
        }
      }

      // All attempts failed
      logger.error('❌ Failed to solve CAPTCHA after all attempts');

    } catch (error) {
      logger.error({ error: error.message }, 'CAPTCHA handler error');
      result.error = error.message;
    }

    return result;
  }

  /**
   * Improved CAPTCHA detection
   * Checks both main page and iframes
   */
  async detectCaptchaImproved(target) {
    try {
      // First check the target directly
      const directCheck = await target.evaluate(() => {
        // Check for reCAPTCHA v2
        const recaptchaV2Elements = [
          document.querySelector('.g-recaptcha'),
          document.querySelector('[data-sitekey]'),
          document.querySelector('div[data-callback*="recaptcha"]')
        ].filter(Boolean);

        if (recaptchaV2Elements.length > 0) {
          const element = recaptchaV2Elements[0];
          const siteKey = element.getAttribute('data-sitekey') ||
                          element.getAttribute('data-site-key');
          if (siteKey) {
            return {
              found: true,
              type: 'recaptcha_v2',
              siteKey: siteKey
            };
          }
        }

        // Check for reCAPTCHA v3 in scripts
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
          const content = script.textContent || script.innerHTML || '';

          // Look for v3 patterns
          if (content.includes('grecaptcha.execute') ||
              content.includes('grecaptcha.ready')) {

            // Try to extract site key
            const siteKeyMatch = content.match(/['"]([0-9a-zA-Z_-]{40})['"]/) ||
                                content.match(/sitekey['":\s]+['"]([^'"]+)['"]/i) ||
                                content.match(/site_key['":\s]+['"]([^'"]+)['"]/i);

            if (siteKeyMatch) {
              return {
                found: true,
                type: 'recaptcha_v3',
                siteKey: siteKeyMatch[1]
              };
            }
          }
        }

        // Check for hCaptcha
        const hcaptcha = document.querySelector('.h-captcha');
        if (hcaptcha) {
          const siteKey = hcaptcha.getAttribute('data-sitekey');
          if (siteKey) {
            return {
              found: true,
              type: 'hcaptcha',
              siteKey: siteKey
            };
          }
        }

        // Check for Cloudflare Turnstile
        const turnstile = document.querySelector('.cf-turnstile');
        if (turnstile) {
          const siteKey = turnstile.getAttribute('data-sitekey');
          if (siteKey) {
            return {
              found: true,
              type: 'turnstile',
              siteKey: siteKey
            };
          }
        }

        // Check for generic CAPTCHA indicators
        const genericIndicators = [
          document.querySelector('#captcha'),
          document.querySelector('[class*="captcha"]'),
          document.querySelector('[id*="captcha"]'),
          document.querySelector('iframe[src*="captcha"]')
        ].filter(Boolean);

        if (genericIndicators.length > 0) {
          // Don't treat generic indicators as actual CAPTCHA
          // unless we can identify the type
          return {
            found: false,
            type: null,
            siteKey: null,
            warning: 'Generic CAPTCHA elements found but type unknown'
          };
        }

        return {
          found: false,
          type: null,
          siteKey: null
        };
      });

      // If we found a CAPTCHA, return it
      if (directCheck.found) {
        return directCheck;
      }

      // Check iframes if this is a page (not a frame)
      if (target.frames && typeof target.frames === 'function') {
        const frames = await target.frames();

        for (const frame of frames) {
          try {
            const frameUrl = frame.url();

            // Skip about:blank and data: URLs
            if (frameUrl === 'about:blank' || frameUrl.startsWith('data:')) {
              continue;
            }

            // Check for CAPTCHA iframe URLs
            if (frameUrl.includes('recaptcha') ||
                frameUrl.includes('hcaptcha') ||
                frameUrl.includes('captcha')) {

              logger.info(`🔍 Found CAPTCHA iframe: ${frameUrl}`);

              // Try to extract site key from parent page
              const parentCheck = await target.evaluate(() => {
                const recaptchaDiv = document.querySelector('.g-recaptcha');
                if (recaptchaDiv) {
                  return recaptchaDiv.getAttribute('data-sitekey');
                }
                return null;
              });

              if (parentCheck) {
                return {
                  found: true,
                  type: frameUrl.includes('recaptcha') ? 'recaptcha_v2' : 'unknown',
                  siteKey: parentCheck
                };
              }
            }
          } catch (frameError) {
            // Frame might be cross-origin, skip it
            continue;
          }
        }
      }

      return directCheck;

    } catch (error) {
      logger.error({ error: error.message }, 'Error detecting CAPTCHA');
      return {
        found: false,
        type: null,
        siteKey: null,
        error: error.message
      };
    }
  }

  /**
   * Sleep helper
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if CAPTCHA solution was successful
   * @param {Page|Frame} target - Puppeteer page or frame
   * @returns {Boolean} True if CAPTCHA is solved
   */
  async verifyCaptchaSolved(target) {
    try {
      // Wait a bit for the page to update
      await this.sleep(1000);

      // Check if CAPTCHA elements are gone or marked as solved
      const stillHasCaptcha = await target.evaluate(() => {
        // Check if reCAPTCHA is solved
        const recaptchaResponse = document.querySelector('#g-recaptcha-response');
        if (recaptchaResponse && recaptchaResponse.value) {
          return false; // CAPTCHA is solved
        }

        // Check if challenge iframe is gone
        const challengeFrame = document.querySelector('iframe[src*="recaptcha/api2/bframe"]');
        if (challengeFrame && challengeFrame.style.display !== 'none') {
          return true; // Still has active challenge
        }

        // Check for success indicators
        const successIndicators = [
          document.querySelector('.recaptcha-success'),
          document.querySelector('[data-callback*="success"]'),
          document.querySelector('.captcha-solved')
        ].filter(Boolean);

        if (successIndicators.length > 0) {
          return false; // CAPTCHA is solved
        }

        // Check if form is now accessible
        const formInputs = document.querySelectorAll('input:not([type="hidden"]), textarea');
        if (formInputs.length > 3) {
          return false; // Form is accessible, likely CAPTCHA was solved
        }

        return true; // Still has CAPTCHA
      });

      return !stillHasCaptcha;

    } catch (error) {
      logger.warn({ error: error.message }, 'Could not verify CAPTCHA solution');
      return false;
    }
  }
}

export default ImprovedCaptchaHandler;