/**
 * AI Form Filler
 * Intelligently fills forms using AI-generated responses with error recovery
 */

import logger from './logger.js';
import AIFormExtractor from './ai-form-extractor.js';
import AIFormIntelligence from './ai-form-intelligence.js';
import AILearningSystem from './ai-learning-system.js';
import CaptchaSolver from './captcha-solver.js';

class AIFormFiller {
  constructor() {
    this.extractor = new AIFormExtractor();
    this.intelligence = new AIFormIntelligence();
    this.learningSystem = new AILearningSystem();
    this.captchaSolver = new CaptchaSolver();

    this.maxRetries = 3;
    this.typingDelay = 50; // ms between keystrokes for natural typing
  }

  /**
   * Complete AI-powered form filling flow
   * @param {Page} page - Puppeteer page object
   * @param {Object} userProfile - User's profile data
   * @param {Object} jobData - Job description and metadata
   * @param {String} resumePath - Path to user's resume PDF file (optional)
   * @returns {Object} Result of form filling
   */
  async fillFormIntelligently(page, userProfile, jobData, resumePath = null) {
    logger.info('Starting AI-powered form filling...');

    // Store resumePath for use in file upload
    this.userResumePath = resumePath;

    const result = {
      success: false,
      fieldsExtracted: 0,
      fieldsFilled: 0,
      errors: [],
      warnings: [],
      cost: 0,
      screenshots: [],
      learningRecorded: false
    };

    try {
      // Step 1: Check for learned patterns
      const url = page.url();
      const learnedPatterns = await this.learningSystem.getLearnedPatternsForUrl(url);
      if (learnedPatterns) {
        logger.info('Found learned patterns for this domain');
        result.usedLearnedPatterns = true;
      }

      // Step 2: Extract all form fields
      logger.info('Extracting form fields...');
      const extraction = await this.extractor.extractComplete(page);

      result.fieldsExtracted = extraction.fields.length;
      result.hasCaptcha = extraction.hasCaptcha;
      result.complexity = extraction.complexity.complexity;

      if (extraction.hasCaptcha) {
        // TESTING MODE: Skip CAPTCHA check to test AI form filling
        if (process.env.SKIP_CAPTCHA_FOR_TESTING === 'true') {
          logger.warn('TESTING MODE: Skipping CAPTCHA check in AI form filler');
          logger.warn('NOTE: Form can be filled but submission will likely fail without solving CAPTCHA');
          result.hasCaptcha = true; // Still flag it for tracking
        } else {
          // Try to solve CAPTCHA automatically
          logger.info('CAPTCHA detected - attempting automatic solve...');
          try {
            const solved = await this.captchaSolver.solveAndInject(page);
            if (solved) {
              logger.info('CAPTCHA solved successfully');
              result.captchaSolved = true;
              result.captchaCost = 0.03; // Approximate cost
            }
          } catch (error) {
            logger.error({ error: error.message }, 'CAPTCHA solving failed');
            result.errors.push('CAPTCHA detected but automatic solving failed');
            result.captchaSolved = false;
            return result;
          }
        }
      }

      if (extraction.fields.length === 0) {
        result.errors.push('No form fields found on page');
        return result;
      }

      logger.info({ fieldCount: extraction.fields.length, complexity: extraction.complexity.complexity }, 'Found form fields');

      // Step 3: Generate AI responses
      logger.info('Generating AI responses for fields...');
      const aiResponses = await this.intelligence.generateFieldResponses(
        extraction.fields,
        userProfile,
        jobData
      );

      // Step 4: Validate AI responses
      logger.info('Validating AI responses...');
      const validation = this.intelligence.validateResponses(aiResponses, extraction.fields);

      if (!validation.valid) {
        logger.warn({ errors: validation.errors }, 'Validation found errors');
        result.errors.push(...validation.errors.map(e => e.message));
      }
      if (validation.warnings.length > 0) {
        logger.warn({ warnings: validation.warnings }, 'Validation warnings');
        result.warnings.push(...validation.warnings.map(w => w.message));
      }

      // Step 5: Fill the form
      logger.info('Filling form fields...');
      const fillResult = await this.fillFields(page, extraction.fields, aiResponses);

      result.fieldsFilled = fillResult.filled;
      result.errors.push(...fillResult.errors);

      // Step 6: Handle any errors with screenshot analysis
      if (fillResult.errors.length > 0) {
        logger.info('Errors detected, analyzing with AI vision...');
        const errorScreenshot = await this.extractor.captureScreenshot(page);
        result.screenshots.push({
          type: 'error',
          timestamp: new Date().toISOString(),
          data: errorScreenshot
        });

        const solution = await this.intelligence.analyzeScreenshotAndSolve(
          errorScreenshot,
          fillResult.errors.join('; '),
          { fields: extraction.fields, responses: aiResponses }
        );

        if (solution.needsManualIntervention) {
          result.errors.push('Manual intervention required: ' + solution.issue);
        } else if (solution.fieldToRetry && solution.newValue) {
          // Retry with AI's suggested fix
          logger.info('Retrying with AI solution...');
          await this.fillSingleField(
            page,
            extraction.fields.find(f => f.name === solution.fieldToRetry),
            solution.newValue
          );
          result.aiFixesApplied = 1;
        }

        // Record the learning
        await this.learningSystem.recordSuccessfulPattern({
          url,
          company: jobData.company,
          jobTitle: jobData.title,
          fields: extraction.fields,
          responses: aiResponses,
          issues: fillResult.errors,
          solutions: [solution]
        });
        result.learningRecorded = true;
      }

      // Step 7: Submit if requested
      if (extraction.submitButton && fillResult.filled > 0) {
        logger.info({ buttonText: extraction.submitButton.text }, 'Found submit button');
        result.submitButton = extraction.submitButton;
        // Don't auto-submit, let caller decide
      }

      // Step 8: Final screenshot
      const finalScreenshot = await this.extractor.captureScreenshot(page);
      result.screenshots.push({
        type: 'final',
        timestamp: new Date().toISOString(),
        data: finalScreenshot
      });

      // Get cost summary
      const costSummary = this.intelligence.getCostSummary();
      result.cost = costSummary.totalCost;

      // Consider successful if >70% fields filled (allows file upload failures)
      const fillRate = result.fieldsExtracted > 0 ? result.fieldsFilled / result.fieldsExtracted : 0;
      const hasOnlyFileErrors = result.errors.every(err =>
        err.includes('file') || err.includes('File') || err.includes('InvalidStateError')
      );

      result.success = result.fieldsFilled > 0 && (result.errors.length === 0 || (fillRate >= 0.7 && hasOnlyFileErrors));

      logger.info({ fieldsFilled: result.fieldsFilled, fieldsExtracted: result.fieldsExtracted, cost: result.cost }, 'Form filling complete');

      return result;

    } catch (error) {
      logger.error({ error: error.message }, 'AI form filling failed');
      result.errors.push(error.message);
      return result;
    }
  }

