/**
 * Improved Auto Apply Flow
 * Fixes the order of operations for job applications
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import logger from './logger.js';
import ImprovedCaptchaHandler from './improved-captcha-handler.js';
import AIFormFiller from './ai-form-filler.js';

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

class ImprovedAutoApply {
  constructor() {
    this.captchaHandler = new ImprovedCaptchaHandler();
    this.formFiller = new AIFormFiller();
    this.maxAttempts = 3;
  }

  /**
   * Apply to a job with improved flow
   * @param {String} jobUrl - The job application URL
   * @param {Object} user - User data and profile
   * @param {Object} jobData - Job information
   * @param {String} resumePath - Path to resume file
   * @returns {Object} Application result
   */
  async applyToJob(jobUrl, user, jobData, resumePath) {
    const result = {
      success: false,
      method: 'IMPROVED_AI_AUTO',
      fieldsExtracted: 0,
      fieldsFilled: 0,
      captchaDetected: false,
      captchaSolved: false,
      errors: [],
      warnings: [],
      cost: 0,
      screenshot: null,
      confirmationData: {}
    };

    let browser = null;
    let page = null;

    try {
      // Step 1: Launch browser with stealth mode
      logger.info('🚀 Launching browser for improved AI application...');
      browser = await puppeteer.launch({
        headless: process.env.HEADLESS !== 'false',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1920,1080'
        ],
        defaultViewport: {
          width: 1920,
          height: 1080
        }
      });

      page = await browser.newPage();

      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Step 2: Navigate to job page
      logger.info(`📄 Navigating to ${jobUrl}...`);
      await page.goto(jobUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Human-like delay
      await this.sleep(2000 + Math.random() * 2000);

      // Step 3: Check for CAPTCHA on main page FIRST
      logger.info('🔍 Checking for CAPTCHA on main page...');
      const mainPageCaptcha = await this.captchaHandler.handleCaptcha(page);

      if (mainPageCaptcha.captchaDetected) {
        result.captchaDetected = true;
        result.captchaType = mainPageCaptcha.captchaType;

        if (mainPageCaptcha.captchaSolved) {
          result.captchaSolved = true;
          result.cost += mainPageCaptcha.cost;
          logger.info('✅ Main page CAPTCHA solved');
        } else {
          result.errors.push(`CAPTCHA detected but not solved: ${mainPageCaptcha.error}`);
          logger.error('❌ Failed to solve main page CAPTCHA');

          // Take screenshot for debugging
          const screenshot = await page.screenshot({ encoding: 'base64' });
          result.screenshot = `data:image/png;base64,${screenshot}`;

          return result;
        }
      }

      // Step 4: Look for application form or Apply button
      logger.info('🔍 Looking for application form or Apply button...');

      // Check if form is already visible
      const hasVisibleForm = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select'));
        const visibleInputs = inputs.filter(el =>
          el.offsetParent !== null && el.offsetWidth > 0 && el.offsetHeight > 0
        );
        return visibleInputs.length >= 3;
      });

      let targetPage = page;
      let applicationFrame = null;

      if (!hasVisibleForm) {
        logger.info('📱 No form visible, checking for iframes...');

        // Check for application iframe (Greenhouse, Lever, etc.)
        const frames = page.frames();
        for (const frame of frames) {
          const frameUrl = frame.url();
          if (this.isApplicationFrame(frameUrl)) {
            logger.info(`🎯 Found application iframe: ${frameUrl}`);
            applicationFrame = frame;
            targetPage = frame;

            // Check for CAPTCHA in the iframe
            const iframeCaptcha = await this.captchaHandler.handleCaptcha(frame);
            if (iframeCaptcha.captchaDetected) {
              result.captchaDetected = true;

              if (iframeCaptcha.captchaSolved) {
                result.captchaSolved = true;
                result.cost += iframeCaptcha.cost;
                logger.info('✅ Iframe CAPTCHA solved');
              } else {
                result.errors.push(`Iframe CAPTCHA not solved: ${iframeCaptcha.error}`);
                logger.error('❌ Failed to solve iframe CAPTCHA');
                return result;
              }
            }
            break;
          }
        }

        // If no iframe, try clicking Apply button
        if (!applicationFrame) {
          logger.info('🔍 Looking for Apply button...');
          const applyClicked = await this.clickApplyButton(page);

          if (applyClicked) {
            logger.info('✅ Apply button clicked, waiting for form...');
            await this.sleep(3000);

            // Check for CAPTCHA after clicking Apply
            const postClickCaptcha = await this.captchaHandler.handleCaptcha(page);
            if (postClickCaptcha.captchaDetected) {
              result.captchaDetected = true;

              if (postClickCaptcha.captchaSolved) {
                result.captchaSolved = true;
                result.cost += postClickCaptcha.cost;
                logger.info('✅ Post-click CAPTCHA solved');
              } else {
                result.errors.push(`Post-click CAPTCHA not solved: ${postClickCaptcha.error}`);
                return result;
              }
            }

            // Re-check for iframes after clicking
            const postClickFrames = page.frames();
            for (const frame of postClickFrames) {
              if (this.isApplicationFrame(frame.url())) {
                logger.info(`🎯 Found application iframe after Apply click`);
                applicationFrame = frame;
                targetPage = frame;
                break;
              }
            }
          }
        }
      }

      // Step 5: Prepare user profile data
      const userProfile = this.prepareUserProfile(user);

      // Step 6: Fill the form using AI
      logger.info('🤖 Starting AI form filling...');
      const fillResult = await this.formFiller.fillFormIntelligently(
        targetPage,
        userProfile,
        jobData,
        resumePath
      );

      // Update result
      result.fieldsExtracted = fillResult.fieldsExtracted;
      result.fieldsFilled = fillResult.fieldsFilled;
      result.errors.push(...fillResult.errors);
      result.warnings.push(...fillResult.warnings);
      result.cost += fillResult.cost;

      // Check if filling was successful
      if (fillResult.fieldsFilled > 0) {
        result.success = true;
        logger.info(`✅ Successfully filled ${fillResult.fieldsFilled}/${fillResult.fieldsExtracted} fields`);

        // Step 7: Submit if submit button found
        if (fillResult.submitButton) {
          logger.info('📤 Submit button found, attempting submission...');
          try {
            await this.formFiller.submitForm(targetPage, fillResult.submitButton);
            logger.info('✅ Application submitted successfully!');
            await this.sleep(2000);
          } catch (submitError) {
            logger.error(`❌ Failed to submit: ${submitError.message}`);
            result.warnings.push(`Submit failed: ${submitError.message}`);
          }
        }
      } else {
        result.success = false;
        logger.error('❌ No fields were filled');
      }

      // Step 8: Take final screenshot
      const finalScreenshot = await page.screenshot({
        encoding: 'base64',
        fullPage: false
      });
      result.screenshot = `data:image/png;base64,${finalScreenshot}`;

      // Add confirmation data
      result.confirmationData = {
        fieldsExtracted: result.fieldsExtracted,
        fieldsFilled: result.fieldsFilled,
        captchaDetected: result.captchaDetected,
        captchaSolved: result.captchaSolved,
        aiCost: result.cost,
        timestamp: new Date().toISOString()
      };

      return result;

    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, '❌ Improved AI application error');
      result.errors.push(error.message);
      result.success = false;

      // Try to take error screenshot
      if (page) {
        try {
          const errorScreenshot = await page.screenshot({ encoding: 'base64' });
          result.screenshot = `data:image/png;base64,${errorScreenshot}`;
        } catch (screenshotError) {
          logger.warn('Failed to take error screenshot');
        }
      }

      return result;

    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Check if a frame URL is an application frame
   */
  isApplicationFrame(url) {
    const patterns = [
      'greenhouse',
      'boards.greenhouse.io',
      'lever.co',
      'workday',
      'myworkdayjobs.com',
      'apply',
      'application',
      'job-app'
    ];

    return patterns.some(pattern => url.toLowerCase().includes(pattern));
  }

  /**
   * Click the Apply button
   */
  async clickApplyButton(page) {
    try {
      return await page.evaluate(() => {
        // Common Apply button selectors
        const selectors = [
          'a[id*="apply"]',
          'a.app-link',
          'a[href*="apply"]',
          '.apply-button',
          'a.template-btn-submit',
          'button[aria-label*="apply"]',
          '[data-qa="apply-button"]'
        ];

        // Try specific selectors
        for (const selector of selectors) {
          const button = document.querySelector(selector);
          if (button && button.offsetParent !== null) {
            button.click();
            return true;
          }
        }

        // Fallback: find by text
        const allButtons = Array.from(document.querySelectorAll('a, button'));
        const applyButton = allButtons.find(btn => {
          const text = (btn.textContent || '').toLowerCase();
          return (
            text.includes('apply') &&
            !text.includes('applied') &&
            !text.includes('apply later') &&
            btn.offsetParent !== null
          );
        });

        if (applyButton) {
          applyButton.click();
          return true;
        }

        return false;
      });
    } catch (error) {
      logger.warn(`Failed to click Apply button: ${error.message}`);
      return false;
    }
  }

  /**
   * Prepare user profile data
   */
  prepareUserProfile(user) {
    const profileData = user.profile?.data || {};
    const appData = profileData.applicationData;

    return {
      fullName: appData?.personalInfo?.fullName ||
                profileData?.name ||
                `${profileData?.firstName || ''} ${profileData?.lastName || ''}`.trim(),
      email: appData?.personalInfo?.email ||
             profileData?.email ||
             user.email,
      phone: appData?.personalInfo?.phone || profileData?.phone || '',
      location: appData?.personalInfo?.location || profileData?.location || '',
      linkedIn: appData?.personalInfo?.linkedin || profileData?.linkedin || '',
      portfolio: appData?.personalInfo?.website || profileData?.website || '',
      experience: appData?.experience || profileData?.experiences || [],
      education: appData?.education || profileData?.education || [],
      skills: appData?.skills || profileData?.skills || [],
      applicationQuestions: profileData?.applicationQuestions || {}
    };
  }

  /**
   * Sleep helper
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ImprovedAutoApply;