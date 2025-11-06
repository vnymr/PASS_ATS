/**
 * Recipe Engine - Record Once, Replay Forever
 *
 * Uses BrowserUse to RECORD form steps once, then replays with Playwright
 * Cost: $0.80 once per platform → $0.05 per replay (16x cheaper!)
 * MIGRATED FROM PUPPETEER TO PLAYWRIGHT
 */

import { chromium } from 'playwright';
import { prisma } from './prisma-client.js';
import logger from './logger.js';

class RecipeEngine {
  constructor() {
    this.browser = null;
  }

  /**
   * Main entry point: Apply to job using recipe or BrowserUse fallback
   */
  async applyToJob(jobUrl, atsType, userData) {
    logger.info({ jobUrl, atsType }, 'Starting auto-apply');

    // Step 1: Try to load existing recipe
    const recipe = await this.loadRecipe(atsType);

    if (recipe) {
      logger.info({ recipeId: recipe.id, platform: recipe.platform }, 'Found existing recipe, replaying...');

      // Try Playwright replay (cheap!)
      const result = await this.replayRecipe(recipe, jobUrl, userData);

      if (result.success) {
        // Success! Track it
        await this.trackExecution(recipe.id, true, 'REPLAY', result.cost);
        await this.updateRecipeStats(recipe.id, true);

        logger.info('✅ Applied using Playwright replay - cost $0.05');
        return result;
      }

      // Replay failed, fall back to BrowserUse
      logger.warn({ error: result.error }, 'Playwright replay failed, falling back to BrowserUse');
    }

    // Step 2: No recipe or replay failed → Use BrowserUse
    logger.info('Using BrowserUse (will cost $0.80)');

    // Record with BrowserUse
    return await this.recordWithBrowserUse(jobUrl, atsType, userData);
  }

  /**
   * Replay a saved recipe using Playwright
   */
  async replayRecipe(recipe, jobUrl, userData) {
    const startTime = Date.now();

    try {
      // Launch browser
      if (!this.browser) {
        this.browser = await chromium.launch({
          headless: false, // Show browser for debugging
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }

      const context = await this.browser.newContext();
      const page = await context.newPage();

      // Navigate to job page
      await page.goto(jobUrl, { waitUntil: 'networkidle', timeout: 30000 });

      logger.info(`Executing ${recipe.steps.length} steps with Playwright...`);

      // Execute each step
      for (let i = 0; i < recipe.steps.length; i++) {
        const step = recipe.steps[i];

        try {
          await this.executeStep(page, step, userData);
          logger.info(`  ✓ Step ${i + 1}/${recipe.steps.length}: ${step.action} ${step.fieldName || step.selector}`);

          // Human-like delay
          await page.waitForTimeout(300 + Math.random() * 700);

        } catch (error) {
          logger.error({ step, error: error.message }, `Failed to execute step ${i + 1}`);

          throw new Error(`Step ${i + 1} failed: ${error.message}`);
        }
      }

      // Take screenshot after submission
      const screenshot = `screenshot_${Date.now()}.png`;
      await page.screenshot({ path: screenshot, fullPage: true });

      // Check for confirmation
      await page.waitForTimeout(2000);
      const confirmationText = await page.evaluate(() => document.body.innerText);
      const confirmationMatch = confirmationText.match(/confirmation.*?:?\s*([A-Z0-9-]+)/i);
      const confirmationId = confirmationMatch?.[1];

      await page.close();
      await context.close();

      const duration = Date.now() - startTime;

      return {
        success: true,
        method: 'REPLAY',
        cost: 0.05, // Playwright cost
        duration,
        screenshot,
        confirmationId
      };

    } catch (error) {
      logger.error({ error: error.message }, 'Recipe replay failed');

      return {
        success: false,
        error: error.message,
        cost: 0.0
      };
    }
  }

  /**
   * Execute a single step using Playwright
   */
  async executeStep(page, step, userData) {
    switch (step.action) {
      case 'type':
        const value = this.interpolate(step.value, userData);
        await page.waitForSelector(step.selector, { timeout: 5000 });
        // Use fill for faster input, falls back to type with delay for more natural behavior
        await page.fill(step.selector, value);
        break;

      case 'select':
        const selectValue = this.interpolate(step.value, userData);
        await page.waitForSelector(step.selector, { timeout: 5000 });
        // Playwright uses selectOption instead of select
        await page.selectOption(step.selector, selectValue);
        break;

      case 'click':
        await page.waitForSelector(step.selector, { timeout: 5000 });
        await page.click(step.selector);
        break;

      case 'upload':
        const filePath = this.interpolate(step.value, userData);
        await page.waitForSelector(step.selector, { timeout: 5000 });
        // Playwright uses setInputFiles instead of uploadFile
        await page.setInputFiles(step.selector, filePath);
        break;

      case 'radio':
        const radioSelector = `${step.selector}[value="${step.value}"]`;
        await page.waitForSelector(radioSelector, { timeout: 5000 });
        await page.click(radioSelector);
        break;

      case 'checkbox':
        const checkboxValue = this.interpolate(step.value, userData);
        if (checkboxValue === 'true' || checkboxValue === true) {
          await page.waitForSelector(step.selector, { timeout: 5000 });
          // Use check() for better checkbox handling
          await page.check(step.selector);
        }
        break;

      case 'wait':
        await page.waitForTimeout(step.duration || 1000);
        break;

      default:
        throw new Error(`Unknown action: ${step.action}`);
    }
  }

  /**
   * Replace {{variables}} in step values
   */
  interpolate(template, userData) {
    if (!template || typeof template !== 'string') return template;

    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      // Support nested paths like {{personalInfo.firstName}}
      const value = path.split('.').reduce((obj, key) => {
        return obj?.[key];
      }, userData.applicationData);

      return value !== undefined ? value : match;
    });
  }