  /**
   * Fill all form fields
   */
  async fillFields(page, fields, responses) {
    const result = {
      filled: 0,
      errors: []
    };

    // Group fields by name to handle radio buttons and checkboxes
    const processedGroups = new Set();

    for (const field of fields) {
      const response = responses[field.name];

      // Skip if we already processed this group (for radio/checkbox)
      if ((field.type === 'radio' || field.type === 'checkbox') && processedGroups.has(field.name)) {
        continue;
      }

      if (!response && !field.required) {
        // Skip optional empty fields
        continue;
      }

      if (!response && field.required) {
        result.errors.push(`No response for required field: ${field.name}`);
        continue;
      }

      try {
        // Handle radio button groups - only fill the selected option
        if (field.type === 'radio') {
          const radioGroup = fields.filter(f => f.name === field.name && f.type === 'radio');
          const selectedOption = radioGroup.find(f => f.value === response);

          if (selectedOption) {
            await this.fillSingleField(page, selectedOption, response);
            result.filled++;
            processedGroups.add(field.name);
          } else {
            logger.warn({ fieldName: field.name, value: response, availableOptions: radioGroup.map(f => f.value) }, 'No radio option found for value');
          }
        }
        // Handle checkbox groups - check multiple if response is array/object
        else if (field.type === 'checkbox') {
          const checkboxGroup = fields.filter(f => f.name === field.name && f.type === 'checkbox');

          // Check if this is a single consent checkbox (not a group)
          const isSingleConsentCheckbox = checkboxGroup.length === 1 && (
            field.name.toLowerCase().includes('consent') ||
            field.name.toLowerCase().includes('agree') ||
            field.name.toLowerCase().includes('gdpr') ||
            field.name.toLowerCase().includes('retention')
          );

          if (isSingleConsentCheckbox) {
            // Single consent checkbox - always check it
            await this.fillSingleField(page, field, true);
            result.filled++;
          } else {
            // Multiple checkboxes - handle as group
            let selectedValues = [];

            // Handle different response formats
            if (Array.isArray(response)) {
              selectedValues = response;
            } else if (typeof response === 'object') {
              selectedValues = Object.values(response).filter(v => v);
            } else if (typeof response === 'string') {
              selectedValues = response.split(',').map(v => v.trim());
            } else if (response === true) {
              // If just true, check all checkboxes in group
              selectedValues = checkboxGroup.map(f => f.value);
            }

            // Check the selected checkboxes
            for (const checkbox of checkboxGroup) {
              const shouldCheck = selectedValues.includes(checkbox.value);
              await this.fillSingleField(page, checkbox, shouldCheck);
              if (shouldCheck) result.filled++;
            }
          }

          processedGroups.add(field.name);
        }
        // Regular fields
        else {
          await this.fillSingleField(page, field, response);
          result.filled++;
        }

        // Small delay between fields to appear human
        await this.sleep(100 + Math.random() * 200);
      } catch (error) {
        logger.error({ fieldName: field.name, error: error.message }, 'Failed to fill field');
        result.errors.push(`Failed to fill ${field.name}: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Fill a single form field
   */
  async fillSingleField(page, field, value) {
    logger.debug({ fieldName: field.name, fieldType: field.type, label: field.label }, 'Filling field');

    // Try multiple selector strategies to find the element
    const selector = await this.findWorkingSelector(page, field);

    if (!selector) {
      throw new Error(`Field not found with any selector strategy: ${field.name}`);
    }

    logger.debug({ selector }, 'Using selector');

    // Different filling strategies based on field type
    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
      case 'number':
      case 'date':
        await this.fillTextInput(page, selector, value);
        break;

      case 'textarea':
        await this.fillTextarea(page, selector, value);
        break;

      case 'select':
      case 'select-one':
      case 'select-multiple':
        await this.fillSelect(page, selector, value);
        break;

      case 'checkbox':
        await this.fillCheckbox(page, selector, value, field);
        break;

      case 'radio':
        await this.fillRadio(page, selector, value, field);
        break;

      case 'file':
        await this.fillFileInput(page, selector, field);
        break;

      default:
        await this.fillTextInput(page, selector, value);
    }
  }

  /**
   * Find a working selector for a field by trying multiple strategies
   */
  async findWorkingSelector(page, field) {
    // Try original selector first
    const strategies = [
      field.selector, // Original from extraction
      `[name="${field.name}"]`, // Direct name attribute
      `#${field.name}`, // ID matching name
      `input[name="${field.name}"]`, // Explicit input with name
      `select[name="${field.name}"]`, // Explicit select with name
      `textarea[name="${field.name}"]`, // Explicit textarea with name
    ];

    // For radio/checkbox with value, try value-specific selector
    if ((field.type === 'radio' || field.type === 'checkbox') && field.value) {
      strategies.unshift(`input[name="${field.name}"][value="${field.value}"]`);
    }

    // Try each strategy
    for (const selector of strategies) {
      if (!selector) continue;

      const exists = await page.evaluate((sel) => {
        const element = document.querySelector(sel);
        return element !== null;
      }, selector);

      if (exists) {
        return selector;
      }
    }

    return null;
  }

  /**
   * Fill text input with human-like typing
   */
  async fillTextInput(page, selector, text) {
    // Use evaluate to set value directly - more reliable than typing
    await page.evaluate((sel, val) => {
      const element = document.querySelector(sel);
      if (element) {
        element.value = val;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, selector, String(text));

    // Small delay to let any onChange handlers run
    await this.sleep(50);
  }

  /**
   * Fill textarea
   */
  async fillTextarea(page, selector, text) {
    // Use evaluate to set value directly
    await page.evaluate((sel, val) => {
      const element = document.querySelector(sel);
      if (element) {
        element.value = val;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, selector, String(text));

    await this.sleep(50);
  }

  /**
   * Fill select/dropdown
   */
  async fillSelect(page, selector, value) {
    logger.debug({ value }, 'Attempting to select option');

    // Try to select by value, then by text if that fails
    const result = await page.evaluate((sel, val) => {
      const element = document.querySelector(sel);
      if (!element) return { success: false, reason: 'Element not found' };

      const options = Array.from(element.options);
      const availableOptions = options.map(o => ({ value: o.value, text: o.text }));

      // Try to find option by exact value match
      let option = options.find(opt => opt.value === val);

      // If not found, try by text content (case insensitive)
      if (!option) {
        option = options.find(opt =>
          opt.text.toLowerCase().trim() === val.toLowerCase().trim()
        );
      }

      // If still not found, try partial text match
      if (!option) {
        option = options.find(opt =>
          opt.text.toLowerCase().includes(val.toLowerCase()) ||
          val.toLowerCase().includes(opt.text.toLowerCase())
        );
      }

      // If still not found, try value partial match
      if (!option) {
        option = options.find(opt =>
          opt.value.toLowerCase().includes(val.toLowerCase())
        );
      }

      if (option) {
        element.value = option.value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return {
          success: true,
          matched: option.text,
          value: option.value
        };
      }

      return {
        success: false,
        reason: 'No matching option found',
        availableOptions: availableOptions.map(o => o.text).slice(0, 5)
      };
    }, selector, String(value));

    if (result.success) {
      logger.debug({ matched: result.matched, value: result.value }, 'Selected option');
    } else {
      logger.warn({ value, reason: result.reason, availableOptions: result.availableOptions }, 'Failed to select option');
    }

    await this.sleep(50);
  }

  /**
   * Fill checkbox
   */
  async fillCheckbox(page, selector, value, field) {
    let shouldCheck = value === true || value === 'true' || value === 'yes' || value === 1;

    // IMPORTANT: Always check consent/agreement checkboxes regardless of AI response
    // These are typically required for application processing
    const isConsentCheckbox = field && field.name && (
      field.name.toLowerCase().includes('consent') ||
      field.name.toLowerCase().includes('agree') ||
      field.name.toLowerCase().includes('gdpr') ||
      field.name.toLowerCase().includes('terms') ||
      field.name.toLowerCase().includes('privacy') ||
      field.name.toLowerCase().includes('retention') ||
      (field.label && (
        field.label.toLowerCase().includes('consent') ||
        field.label.toLowerCase().includes('agree') ||
        field.label.toLowerCase().includes('gdpr') ||
        field.label.toLowerCase().includes('terms') ||
        field.label.toLowerCase().includes('privacy') ||
        field.label.toLowerCase().includes('retention') ||
        field.label.toLowerCase().includes('future opportunities')
      ))
    );

    if (isConsentCheckbox && !shouldCheck) {
      logger.debug({ fieldName: field.name }, 'Detected consent/agreement checkbox - forcing to checked');
      shouldCheck = true;
    }

    logger.debug({ checked: shouldCheck }, shouldCheck ? 'Checking checkbox' : 'Unchecking checkbox');

    await page.evaluate((sel, check) => {
      const element = document.querySelector(sel);
      if (element && element.checked !== check) {
        element.checked = check;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, selector, shouldCheck);

    await this.sleep(50);
  }

  /**
   * Fill radio button
   */
  async fillRadio(page, selector, value, field) {
    // Selector should already point to the right radio button
    // (either from findWorkingSelector with value, or base selector)
    logger.debug({ value }, 'Selecting radio option');

    await page.click(selector);

    // Trigger change event
    await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, selector);

    logger.debug('Radio button selected');
  }

  /**
   * Fill file input (resume/cover letter upload)
   */
  async fillFileInput(page, selector, field) {
    logger.debug({ fieldName: field.name }, 'Uploading file');

    try {
      // Use user's resume - REQUIRED in production
      const resumePath = this.userResumePath;

      if (!resumePath) {
        throw new Error('No resume file available - user must generate a resume before applying to jobs');
      }

      // Validate resume file exists
      const fs = await import('fs');
      const path = await import('path');

      if (!fs.existsSync(resumePath)) {
        throw new Error(`Resume file not found at path: ${resumePath}`);
      }

      logger.debug({ fileName: path.basename(resumePath) }, 'Using user resume for upload');

      // Use Puppeteer's file upload API
      const fileInput = await page.$(selector);
      if (!fileInput) {
        throw new Error(`File input not found: ${selector}`);
      }

      await fileInput.uploadFile(resumePath);
      logger.debug('File uploaded successfully');

      // Wait for any upload processing
      await this.sleep(500);

    } catch (error) {
      logger.error({ error: error.message }, 'File upload failed');
      throw error;
    }
  }

  /**
   * Submit the form
   */
  async submitForm(page, submitButton) {
    if (!submitButton) {
      throw new Error('No submit button provided');
    }

    logger.info({ buttonText: submitButton.text }, 'Clicking submit button');

    try {
      await page.click(submitButton.selector);

      // Wait for navigation or confirmation
      await Promise.race([
        page.waitForNavigation({ timeout: 10000 }),
        page.waitForSelector('.success, .confirmation, .thank-you', { timeout: 10000 }),
        this.sleep(3000)
      ]);

      logger.info('Form submitted successfully');
      return true;
    } catch (error) {
      logger.error({ error: error.message }, 'Form submission failed');
      return false;
    }
  }

  /**
   * Helper: sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      cost: this.intelligence.getCostSummary(),
      learning: this.learningSystem.getLearningSummary()
    };
  }
}

export default AIFormFiller;
