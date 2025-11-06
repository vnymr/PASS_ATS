/**
 * CAPTCHA Solver
 * Integrates with 2Captcha API to solve CAPTCHAs automatically
 * Cost: ~$0.03 per CAPTCHA solve
 */

import logger from './logger.js';
import axios from 'axios';

class CaptchaSolver {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.TWOCAPTCHA_API_KEY;
    this.baseUrl = 'https://2captcha.com';

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

    logger.info({ siteKeyPrefix: siteKey.substring(0, 20) + '...', pageUrl }, 'Solving reCAPTCHA v2');

    try {
      // Step 1: Submit CAPTCHA for solving
      const submitResponse = await axios.get(`${this.baseUrl}/in.php`, {
        params: {
          key: this.apiKey,
          method: 'userrecaptcha',
          googlekey: siteKey,
          pageurl: pageUrl,
          json: 1
        }
      });

      if (submitResponse.data.status !== 1) {
        throw new Error(`Failed to submit CAPTCHA: ${submitResponse.data.request}`);
      }

      const taskId = submitResponse.data.request;
      logger.info({ taskId }, 'Waiting for CAPTCHA solution (15-60 seconds)');

      // Step 2: Poll for solution
      const solution = await this.pollForSolution(taskId);

      logger.info('CAPTCHA solved successfully');
      return solution;

    } catch (error) {
      logger.error({ error: error.message }, 'CAPTCHA solving failed');
      throw error;
    }
  }

  /**
   * Solve reCAPTCHA v3
   * @param {string} siteKey - The site key
   * @param {string} pageUrl - The page URL
   * @param {string} action - The action name (default: 'submit')
   * @param {number} minScore - Minimum score (0.1-0.9)
   * @returns {Promise<string>} The solved CAPTCHA token
   */
  async solveRecaptchaV3(siteKey, pageUrl, action = 'submit', minScore = 0.3) {
    if (!this.apiKey) {
      throw new Error('2Captcha API key not configured');
    }

    logger.info({ siteKeyPrefix: siteKey.substring(0, 20) + '...', action, minScore }, 'Solving reCAPTCHA v3');

    try {
      const submitResponse = await axios.get(`${this.baseUrl}/in.php`, {
        params: {
          key: this.apiKey,
          method: 'userrecaptcha',
          version: 'v3',
          googlekey: siteKey,
          pageurl: pageUrl,
          action: action,
          min_score: minScore,
          json: 1
        }
      });

      if (submitResponse.data.status !== 1) {
        throw new Error(`Failed to submit CAPTCHA: ${submitResponse.data.request}`);
      }

      const taskId = submitResponse.data.request;
      logger.info({ taskId }, 'Waiting for CAPTCHA solution');

      const solution = await this.pollForSolution(taskId);

      logger.info('CAPTCHA solved successfully');
      return solution;

    } catch (error) {
      logger.error({ error: error.message }, 'CAPTCHA solving failed');
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

    logger.info({ siteKeyPrefix: siteKey.substring(0, 20) + '...' }, 'Solving hCaptcha');

    try {
      const submitResponse = await axios.get(`${this.baseUrl}/in.php`, {
        params: {
          key: this.apiKey,
          method: 'hcaptcha',
          sitekey: siteKey,
          pageurl: pageUrl,
          json: 1
        }
      });

      if (submitResponse.data.status !== 1) {
        throw new Error(`Failed to submit CAPTCHA: ${submitResponse.data.request}`);
      }

      const taskId = submitResponse.data.request;
      logger.info({ taskId }, 'Waiting for CAPTCHA solution');

      const solution = await this.pollForSolution(taskId);

      logger.info('CAPTCHA solved successfully');
      return solution;

    } catch (error) {
      logger.error({ error: error.message }, 'CAPTCHA solving failed');
      throw error;
    }
  }

  /**
   * Poll for CAPTCHA solution
   * @param {string} taskId - The task ID from 2Captcha
   * @returns {Promise<string>} The CAPTCHA solution
   */
  async pollForSolution(taskId, maxAttempts = 30) {
    const pollInterval = 5000; // 5 seconds
    // 30 attempts × 5 seconds = 150 seconds (2.5 minutes) max wait time

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Wait before polling
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      try {
        const response = await axios.get(`${this.baseUrl}/res.php`, {
          params: {
            key: this.apiKey,
            action: 'get',
            id: taskId,
            json: 1
          }
        });

        if (response.data.status === 1) {
          // Solution ready!
          return response.data.request;
        } else if (response.data.request === 'CAPCHA_NOT_READY') {
          // Still processing
          const elapsed = ((attempt + 1) * pollInterval) / 1000;
          logger.debug({ elapsed }, 'CAPTCHA still processing');
          continue;
        } else {
          throw new Error(`Unexpected response: ${response.data.request}`);
        }
      } catch (error) {
        if (error.response) {
          logger.warn({ attempt: attempt + 1, response: error.response.data }, 'Poll attempt failed');
        } else {
          logger.warn({ attempt: attempt + 1, error: error.message }, 'Poll attempt failed');
        }
      }
    }

    throw new Error('CAPTCHA solving timed out (2.5 minutes)');
  }

  /**
   * Detect CAPTCHA type on page
   * @param {Page} page - Puppeteer page object
   * @returns {Promise<Object>} CAPTCHA info {type, siteKey, found}
   */
  async detectCaptcha(page) {
    const captchaInfo = await page.evaluate(() => {
      // Check for reCAPTCHA v2
      const recaptchaV2 = document.querySelector('.g-recaptcha');
      if (recaptchaV2) {
        const siteKey = recaptchaV2.getAttribute('data-sitekey');
        return {
          found: true,
          type: 'recaptcha_v2',
          siteKey: siteKey
        };
      }

      // Check for reCAPTCHA v3 (in scripts)
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const content = script.textContent || script.innerHTML;
        if (content.includes('grecaptcha.execute')) {
          const match = content.match(/grecaptcha\.execute\(['"]([^'"]+)['"]/);
          if (match) {
            return {
              found: true,
              type: 'recaptcha_v3',
              siteKey: match[1]
            };
          }
        }
      }

      // Check for hCaptcha
      const hcaptcha = document.querySelector('.h-captcha');
      if (hcaptcha) {
        const siteKey = hcaptcha.getAttribute('data-sitekey');
        return {
          found: true,
          type: 'hcaptcha',
          siteKey: siteKey
        };
      }

      // Check for Cloudflare turnstile
      const turnstile = document.querySelector('.cf-turnstile');
      if (turnstile) {
        const siteKey = turnstile.getAttribute('data-sitekey');
        return {
          found: true,
          type: 'turnstile',
          siteKey: siteKey
        };
      }

      return {
        found: false,
        type: null,
        siteKey: null
      };
    });

    return captchaInfo;
  }

  /**
   * Solve and inject CAPTCHA solution into page
   * @param {Page} page - Puppeteer page object
   * @returns {Promise<boolean>} Success status
   */
  async solveAndInject(page) {
    logger.debug('Detecting CAPTCHA');

    const captchaInfo = await this.detectCaptcha(page);

    if (!captchaInfo.found) {
      logger.debug('No CAPTCHA detected');
      return false;
    }

    logger.info({ captchaType: captchaInfo.type }, 'CAPTCHA detected');

    if (!this.apiKey) {
      throw new Error('CAPTCHA detected but 2Captcha API key not configured');
    }

    const pageUrl = page.url();
    let solution;

    try {
      // Solve based on type
      switch (captchaInfo.type) {
        case 'recaptcha_v2':
          solution = await this.solveRecaptchaV2(captchaInfo.siteKey, pageUrl);
          break;

        case 'recaptcha_v3':
          solution = await this.solveRecaptchaV3(captchaInfo.siteKey, pageUrl);
          break;

        case 'hcaptcha':
          solution = await this.solveHCaptcha(captchaInfo.siteKey, pageUrl);
          break;

        case 'turnstile':
          // Turnstile uses similar method to hCaptcha
          solution = await this.solveHCaptcha(captchaInfo.siteKey, pageUrl);
          break;

        default:
          throw new Error(`Unsupported CAPTCHA type: ${captchaInfo.type}`);
      }

      // Inject solution into page
      logger.debug('Injecting CAPTCHA solution');

      const injectionResult = await page.evaluate((token, type) => {
        if (type === 'recaptcha_v2' || type === 'recaptcha_v3') {
          // Find the textarea where reCAPTCHA stores the response
          const textarea = document.querySelector('#g-recaptcha-response') ||
                          document.querySelector('textarea[name="g-recaptcha-response"]');
          if (textarea) {
            textarea.value = token;
            textarea.style.display = 'block'; // Make visible temporarily

            // Verify injection worked
            return {
              success: textarea.value === token,
              type: 'recaptcha',
              textareaFound: true
            };
          }

          // Trigger callback if exists
          if (window.grecaptcha && window.grecaptcha.getResponse) {
            window.grecaptcha.getResponse = () => token;
          }

          return { success: false, type: 'recaptcha', textareaFound: false };
        } else if (type === 'hcaptcha') {
          // Find hCaptcha response textarea
          const textarea = document.querySelector('textarea[name="h-captcha-response"]');
          if (textarea) {
            textarea.value = token;

            // Verify injection worked
            return {
              success: textarea.value === token,
              type: 'hcaptcha',
              textareaFound: true
            };
          }

          return { success: false, type: 'hcaptcha', textareaFound: false };
        }

        return { success: false, type: 'unknown', textareaFound: false };
      }, solution, captchaInfo.type);

      // Verify injection was successful
      if (!injectionResult.success) {
        const errorMsg = injectionResult.textareaFound
          ? 'CAPTCHA injection failed - value not set correctly'
          : `CAPTCHA injection failed - ${injectionResult.type} textarea not found`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Calculate actual cost based on CAPTCHA type
      const captchaCost = this.getCaptchaCost(captchaInfo.type);
      logger.info({ cost: captchaCost, type: captchaInfo.type }, 'CAPTCHA solution injected and verified successfully');

      return true;

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to solve CAPTCHA');
      throw error;
    }
  }

  /**
   * Get the cost of solving a specific CAPTCHA type
   * @param {string} captchaType - The type of CAPTCHA
   * @returns {number} Cost in USD
   */
  getCaptchaCost(captchaType) {
    const costs = {
      'recaptcha_v2': 0.003,    // $0.003 per solve
      'recaptcha_v3': 0.003,    // $0.003 per solve
      'hcaptcha': 0.003,        // $0.003 per solve
      'turnstile': 0.003,       // $0.003 per solve
      'funcaptcha': 0.003       // $0.003 per solve
    };

    return costs[captchaType] || 0.003; // Default to $0.003
  }

  /**
   * Get account balance
   * @returns {Promise<number>} Balance in USD
   */
  async getBalance() {
    if (!this.apiKey) {
      throw new Error('2Captcha API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/res.php`, {
        params: {
          key: this.apiKey,
          action: 'getbalance',
          json: 1
        }
      });

      if (response.data.status === 1) {
        return parseFloat(response.data.request);
      } else {
        throw new Error('Failed to get balance');
      }
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get balance');
      throw error;
    }
  }
}

export default CaptchaSolver;