  /**
   * Load recipe from database
   */
  async loadRecipe(atsType) {
    try {
      // Try exact platform match first (e.g., "greenhouse_stripe")
      let recipe = await prisma.applicationRecipe.findUnique({
        where: { platform: atsType.toLowerCase() }
      });

      // If not found, try generic platform (e.g., "greenhouse")
      if (!recipe) {
        const genericPlatform = atsType.split('_')[0].toLowerCase();
        recipe = await prisma.applicationRecipe.findUnique({
          where: { platform: genericPlatform }
        });
      }

      return recipe;

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to load recipe');
      return null;
    }
  }

  /**
   * Save a new recipe to database
   */
  async saveRecipe(platform, atsType, steps, recordedBy = 'system') {
    try {
      const recipe = await prisma.applicationRecipe.upsert({
        where: { platform },
        create: {
          platform,
          atsType,
          steps,
          recordedBy,
          recordingCost: 0.80,
          replayCost: 0.05
        },
        update: {
          steps,
          version: { increment: 1 },
          updatedAt: new Date()
        }
      });

      logger.info({ recipeId: recipe.id, platform }, 'Recipe saved');
      return recipe;

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to save recipe');
      throw error;
    }
  }

  /**
   * Track recipe execution
   */
  async trackExecution(recipeId, success, method, cost, error = null) {
    try {
      await prisma.recipeExecution.create({
        data: {
          recipeId,
          success,
          method,
          cost,
          error,
          executedAt: new Date()
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to track execution');
    }
  }

  /**
   * Update recipe statistics
   */
  async updateRecipeStats(recipeId, success) {
    try {
      const recipe = await prisma.applicationRecipe.findUnique({
        where: { id: recipeId }
      });

      if (!recipe) return;

      const timesUsed = recipe.timesUsed + 1;
      const failureCount = success ? 0 : recipe.failureCount + 1;

      // Calculate success rate
      const executions = await prisma.recipeExecution.count({
        where: { recipeId }
      });
      const successCount = await prisma.recipeExecution.count({
        where: { recipeId, success: true }
      });
      const successRate = executions > 0 ? successCount / executions : 1.0;

      // Calculate total saved (vs always using BrowserUse)
      const saved = (recipe.recordingCost - recipe.replayCost) * (timesUsed - 1);

      await prisma.applicationRecipe.update({
        where: { id: recipeId },
        data: {
          timesUsed,
          failureCount,
          successRate,
          totalSaved: saved,
          lastUsed: new Date(),
          lastFailure: success ? undefined : new Date()
        }
      });

      logger.info({
        recipeId,
        timesUsed,
        successRate,
        totalSaved: saved
      }, 'Recipe stats updated');

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to update recipe stats');
    }
  }

  /**
   * Get recipe statistics
   */
  async getRecipeStats(platform) {
    try {
      const recipe = await prisma.applicationRecipe.findUnique({
        where: { platform },
        include: {
          executions: {
            orderBy: { executedAt: 'desc' },
            take: 10
          }
        }
      });

      if (!recipe) {
        return { error: 'Recipe not found' };
      }

      return {
        platform: recipe.platform,
        atsType: recipe.atsType,
        version: recipe.version,
        successRate: recipe.successRate,
        timesUsed: recipe.timesUsed,
        totalSaved: recipe.totalSaved,
        lastUsed: recipe.lastUsed,
        recentExecutions: recipe.executions
      };

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get recipe stats');
      return { error: error.message };
    }
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Record a new recipe using BrowserUse
   * This is where AI automation learns the form steps
   *
   * @param {string} jobUrl - Job application URL
   * @param {string} atsType - ATS platform type
   * @param {Object} userData - User's application data
   * @returns {Promise<Object>} - Application result
   */
  async recordWithBrowserUse(jobUrl, atsType, userData) {
    logger.info('🤖 Recording new recipe with BrowserUse...');

    try {
      // Check if BrowserUse is available
      if (!process.env.BROWSERUSE_API_KEY) {
        logger.error('BROWSERUSE_API_KEY not found in environment');
        return {
          success: false,
          error: 'BrowserUse API key not configured. Set BROWSERUSE_API_KEY in .env file.',
          needsConfiguration: true,
          cost: 0.0
        };
      }

      // Import BrowserUse dynamically (only when needed)
      let BrowserUse;
      try {
        const browserUseModule = await import('browser-use');
        BrowserUse = browserUseModule.default || browserUseModule.BrowserUse;
      } catch (importError) {
        logger.error({ error: importError.message }, 'Failed to import browser-use');
        return {
          success: false,
          error: 'BrowserUse library not installed. Run: npm install browser-use',
          needsInstall: true,
          cost: 0.0
        };
      }

      // Initialize BrowserUse
      const browser = new BrowserUse({
        apiKey: process.env.BROWSERUSE_API_KEY,
        headless: true
      });

      const recordedSteps = [];

      // Set up event listener to capture actions
      browser.on('action', (action) => {
        logger.debug({ action }, 'BrowserUse action recorded');

        recordedSteps.push({
          action: action.type, // 'type', 'click', 'upload', etc.
          selector: action.selector,
          value: this.makeTemplateFromValue(action.value, userData),
          fieldName: action.label || action.selector,
          required: action.required !== false
        });
      });

      // Navigate and fill form
      await browser.goto(jobUrl);

      // Provide application data to BrowserUse
      await browser.fillApplicationForm({
        personalInfo: userData.applicationData.personalInfo,
        resume: userData.applicationData.resumeUrl,
        commonAnswers: userData.applicationData.commonAnswers
      });

      // Submit the form
      const result = await browser.submitApplication();

      if (result.success) {
        // Save the recorded recipe
        const platform = atsType.toLowerCase();

        await this.saveRecipe(platform, atsType, recordedSteps, 'browseruse');

        logger.info(`✅ Recipe recorded and saved for ${platform}`);
        logger.info(`   • ${recordedSteps.length} steps recorded`);
        logger.info(`   • Cost: $0.80 (one-time)`);
        logger.info(`   • Next applications will cost $0.05`);

        // Track this execution
        const recipe = await this.loadRecipe(platform);
        if (recipe) {
          await this.trackExecution(recipe.id, true, 'BROWSERUSE', 0.80);
        }

        return {
          success: true,
          confirmationId: result.confirmationId,
          screenshot: result.screenshot,
          cost: 0.80,
          method: 'BROWSERUSE_RECORDING',
          recipeSaved: true,
          stepsRecorded: recordedSteps.length
        };
      } else {
        logger.error({ error: result.error }, 'BrowserUse application failed');

        return {
          success: false,
          error: result.error || 'BrowserUse failed to complete application',
          cost: 0.80,
          method: 'BROWSERUSE_RECORDING'
        };
      }
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'BrowserUse recording failed');

      return {
        success: false,
        error: `BrowserUse recording error: ${error.message}`,
        cost: 0.80,
        method: 'BROWSERUSE_RECORDING'
      };
    }
  }

  /**
   * Convert an actual value to a template variable
   * For example: "john@example.com" → "{{personalInfo.email}}"
   *
   * @param {string} value - Actual value from form
   * @param {Object} userData - User's application data
   * @returns {string} - Template variable or original value
   */
  makeTemplateFromValue(value, userData) {
    if (!value || typeof value !== 'string') return value;

    // Check personal info fields
    const personalInfo = userData.applicationData?.personalInfo || {};
    for (const [key, val] of Object.entries(personalInfo)) {
      if (val === value) {
        return `{{personalInfo.${key}}}`;
      }
    }

    // Check common answers
    const commonAnswers = userData.applicationData?.commonAnswers || {};
    for (const [key, val] of Object.entries(commonAnswers)) {
      if (val === value) {
        return `{{commonAnswers.${key}}}`;
      }
    }

    // Check if it's the resume URL
    if (value === userData.applicationData?.resumeUrl) {
      return '{{resumeUrl}}';
    }

    // If no match, return original value
    return value;
  }
}

export default new RecipeEngine();
