/**
 * Browser Recorder - Records user interactions to create recipes
 *
 * Usage:
 *   const recorder = new BrowserRecorder();
 *   await recorder.startRecording('https://job-url.com');
 *   // User interacts with the browser
 *   const recipe = await recorder.stopRecording();
 *
 * MIGRATED FROM PUPPETEER TO PLAYWRIGHT
 */

import { chromium } from 'playwright';
import logger from './logger.js';

export class BrowserRecorder {
  constructor() {
    this.browser = null;
    this.page = null;
    this.recordedSteps = [];
    this.isRecording = false;
  }

  /**
   * Start recording user interactions
   */
  async startRecording(jobUrl, options = {}) {
    logger.info({ jobUrl }, '🎬 Starting Playwright browser recorder...');

    this.recordedSteps = [];
    this.isRecording = true;

    // Launch browser in non-headless mode so user can interact
    this.browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 1024 }
    });

    this.page = await context.newPage();

    // Set up event listeners to capture interactions
    await this.setupRecordingListeners();

    // Navigate to job page
    await this.page.goto(jobUrl, { waitUntil: 'networkidle', timeout: 60000 });

    logger.info('✅ Playwright browser opened - interact with the page to record steps');
    logger.info('   When done, call stopRecording() to save the recipe');

    return {
      browser: this.browser,
      page: this.page,
      steps: this.recordedSteps
    };
  }

  /**
   * Set up listeners to capture user interactions
   */
  async setupRecordingListeners() {
    // Inject recording script into page using Playwright's addInitScript
    await this.page.addInitScript(() => {
      window.recordedActions = [];

      // Track input events
      document.addEventListener('input', (e) => {
        if (e.target.matches('input, textarea, select')) {
          window.recordedActions.push({
            type: 'input',
            timestamp: Date.now(),
            selector: getSelector(e.target),
            value: e.target.value,
            tagName: e.target.tagName,
            inputType: e.target.type,
            label: getFieldLabel(e.target),
            name: e.target.name,
            id: e.target.id
          });
        }
      });

      // Track click events
      document.addEventListener('click', (e) => {
        const target = e.target;

        // Skip if clicking inside an input (already tracked)
        if (target.matches('input, textarea')) return;

        window.recordedActions.push({
          type: 'click',
          timestamp: Date.now(),
          selector: getSelector(target),
          text: target.innerText?.substring(0, 100),
          tagName: target.tagName,
          className: target.className,
          id: target.id
        });
      });

      // Track file uploads
      document.addEventListener('change', (e) => {
        if (e.target.type === 'file') {
          window.recordedActions.push({
            type: 'upload',
            timestamp: Date.now(),
            selector: getSelector(e.target),
            fileName: e.target.files[0]?.name,
            label: getFieldLabel(e.target),
            name: e.target.name,
            id: e.target.id
          });
        }
      });

      // Helper: Generate CSS selector for an element
      function getSelector(el) {
        // Priority 1: ID (most specific)
        if (el.id) {
          return `#${el.id}`;
        }

        // Priority 2: Name attribute
        if (el.name) {
          return `[name="${el.name}"]`;
        }

        // Priority 3: Unique class combination
        if (el.className && typeof el.className === 'string') {
          const classes = el.className.trim().split(/\s+/).filter(c => c);
          if (classes.length > 0) {
            const selector = `.${classes.join('.')}`;
            if (document.querySelectorAll(selector).length === 1) {
              return selector;
            }
          }
        }

        // Priority 4: Data attributes
        for (const attr of el.attributes) {
          if (attr.name.startsWith('data-')) {
            const selector = `[${attr.name}="${attr.value}"]`;
            if (document.querySelectorAll(selector).length === 1) {
              return selector;
            }
          }
        }

        // Priority 5: Type + placeholder (for inputs)
        if (el.tagName === 'INPUT' && el.placeholder) {
          return `input[placeholder="${el.placeholder}"]`;
        }

        // Priority 6: Type + label text
        const label = getFieldLabel(el);
        if (label) {
          const selector = `${el.tagName.toLowerCase()}[aria-label="${label}"]`;
          if (document.querySelectorAll(selector).length === 1) {
            return selector;
          }
        }

        // Fallback: nth-of-type
        const parent = el.parentElement;
        const siblings = Array.from(parent?.children || []).filter(
          child => child.tagName === el.tagName
        );
        const index = siblings.indexOf(el) + 1;

        return `${el.tagName.toLowerCase()}:nth-of-type(${index})`;
      }

      // Helper: Get label text for a form field
      function getFieldLabel(el) {
        // Check aria-label
        if (el.getAttribute('aria-label')) {
          return el.getAttribute('aria-label');
        }

        // Check associated label element
        if (el.id) {
          const label = document.querySelector(`label[for="${el.id}"]`);
          if (label) return label.innerText.trim();
        }

        // Check parent label
        const parentLabel = el.closest('label');
        if (parentLabel) {
          return parentLabel.innerText.replace(el.value || '', '').trim();
        }

        // Check placeholder
        if (el.placeholder) {
          return el.placeholder;
        }

        return null;
      }
    });

    // Poll for recorded actions every 2 seconds
    this.recordingInterval = setInterval(async () => {
      if (!this.isRecording || !this.page) return;

      try {
        const newActions = await this.page.evaluate(() => {
          const actions = window.recordedActions || [];
          window.recordedActions = [];
          return actions;
        });

        // Process and add new actions
        for (const action of newActions) {
          this.processAction(action);
        }
      } catch (error) {
        // Page might be closed or navigating
        logger.debug({ error: error.message }, 'Error polling for actions');
      }
    }, 2000);
  }

  /**
   * Process a recorded action and convert to recipe step
   */
  processAction(action) {
    const step = {
      timestamp: action.timestamp,
      action: this.mapActionType(action),
      selector: action.selector,
      fieldName: action.label || action.name || action.id || 'unknown',
      required: true
    };

    switch (action.type) {
      case 'input':
        step.value = this.createTemplateVariable(action.value, action.label || action.name);
        step.inputType = action.inputType;
        break;

      case 'click':
        step.buttonText = action.text;
        break;

      case 'upload':
        step.value = '{{resumePath}}'; // Template for resume file
        step.fileName = action.fileName;
        break;
    }

    this.recordedSteps.push(step);

    logger.debug({ step }, 'Recorded step');
  }

  /**
   * Map browser event type to recipe action type
   */
  mapActionType(action) {
    switch (action.type) {
      case 'input':
        if (action.tagName === 'SELECT') return 'select';
        if (action.inputType === 'checkbox') return 'checkbox';
        if (action.inputType === 'radio') return 'radio';
        return 'type';

      case 'click':
        return 'click';

      case 'upload':
        return 'upload';

      default:
        return 'unknown';
    }
  }

  /**
   * Create template variable from field value
   */
  createTemplateVariable(value, fieldName) {
    if (!value) return '';

    // Email pattern
    if (value.includes('@')) {
      return '{{personalInfo.email}}';
    }

    // Phone pattern
    if (/^\+?[\d\s-()]+$/.test(value) && value.replace(/\D/g, '').length >= 10) {
      return '{{personalInfo.phone}}';
    }

    // Name patterns
    const lowerField = (fieldName || '').toLowerCase();
    if (lowerField.includes('first') && lowerField.includes('name')) {
      return '{{personalInfo.firstName}}';
    }
    if (lowerField.includes('last') && lowerField.includes('name')) {
      return '{{personalInfo.lastName}}';
    }
    if (lowerField.includes('full') && lowerField.includes('name')) {
      return '{{personalInfo.fullName}}';
    }

    // LinkedIn
    if (value.includes('linkedin.com')) {
      return '{{personalInfo.linkedIn}}';
    }

    // Portfolio/website
    if (value.startsWith('http') || value.includes('www.')) {
      return '{{personalInfo.website}}';
    }

    // City/location
    if (lowerField.includes('city') || lowerField.includes('location')) {
      return '{{personalInfo.city}}';
    }

    // Default: return as literal value (might need manual editing)
    return value;
  }

  /**
   * Stop recording and return the recipe
   */
  async stopRecording() {
    logger.info('⏹️  Stopping recording...');

    this.isRecording = false;

    // Clear polling interval
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }

    // Get final actions
    if (this.page) {
      try {
        const finalActions = await this.page.evaluate(() => {
          const actions = window.recordedActions || [];
          window.recordedActions = [];
          return actions;
        });

        for (const action of finalActions) {
          this.processAction(action);
        }
      } catch (error) {
        logger.debug({ error: error.message }, 'Error getting final actions');
      }
    }

    // Deduplicate steps (keep last occurrence)
    const uniqueSteps = this.deduplicateSteps(this.recordedSteps);

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }

    logger.info(`✅ Recording complete - ${uniqueSteps.length} steps captured`);

    return {
      steps: uniqueSteps,
      recordedAt: new Date(),
      totalSteps: this.recordedSteps.length,
      uniqueSteps: uniqueSteps.length
    };
  }

  /**
   * Deduplicate recorded steps
   */
  deduplicateSteps(steps) {
    const stepMap = new Map();

    // Keep last occurrence of each unique selector
    for (const step of steps) {
      const key = `${step.action}-${step.selector}`;
      stepMap.set(key, step);
    }

    return Array.from(stepMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Save recipe to database
   */
  async saveRecipe(platform, atsType, steps) {
    const { prisma } = await import('./prisma-client.js');

    const recipe = await prisma.applicationRecipe.upsert({
      where: { platform: platform.toLowerCase() },
      create: {
        platform: platform.toLowerCase(),
        atsType,
        steps,
        recordedBy: 'manual_recording',
        recordingCost: 0.0, // Manual recording is free!
        replayCost: 0.05,
        version: 1
      },
      update: {
        steps,
        version: { increment: 1 },
        updatedAt: new Date()
      }
    });

    logger.info({ recipeId: recipe.id, platform }, '💾 Recipe saved to database');

    return recipe;
  }
}

export default BrowserRecorder;
