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

      // Step 2.5: Check if we're on a job description page instead of application form
      // If we have very few fields (1-3), likely need to click "Apply" button first
      if (extraction.fields.length <= 3) {
        logger.warn({ fieldCount: extraction.fields.length }, '⚠️  Very few fields found - checking for Apply button');

        const applyButton = await this.findAndClickApplyButton(page);
        if (applyButton.clicked) {
          logger.info({ buttonText: applyButton.text }, '✅ Clicked Apply button - waiting for application form');

          // Wait for navigation or modal to load
          await this.sleep(3000);

          // Re-extract form fields from the actual application page
          logger.info('Re-extracting form fields from application page...');
          const newExtraction = await this.extractor.extractComplete(page);

          if (newExtraction.fields.length > extraction.fields.length) {
            logger.info({
              oldCount: extraction.fields.length,
              newCount: newExtraction.fields.length
            }, '✅ Found more fields after clicking Apply button');

            // Update extraction with new data
            extraction.fields = newExtraction.fields;
            extraction.submitButton = newExtraction.submitButton;
            extraction.hasCaptcha = newExtraction.hasCaptcha;
            extraction.complexity = newExtraction.complexity;

            result.fieldsExtracted = newExtraction.fields.length;
            result.hasCaptcha = newExtraction.hasCaptcha;
            result.complexity = newExtraction.complexity.complexity;
          } else {
            logger.warn('No additional fields found after clicking Apply button');
          }
        } else {
          logger.info('No Apply button found - proceeding with current page');
        }
      }

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
              logger.info('CAPTCHA solved - verifying solution was injected...');

              // Wait a bit for CAPTCHA solution to be processed
              await this.sleep(2000);

              // Verify CAPTCHA solution is actually in the page
              const captchaVerified = await page.evaluate(() => {
                const recaptchaResponse = document.querySelector('#g-recaptcha-response');
                const hcaptchaResponse = document.querySelector('textarea[name="h-captcha-response"]');

                if (recaptchaResponse && recaptchaResponse.value) {
                  return { verified: true, type: 'reCAPTCHA', hasValue: true };
                }
                if (hcaptchaResponse && hcaptchaResponse.value) {
                  return { verified: true, type: 'hCaptcha', hasValue: true };
                }

                return { verified: false, type: 'unknown', hasValue: false };
              });

              if (captchaVerified.verified) {
                logger.info({ captchaType: captchaVerified.type }, 'CAPTCHA solution verified in page');
                result.captchaSolved = true;
                result.captchaCost = 0.03; // Approximate cost
              } else {
                logger.error('CAPTCHA solution was not properly injected into page');
                result.errors.push('CAPTCHA solving completed but solution not found in page');
                result.captchaSolved = false;
                return result;
              }
            } else {
              logger.warn('No CAPTCHA found by solver (may have been detected incorrectly)');
              result.captchaSolved = false;
            }
          } catch (error) {
            logger.error({ error: error.message, stack: error.stack }, 'CAPTCHA solving failed');
            result.errors.push(`CAPTCHA detected but automatic solving failed: ${error.message}`);
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
        // Optional auto-submit (useful for testing)
        if (process.env.AUTO_SUBMIT_FOR_TESTING === 'true') {
          logger.warn('TESTING MODE: AUTO_SUBMIT_FOR_TESTING enabled - attempting auto-submit');
          const submitRes = await this.submitForm(page, extraction.submitButton, userProfile);
          result.autoSubmitted = true;
          result.submitResult = submitRes;
          if (!submitRes.success) {
            result.errors.push('Auto-submit failed: ' + (submitRes.error || 'unknown'));
          }
        }
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

    // Check if this is a custom dropdown (text input styled to look like a dropdown)
    // These are common in Greenhouse, Lever, and other ATS systems
    const isCustomDropdown = await page.evaluate(({sel, fieldData}) => {
      const element = document.querySelector(sel);
      if (!element || element.tagName !== 'INPUT') return false;

      // Check multiple indicators that this is a styled dropdown:
      const parent = element.parentElement;
      const grandparent = parent?.parentElement;

      // 1. Has arrow icon (SVG or icon element)
      const hasArrowIcon =
        parent?.querySelector('svg[class*="arrow"], svg[class*="chevron"], svg[class*="caret"]') ||
        parent?.querySelector('[class*="dropdown-arrow"], [class*="select-arrow"]') ||
        grandparent?.querySelector('svg[class*="arrow"], svg[class*="chevron"], svg[class*="caret"]');

      // 2. Has dropdown/select related classes
      const hasDropdownClass =
        element.className.includes('select') ||
        element.className.includes('dropdown') ||
        parent?.className.includes('select') ||
        parent?.className.includes('dropdown') ||
        grandparent?.className.includes('select') ||
        grandparent?.className.includes('dropdown');

      // 3. Has "Select..." placeholder or value
      const hasSelectPlaceholder =
        element.placeholder?.includes('Select') ||
        element.value?.includes('Select') ||
        fieldData.value?.includes('Select') ||
        fieldData.placeholder?.includes('Select');

      // 4. Has readonly attribute (common for styled dropdowns)
      const isReadonly = element.hasAttribute('readonly') || element.readOnly;

      // 5. Parent has specific dropdown wrapper classes
      const hasDropdownWrapper =
        parent?.className.includes('dropdown-wrapper') ||
        parent?.className.includes('select-wrapper') ||
        grandparent?.className.includes('dropdown-wrapper');

      return (hasArrowIcon || hasDropdownClass || hasSelectPlaceholder ||
              (isReadonly && hasDropdownWrapper));
    }, {sel: selector, fieldData: field});

    if (isCustomDropdown) {
      logger.info({
        field: field.name,
        label: field.label,
        value: field.value,
        placeholder: field.placeholder
      }, '🔽 Detected custom dropdown (text input styled as dropdown)');
      await this.fillCustomDropdownWithMouse(page, selector, value, field);
      return;
    }

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
        // Always use native select method for <select> elements
        // Playwright's selectOption() works great for Greenhouse/Lever native selects
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
    // Use Playwright's native fill method - properly triggers React/Vue change detection
    try {
      // Clear existing value first
      await page.fill(selector, '');
      // Fill with new value
      await page.fill(selector, String(text));
      // Small delay to let any onChange handlers run
      await this.sleep(50);
    } catch (error) {
      // Fallback to evaluate if fill fails
      logger.warn({ selector, error: error.message }, 'Native fill failed, using fallback');
      await page.evaluate(({sel, val}) => {
        const element = document.querySelector(sel);
        if (element) {
          element.value = val;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      }, {sel: selector, val: String(text)});
      await this.sleep(50);
    }
  }

  /**
   * Fill textarea
   */
  async fillTextarea(page, selector, text) {
    // Use Playwright's native fill method
    try {
      await page.fill(selector, '');
      await page.fill(selector, String(text));
      await this.sleep(50);
    } catch (error) {
      logger.warn({ selector, error: error.message }, 'Native fill failed, using fallback');
      await page.evaluate(({sel, val}) => {
        const element = document.querySelector(sel);
        if (element) {
          element.value = val;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      }, {sel: selector, val: String(text)});
      await this.sleep(50);
    }
  }

  /**
   * Fill custom dropdown (Greenhouse, Lever, modern job boards)
   * These use React-select style components - uses type + keyboard method
   * Based on Playwright best practices for react-select
   */
  async fillCustomDropdown(page, selector, value, field) {
    logger.debug({ value, fieldName: field.name }, 'Filling custom dropdown (react-select style)');

    try {
      // Method 1: Type to search + Tab/Enter (works for most Greenhouse/Lever dropdowns)
      try {
        logger.debug({ selector }, 'Attempting dropdown via type + keyboard method');

        // Click the dropdown to open it
        await page.click(selector, { timeout: 5000 });
        await this.sleep(200);

        // Type the value (react-select has built-in search/filter)
        await page.fill(selector, String(value));
        await this.sleep(300); // Wait for options to filter

        // Press Tab or Enter to select the first matching option
        await page.keyboard.press('Enter');
        await this.sleep(200);

        logger.debug({ value }, 'Custom dropdown filled via type+Enter method');
        return { success: true, matched: value, value: value };

      } catch (typeError) {
        logger.warn({ error: typeError.message }, 'Type+keyboard method failed, trying click method');
      }

      // Method 2: Click dropdown, wait for options, click specific option
      logger.debug('Attempting dropdown via click + wait + click option method');

      // Click to open
      await page.click(selector, { timeout: 5000 });
      await this.sleep(300);

      // Try to find option by text using different selectors
      const optionSelectors = [
        `div[role="option"]:has-text("${value}")`,
        `li:has-text("${value}")`,
        `[data-option]:has-text("${value}")`,
        `div[role="listbox"] div:has-text("${value}")`
      ];

      for (const optionSelector of optionSelectors) {
        try {
          await page.click(optionSelector, { timeout: 2000 });
          logger.debug({ value, optionSelector }, 'Custom dropdown option clicked');
          await this.sleep(200);
          return { success: true, matched: value, value: value };
        } catch (e) {
          // Try next selector
        }
      }

      // Method 3: Keyboard navigation fallback
      logger.debug('Attempting dropdown via keyboard navigation');
      await page.click(selector);
      await this.sleep(200);

      // Type a few characters to filter, then use arrow down + enter
      const searchTerm = String(value).substring(0, 3);
      await page.keyboard.type(searchTerm);
      await this.sleep(200);
      await page.keyboard.press('ArrowDown');
      await this.sleep(100);
      await page.keyboard.press('Enter');
      await this.sleep(200);

      logger.debug({ value }, 'Custom dropdown filled via keyboard navigation');
      return { success: true, matched: value, value: value };

    } catch (error) {
      logger.error({ selector, value, error: error.message }, 'All custom dropdown methods failed');
      throw new Error(`Failed to select dropdown option "${value}": ${error.message}`);
    }
  }

  /**
   * Fill custom dropdown using mouse interactions (for Greenhouse-style dropdowns)
   * These are text inputs styled to look like dropdowns
   */
  async fillCustomDropdownWithMouse(page, selector, value, field) {
    logger.info({ selector, value, field: field.name }, '🖱️  Filling custom dropdown with mouse clicks');

    try {
      // STEP 1: Get the dropdown element's bounding box
      // Use .first() to handle cases where selector matches multiple elements
      let locator = page.locator(selector);

      // Check if selector matches multiple elements
      const count = await locator.count();
      if (count > 1) {
        logger.warn({ selector, count }, 'Selector matches multiple elements, using .first()');
        locator = locator.first();
      }

      const boundingBox = await locator.boundingBox();
      if (!boundingBox) {
        throw new Error(`Dropdown element not found or not visible: ${selector}`);
      }

      logger.info({
        x: boundingBox.x,
        y: boundingBox.y,
        width: boundingBox.width,
        height: boundingBox.height
      }, '📍 Got dropdown bounding box');

      // STEP 2: Click on the dropdown with mouse (click near the arrow on the right side)
      const clickX = boundingBox.x + boundingBox.width - 15; // Click on the arrow
      const clickY = boundingBox.y + boundingBox.height / 2; // Center vertically

      logger.info({ clickX, clickY }, '👆 Clicking dropdown arrow with mouse');
      await page.mouse.click(clickX, clickY);
      await this.sleep(500); // Wait for dropdown menu to appear

      // STEP 3: Look for dropdown menu options
      // Greenhouse typically shows options in a div/list that appears below the input
      const optionsAppeared = await page.evaluate(() => {
        // Look for common dropdown menu selectors
        const dropdownMenus = document.querySelectorAll('[role="listbox"], [role="menu"], ul[class*="dropdown"], div[class*="options"]');
        return dropdownMenus.length > 0;
      });

      logger.info({ optionsAppeared }, 'Dropdown menu status');

      // STEP 4: Enumerate visible options for robust matching
      const options = await page.evaluate(() => {
        const texts = new Set();
        const menus = document.querySelectorAll('[role="listbox"], [role="menu"], ul[class*="dropdown"], div[class*="menu"], div[class*="options"], div[class*="option-list"]');
        for (const menu of menus) {
          const children = menu.querySelectorAll('[role="option"], li, div[class*="option"], div[class*="item"], span[class*="option"]');
          for (const el of children) {
            if (el.offsetParent === null) continue;
            const t = (el.textContent || '').trim();
            if (!t) continue;
            texts.add(t);
          }
        }
        return Array.from(texts);
      });

      logger.info({ count: options.length, options }, '📋 Custom dropdown options enumerated');

      // FALLBACK: If no options found, treat as text input
      if (options.length === 0) {
        logger.warn({ field: field.name, value }, '⚠️  No dropdown options - treating as text input');
        await page.mouse.click(10, 10); // Close any menu
        await this.sleep(200);
        await locator.clear();
        await this.sleep(100);
        await locator.fill(String(value));
        await this.sleep(200);
        logger.info({ field: field.name, value }, '✅ Filled as text input');
        return;
      }

      // STEP 5: Choose a target option using fuzzy matching
      const aiRaw = value == null ? '' : String(value);
      const aiValue = aiRaw.toLowerCase().trim();

      const pickBestOption = (needle, opts) => {
        if (!opts || opts.length === 0) return null;
        // exact match
        let best = null;
        let bestScore = -1;
        const norm = s => s.toLowerCase().trim();
        const score = (a, b) => {
          if (!a || !b) return 0;
          if (a === b) return 1.0;
          if (a.includes(b) || b.includes(a)) return 0.9;
          const aw = a.split(/\s+/);
          const bw = b.split(/\s+/);
          const setA = new Set(aw);
          let overlap = 0;
          for (const w of bw) if (setA.has(w)) overlap++;
          return overlap / Math.max(1, Math.max(aw.length, bw.length));
        };
        for (const opt of opts) {
          const s = score(norm(opt), needle);
          if (s > bestScore) {
            bestScore = s;
            best = opt;
          }
        }
        return { option: best, score: bestScore };
      };

      let chosen = null;
      let chosenScore = -1;
      if (aiValue) {
        const picked = pickBestOption(aiValue, options.map(o => o));
        if (picked && picked.option) {
          chosen = picked.option;
          chosenScore = picked.score;
        }
      }

      // If AI didn't provide a usable value or match is weak, pick first non-placeholder
      if (!chosen || chosenScore < 0.5) {
        const firstNonPlaceholder = options.find(o => !/^select/i.test(o) && !/^choose/i.test(o) && o.trim().length > 0);
        if (firstNonPlaceholder) {
          logger.warn({ aiValue, chosen, chosenScore, fallback: firstNonPlaceholder }, 'Using fallback option for custom dropdown');
          chosen = firstNonPlaceholder;
        }
      }

      if (!chosen) {
        const errMsg = `No options available to select for custom dropdown. AI provided: "${aiRaw}"`;
        logger.error({ field: field.name, options }, errMsg);
        throw new Error(errMsg);
      }

      // STEP 6: Click the chosen option using robust selectors
      const optionClicked = await page.evaluate(({ target }) => {
        const menus = document.querySelectorAll('[role="listbox"], [role="menu"], ul, div[class*="option"], div[class*="dropdown"]');
        const needle = (target || '').toLowerCase().trim();

        for (const menu of menus) {
          const options = menu.querySelectorAll('[role="option"], li, div[class*="option"]');

          for (const option of options) {
            const optTextLower = option.textContent?.toLowerCase().trim() || '';

            // Try various matching strategies
            if (optTextLower === needle ||
                optTextLower.includes(needle) ||
                needle.includes(optTextLower)) {

              option.click();
              return { success: true, matched: option.textContent?.trim(), clicked: true };
            }
          }
        }

        // Second pass: match by exact trimmed text
        for (const menu of menus) {
          const options = menu.querySelectorAll('[role="option"], li, div[class*="option"]');
          for (const option of options) {
            if ((option.textContent || '').trim() === target) {
              option.click();
              return { success: true, matched: option.textContent?.trim(), clicked: true };
            }
          }
        }

        return { success: false, reason: 'No matching option found' };
      }, { target: chosen });

      if (optionClicked.success) {
        logger.info({ matched: optionClicked.matched }, '✅ Successfully clicked dropdown option');
        await this.sleep(200);
        return;
      }

      // STEP 7: Fallback - try keyboard navigation with option clicking
      logger.warn('Could not click option, trying keyboard fallback');

      // Focus the input element directly to ensure we're typing in the right place
      await locator.focus();
      await this.sleep(200);

      // Clear any existing value first
      await locator.fill('');
      await this.sleep(100);

      // Type the value to filter options (type a few characters to narrow down)
      const searchTerm = String(value).substring(0, 15);
      await locator.fill(searchTerm);
      await this.sleep(800); // Give more time for dropdown menu to appear with filtered options

      // Now try to click on the first visible option in the dropdown menu
      const optionClickedFromMenu = await page.evaluate(({ val }) => {
        // Look for dropdown menu options that appeared
        const menus = document.querySelectorAll('[role="listbox"], [role="menu"], ul[class*="dropdown"], div[class*="menu"], div[class*="options"]');

        for (const menu of menus) {
          // Check if menu is visible
          if (menu.offsetParent === null) continue;

          const options = menu.querySelectorAll('[role="option"], li, div[class*="option"]');

          for (const option of options) {
            // Only click visible options
            if (option.offsetParent === null) continue;

            const text = option.textContent?.toLowerCase().trim() || '';

            // Click first visible option that matches our search
            if (text.includes(val.toLowerCase()) || val.toLowerCase().includes(text)) {
              option.click();
              return { success: true, matched: option.textContent?.trim() };
            }
          }

          // If no match found, just click the first visible option
          const firstVisible = Array.from(options).find(opt => opt.offsetParent !== null);
          if (firstVisible) {
            firstVisible.click();
            return { success: true, matched: firstVisible.textContent?.trim() };
          }
        }

        return { success: false };
      }, { val: searchTerm });

      if (optionClickedFromMenu.success) {
        logger.info({ matched: optionClickedFromMenu.matched }, '✅ Selected option from dropdown menu via keyboard fallback');
      } else {
        // Last resort: press Enter
        await page.keyboard.press('Enter');
        await this.sleep(200);
        logger.info('✅ Selected option via Enter key');
        // If still uncertain, log options for debugging
        logger.warn({ field: field.name, aiValue: aiRaw, options }, 'Dropdown selection may be ambiguous');
      }

    } catch (error) {
      logger.error({ selector, value, error: error.message }, '❌ Failed to fill custom dropdown with mouse');
      throw new Error(`Failed to fill custom dropdown "${field.name}": ${error.message}`);
    }
  }

  /**
   * Fill select/dropdown with Playwright-enhanced support
   */
  async fillSelect(page, selector, value) {
    logger.info({ selector, value }, '🔽 Attempting to select dropdown option');

    try {
      // STEP 1: Get dropdown element bounding box for mouse click
      const boundingBox = await page.locator(selector).boundingBox();
      if (!boundingBox) {
        throw new Error(`Dropdown element not found or not visible: ${selector}`);
      }

      logger.info({
        x: boundingBox.x,
        y: boundingBox.y,
        width: boundingBox.width,
        height: boundingBox.height
      }, '📍 Got dropdown position');

      // STEP 2: Use mouse to click on the dropdown (click on the right side where arrow usually is)
      const clickX = boundingBox.x + boundingBox.width - 20; // Click near the arrow
      const clickY = boundingBox.y + boundingBox.height / 2; // Click in the middle vertically

      logger.info({ clickX, clickY }, '🖱️  Clicking dropdown with mouse');
      await page.mouse.click(clickX, clickY);
      await this.sleep(300); // Wait for dropdown to open
      logger.info('✅ Dropdown clicked with mouse');

      // STEP 3: Get all available options to find the best match
      const optionsInfo = await page.evaluate(({sel}) => {
        const element = document.querySelector(sel);
        if (!element) return { success: false, reason: 'Element not found' };

        const options = Array.from(element.options);
        return {
          success: true,
          options: options.map(o => ({ value: o.value, text: o.text, index: o.index }))
        };
      }, {sel: selector});

      if (!optionsInfo.success) {
        throw new Error('Dropdown element not found');
      }

      logger.info({
        availableOptions: optionsInfo.options.length,
        options: optionsInfo.options.map(o => o.text)
      }, '📋 Found dropdown options');

      // STEP 3: Find the best matching option using fuzzy matching
      const aiValue = String(value).toLowerCase().trim();
      let bestMatch = null;
      let matchType = null;

      // Try exact value match first
      bestMatch = optionsInfo.options.find(opt => opt.value.toLowerCase() === aiValue);
      if (bestMatch) matchType = 'exact-value';

      // Try exact text match
      if (!bestMatch) {
        bestMatch = optionsInfo.options.find(opt => opt.text.toLowerCase().trim() === aiValue);
        if (bestMatch) matchType = 'exact-text';
      }

      // Try partial text match (AI value contained in option text)
      if (!bestMatch) {
        bestMatch = optionsInfo.options.find(opt =>
          opt.text.toLowerCase().includes(aiValue)
        );
        if (bestMatch) matchType = 'partial-text-contains';
      }

      // Try reverse partial match (option text contained in AI value)
      if (!bestMatch) {
        bestMatch = optionsInfo.options.find(opt =>
          aiValue.includes(opt.text.toLowerCase())
        );
        if (bestMatch) matchType = 'partial-ai-contains';
      }

      // Try word matching (any word in AI value matches option)
      if (!bestMatch) {
        const aiWords = aiValue.split(/\s+/).filter(w => w.length > 2);
        bestMatch = optionsInfo.options.find(opt => {
          const optText = opt.text.toLowerCase();
          return aiWords.some(word => optText.includes(word));
        });
        if (bestMatch) matchType = 'word-match';
      }

      if (!bestMatch) {
        const errorMsg = `Failed to select dropdown option. AI provided: "${value}" but available options are: ${optionsInfo.options.map(o => `"${o.text}" (value: ${o.value})`).join(', ')}`;
        logger.error({ value, availableOptions: optionsInfo.options }, errorMsg);
        throw new Error(errorMsg);
      }

      logger.info({
        aiValue: value,
        matched: bestMatch.text,
        matchType,
        matchedValue: bestMatch.value
      }, '✅ Found matching option');

      // STEP 4: Select the option using Playwright's selectOption
      const isPlaywright = typeof page.selectOption === 'function';

      if (isPlaywright) {
        // Use the option's value for selection (most reliable)
        logger.info({ value: bestMatch.value, text: bestMatch.text }, '🎯 Selecting option with Playwright selectOption');
        await page.selectOption(selector, bestMatch.value, { timeout: 5000 });
        logger.info({ selected: bestMatch.text }, '✅ Selected option using Playwright selectOption');
      } else {
        // Puppeteer fallback
        logger.info({ value: bestMatch.value }, '🎯 Selecting option with Puppeteer select');
        await page.select(selector, bestMatch.value);
        logger.info({ selected: bestMatch.text }, '✅ Selected option using Puppeteer select');
      }

      // STEP 5: Verify the selection worked
      logger.info('🔍 Verifying selection...');
      const selectedValue = await page.evaluate(({sel}) => {
        const element = document.querySelector(sel);
        return element ? element.value : null;
      }, {sel: selector});

      logger.info({ expected: bestMatch.value, actual: selectedValue }, 'Selection verification result');

      if (selectedValue !== bestMatch.value) {
        logger.warn({
          expected: bestMatch.value,
          actual: selectedValue
        }, '⚠️ Selection verification failed - value mismatch, trying fallback');

        // Try fallback method: direct DOM manipulation
        await page.evaluate(({sel, val}) => {
          const element = document.querySelector(sel);
          if (element) {
            element.value = val;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
          }
        }, {sel: selector, val: bestMatch.value});

        logger.debug('Used fallback DOM manipulation to set value');
      }

      await this.sleep(100);

    } catch (error) {
      logger.error({ selector, value, error: error.message }, 'Failed to fill select dropdown');
      throw error;
    }
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

    // Use Playwright's native check/uncheck methods
    try {
      if (shouldCheck) {
        await page.check(selector);
      } else {
        await page.uncheck(selector);
      }
      await this.sleep(50);
    } catch (error) {
      logger.warn({ selector, error: error.message }, 'Native check/uncheck failed, using fallback');
      await page.evaluate(({sel, check}) => {
        const element = document.querySelector(sel);
        if (element && element.checked !== check) {
          element.checked = check;
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, {sel: selector, check: shouldCheck});
      await this.sleep(50);
    }
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

      // Detect if using Playwright (has setInputFiles method) or Puppeteer
      const isPlaywright = typeof page.setInputFiles === 'function';

      if (isPlaywright) {
        // Use Playwright's setInputFiles API
        logger.debug('Using Playwright setInputFiles');
        await page.setInputFiles(selector, resumePath);
        logger.debug('File uploaded successfully (Playwright)');
      } else {
        // Use Puppeteer's uploadFile API
        logger.debug('Using Puppeteer uploadFile');
        const fileInput = await page.$(selector);
        if (!fileInput) {
          throw new Error(`File input not found: ${selector}`);
        }
        await fileInput.uploadFile(resumePath);
        logger.debug('File uploaded successfully (Puppeteer)');
      }

      // Wait for any upload processing
      await this.sleep(500);

    } catch (error) {
      logger.error({ error: error.message }, 'File upload failed');
      throw error;
    }
  }

  /**
   * Verify filled data matches user profile (sanity check)
   */
  async verifyFilledData(page, userProfile) {
    logger.info('🔍 Verifying filled data matches user profile...');

    const filledData = await page.evaluate(() => {
      const data = {};

      // Extract common field values
      const nameField = document.querySelector('input[name*="name" i]:not([name*="last" i]):not([name*="first" i])') ||
                       document.querySelector('input[name*="full" i]');
      const firstNameField = document.querySelector('input[name*="first" i]');
      const lastNameField = document.querySelector('input[name*="last" i]');
      const emailField = document.querySelector('input[type="email"], input[name*="email" i]');
      const phoneField = document.querySelector('input[type="tel"], input[name*="phone" i]');

      if (nameField) data.fullName = nameField.value;
      if (firstNameField) data.firstName = firstNameField.value;
      if (lastNameField) data.lastName = lastNameField.value;
      if (emailField) data.email = emailField.value;
      if (phoneField) data.phone = phoneField.value;

      return data;
    });

    // Log what was actually filled
    logger.info({
      filled: filledData,
      expected: {
        email: userProfile.email,
        phone: userProfile.phone,
        name: userProfile.fullName
      }
    }, '📋 Form data verification');

    // Verify critical fields match
    const warnings = [];

    if (filledData.email && filledData.email !== userProfile.email) {
      warnings.push(`Email mismatch: filled="${filledData.email}" vs expected="${userProfile.email}"`);
    }
    if (filledData.phone && !filledData.phone.includes(userProfile.phone?.replace(/\D/g, '').slice(-4))) {
      warnings.push(`Phone may not match: filled="${filledData.phone}"`);
    }

    if (warnings.length > 0) {
      logger.warn({ warnings }, '⚠️  Data verification warnings detected');
    } else {
      logger.info('✅ Core user data verified correctly filled');
    }

    return {
      verified: warnings.length === 0,
      warnings: warnings,
      filledData: filledData
    };
  }

  /**
   * Verify form is ready for submission (no validation errors, CAPTCHA solved)
   */
  async verifyFormReadyForSubmission(page) {
    logger.info('Verifying form is ready for submission...');

    const issues = [];

    // Check for validation errors on the page
    const validationErrors = await page.evaluate(() => {
      const errors = [];

      // Check for common error messages
      const errorSelectors = [
        '.error', '.field-error', '.form-error', '.validation-error',
        '[class*="error"]', '[class*="invalid"]',
        '.text-red-500', '.text-danger'
      ];

      for (const selector of errorSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (el.offsetParent !== null && el.textContent.trim()) {
            errors.push(el.textContent.trim());
          }
        }
      }

      // Check for invalid/required fields
      const invalidFields = document.querySelectorAll('input:invalid, select:invalid, textarea:invalid');
      const requiredEmptyInputs = document.querySelectorAll('input[required]:not([value])');
      const requiredEmptyTextareas = document.querySelectorAll('textarea[required]:empty');

      // Check for empty required dropdowns specifically (common issue)
      const requiredEmptySelects = Array.from(document.querySelectorAll('select[required]')).filter(select => {
        return !select.value || select.value === '' || select.selectedIndex === 0 && select.options[0].value === '';
      });

      if (invalidFields.length > 0) {
        errors.push(`${invalidFields.length} invalid field(s) detected`);
      }
      if (requiredEmptyInputs.length > 0) {
        errors.push(`${requiredEmptyInputs.length} required input(s) empty`);
      }
      if (requiredEmptyTextareas.length > 0) {
        errors.push(`${requiredEmptyTextareas.length} required textarea(s) empty`);
      }
      if (requiredEmptySelects.length > 0) {
        const selectNames = requiredEmptySelects.map(s => s.name || s.id || 'unknown').join(', ');
        errors.push(`${requiredEmptySelects.length} required dropdown(s) not selected: ${selectNames}`);
      }

      return errors;
    });

    if (validationErrors.length > 0) {
      issues.push(...validationErrors);
      logger.warn({ validationErrors }, 'Validation errors detected');
    }

    // Check if CAPTCHA is present and unsolved
    const captchaUnsolved = await page.evaluate(() => {
      // Check reCAPTCHA v2
      const recaptchaResponse = document.querySelector('#g-recaptcha-response');
      if (recaptchaResponse && !recaptchaResponse.value) {
        return 'reCAPTCHA v2 not solved';
      }

      // Check hCaptcha
      const hcaptchaResponse = document.querySelector('textarea[name="h-captcha-response"]');
      if (hcaptchaResponse && !hcaptchaResponse.value) {
        return 'hCaptcha not solved';
      }

      return null;
    });

    if (captchaUnsolved) {
      issues.push(captchaUnsolved);
      logger.warn({ captchaStatus: captchaUnsolved }, 'CAPTCHA verification failed');
    }

    return {
      ready: issues.length === 0,
      issues: issues
    };
  }

  /**
   * Verify submission was successful by checking page state
   */
  async verifySubmissionSuccess(page, initialUrl) {
    logger.info('Verifying submission success...');

    const currentUrl = page.url();

    // Check for success indicators
    const successIndicators = await page.evaluate(() => {
      const indicators = {
        hasSuccessMessage: false,
        hasErrorMessage: false,
        successMessages: [],
        errorMessages: [],
        urlChanged: false,
        formStillVisible: false
      };

      // Success message selectors
      const successSelectors = [
        '.success', '.confirmation', '.thank-you', '.submitted',
        '[class*="success"]', '[class*="confirmation"]', '[class*="complete"]',
        '.text-green-500', '.text-success',
        // Common success patterns
        'h1:contains("Thank")', 'h2:contains("Success")', 'div:contains("submitted")'
      ];

      // Error message selectors
      const errorSelectors = [
        '.error', '.alert-error', '.alert-danger',
        '[class*="error"]', '[role="alert"]',
        '.text-red-500', '.text-danger'
      ];

      // Check for success messages
      for (const selector of successSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            if (el.offsetParent !== null && el.textContent.trim()) {
              const text = el.textContent.trim().toLowerCase();
              if (text.includes('thank') || text.includes('success') ||
                  text.includes('submitted') || text.includes('received') ||
                  text.includes('confirmation')) {
                indicators.hasSuccessMessage = true;
                indicators.successMessages.push(el.textContent.trim());
              }
            }
          }
        } catch (e) {}
      }

      // Check for error messages
      for (const selector of errorSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            if (el.offsetParent !== null && el.textContent.trim()) {
              indicators.hasErrorMessage = true;
              indicators.errorMessages.push(el.textContent.trim());
            }
          }
        } catch (e) {}
      }

      // Check if original form is still visible (indicates submission failed)
      const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"]');
      const visibleSubmitButtons = Array.from(submitButtons).filter(btn => btn.offsetParent !== null);
      indicators.formStillVisible = visibleSubmitButtons.length > 0;

      return indicators;
    });

    successIndicators.urlChanged = currentUrl !== initialUrl;

    logger.info({
      currentUrl,
      initialUrl,
      urlChanged: successIndicators.urlChanged,
      hasSuccessMessage: successIndicators.hasSuccessMessage,
      hasErrorMessage: successIndicators.hasErrorMessage,
      formStillVisible: successIndicators.formStillVisible
    }, 'Submission verification results');

    // Determine success based on indicators
    const isSuccess = (
      successIndicators.hasSuccessMessage ||
      (successIndicators.urlChanged && !successIndicators.hasErrorMessage)
    ) && !successIndicators.hasErrorMessage;

    return {
      success: isSuccess,
      urlChanged: successIndicators.urlChanged,
      currentUrl: currentUrl,
      successMessages: successIndicators.successMessages,
      errorMessages: successIndicators.errorMessages,
      formStillVisible: successIndicators.formStillVisible,
      indicators: successIndicators
    };
  }

  /**
   * Submit the form with proper verification
   */
  async submitForm(page, submitButton, userProfile = null) {
    if (!submitButton) {
      throw new Error('No submit button provided');
    }

    logger.info({ buttonText: submitButton.text }, 'Clicking submit button');

    try {
      // Step 0: Verify filled data matches user profile (if profile provided)
      if (userProfile) {
        await this.verifyFilledData(page, userProfile);
      }

      // Step 1: Verify form is ready for submission
      const readyCheck = await this.verifyFormReadyForSubmission(page);
      if (!readyCheck.ready) {
        // If AUTO_SUBMIT_FOR_TESTING is enabled, proceed anyway for testing purposes
        if (process.env.AUTO_SUBMIT_FOR_TESTING === 'true') {
          logger.warn({ issues: readyCheck.issues }, '⚠️  Form validation failed but AUTO_SUBMIT_FOR_TESTING enabled - clicking submit anyway');
        } else {
          logger.error({ issues: readyCheck.issues }, 'Form not ready for submission');
          return {
            success: false,
            error: 'Form validation failed: ' + readyCheck.issues.join('; '),
            issues: readyCheck.issues
          };
        }
      } else {
        logger.info('Form validation passed, proceeding with submission');
      }

      // Step 2: Capture initial state
      const initialUrl = page.url();
      logger.info({ initialUrl }, 'Capturing initial state before submit');

      // Step 3: Click submit button
      await page.click(submitButton.selector);
      logger.info('Submit button clicked');

      // Step 4: Wait for page to process submission
      // Use Promise.allSettled to wait for multiple possible outcomes
      const waitResults = await Promise.allSettled([
        page.waitForNavigation({ timeout: 15000 }).catch(() => null),
        page.waitForSelector('.success, .confirmation, .thank-you, [class*="success"]', { timeout: 15000 }).catch(() => null),
        page.waitForSelector('.error, .alert-error, [role="alert"]', { timeout: 15000 }).catch(() => null)
      ]);

      logger.info({ waitResults: waitResults.map(r => r.status) }, 'Wait conditions completed');

      // Step 5: Give page extra time to stabilize
      await this.sleep(3000);

      // Step 6: Verify submission success
      const verification = await this.verifySubmissionSuccess(page, initialUrl);

      if (verification.success) {
        logger.info({
          successMessages: verification.successMessages,
          urlChanged: verification.urlChanged
        }, 'Form submitted successfully - verification passed');
        return {
          success: true,
          urlChanged: verification.urlChanged,
          currentUrl: verification.currentUrl,
          successMessages: verification.successMessages
        };
      } else {
        logger.error({
          errorMessages: verification.errorMessages,
          formStillVisible: verification.formStillVisible,
          urlChanged: verification.urlChanged
        }, 'Form submission failed - verification failed');
        return {
          success: false,
          error: verification.errorMessages.length > 0
            ? verification.errorMessages.join('; ')
            : 'Submission verification failed - no success indicators found',
          errorMessages: verification.errorMessages,
          formStillVisible: verification.formStillVisible
        };
      }

    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Form submission error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Find and click Apply button to navigate to application form
   */
  async findAndClickApplyButton(page) {
    logger.info('🔍 Looking for Apply button...');

    try {
      // Try multiple button text variations
      const applyTexts = [
        'apply for this position',
        'apply now',
        'apply for this job',
        'apply',
        'submit application',
        'start application',
        'begin application'
      ];

      for (const text of applyTexts) {
        try {
          // Use Playwright's getByRole or getByText for better matching
          const button = page.getByRole('button', { name: new RegExp(text, 'i') });
          const count = await button.count();

          if (count > 0) {
            const buttonText = await button.first().textContent();
            logger.info({ buttonText, searchText: text }, 'Found Apply button');

            await button.first().click();
            return { clicked: true, text: buttonText };
          }
        } catch (error) {
          // Try next variant
        }

        // Also try links
        try {
          const link = page.getByRole('link', { name: new RegExp(text, 'i') });
          const count = await link.count();

          if (count > 0) {
            const linkText = await link.first().textContent();
            logger.info({ linkText, searchText: text }, 'Found Apply link');

            await link.first().click();
            return { clicked: true, text: linkText };
          }
        } catch (error) {
          // Try next variant
        }
      }

      // Try generic selectors as fallback
      const genericSelectors = [
        'button:has-text("Apply")',
        'a:has-text("Apply")',
        '[class*="apply"][class*="button"]',
        '[data-qa*="apply"]',
        '#apply-button',
        '.apply-button'
      ];

      for (const selector of genericSelectors) {
        try {
          const element = page.locator(selector).first();
          const count = await element.count();

          if (count > 0) {
            const text = await element.textContent();
            logger.info({ text, selector }, 'Found Apply button via selector');

            await element.click();
            return { clicked: true, text };
          }
        } catch (error) {
          // Try next selector
        }
      }

      logger.info('No Apply button found');
      return { clicked: false };

    } catch (error) {
      logger.error({ error: error.message }, 'Error finding Apply button');
      return { clicked: false, error: error.message };
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
