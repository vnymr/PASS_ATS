/**
 * AI Form Filler
 * Intelligently fills forms using AI-generated responses with error recovery
 * ENHANCED: Ghost cursor integration for human-like mouse movements
 */

import logger from './logger.js';
import AIFormExtractor from './ai-form-extractor.js';
import AIFormIntelligence from './ai-form-intelligence.js';
import AILearningSystem from './ai-learning-system.js';
import CaptchaSolver from './captcha-solver.js';
import { createCursor, simulateHumanBrowsing } from './ghost-cursor-playwright.js';

class AIFormFiller {
  constructor(options = {}) {
    this.extractor = new AIFormExtractor();
    this.intelligence = new AIFormIntelligence();
    this.learningSystem = new AILearningSystem();
    this.captchaSolver = new CaptchaSolver();

    this.maxRetries = 3;
    this.typingDelay = 50; // ms between keystrokes for natural typing

    // Ghost cursor mode - DISABLED by default due to issues with remote browsers (Camoufox/Firefox)
    // Ghost cursor was designed for local Puppeteer, not remote WebSocket connections
    // See: https://github.com/microsoft/playwright/issues/9354 (Firefox mouse move issues)
    // See: https://github.com/microsoft/playwright/issues/15317 (protocol errors)
    this.useGhostCursor = options.useGhostCursor === true; // Disabled by default
    this.ghostCursors = new WeakMap(); // Cache cursors per page
  }

  /**
   * Get or create ghost cursor for a page
   * @param {Page} page - Playwright page
   * @returns {Object} Ghost cursor controller
   */
  getGhostCursor(page) {
    if (!this.ghostCursors.has(page)) {
      const cursor = createCursor(page, {
        moveSpeed: 0.8, // Slightly slower for more natural movement
        overshootSpread: 8
      });
      this.ghostCursors.set(page, cursor);
    }
    return this.ghostCursors.get(page);
  }

  /**
   * Validate and sanitize resume file path
   * @param {String} resumePath - Path to resume file
   * @returns {Object} { valid: boolean, path: string|null, error: string|null }
   */
  async validateResumePath(resumePath) {
    if (!resumePath) {
      return { valid: false, path: null, error: 'No resume path provided' };
    }

    // Import fs and path modules for validation
    const fs = await import('fs');
    const path = await import('path');

    try {
      // 1. Check for directory traversal attempts (../../etc/passwd)
      const normalizedPath = path.normalize(resumePath);
      if (normalizedPath.includes('..') || normalizedPath !== resumePath) {
        logger.error({ resumePath, normalizedPath }, 'Directory traversal attempt detected in resume path');
        return { valid: false, path: null, error: 'Invalid file path: directory traversal not allowed' };
      }

      // 2. Resolve to absolute path to prevent relative path issues
      const absolutePath = path.resolve(resumePath);

      // 3. Check if file exists
      if (!fs.existsSync(absolutePath)) {
        return { valid: false, path: null, error: `Resume file not found at path: ${absolutePath}` };
      }

      // 4. Check if it's a file (not a directory)
      const stats = fs.statSync(absolutePath);
      if (!stats.isFile()) {
        return { valid: false, path: null, error: 'Resume path must point to a file, not a directory' };
      }

      // 5. Validate file extension (must be PDF)
      const ext = path.extname(absolutePath).toLowerCase();
      if (ext !== '.pdf') {
        return { valid: false, path: null, error: `Invalid file type: ${ext}. Only PDF files are supported` };
      }

      // 6. Check file size (must be < 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (stats.size > maxSize) {
        return { valid: false, path: null, error: `File too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 10MB` };
      }

      // 7. Check file is readable
      try {
        fs.accessSync(absolutePath, fs.constants.R_OK);
      } catch (err) {
        return { valid: false, path: null, error: 'Resume file is not readable' };
      }

      logger.info({
        path: absolutePath,
        size: `${(stats.size / 1024).toFixed(2)}KB`,
        extension: ext
      }, 'Resume file validated successfully');

      return { valid: true, path: absolutePath, error: null };
    } catch (error) {
      logger.error({ error: error.message, resumePath }, 'Resume path validation failed');
      return { valid: false, path: null, error: `File validation error: ${error.message}` };
    }
  }

  /**
   * Complete AI-powered form filling flow
   * @param {Page} page - Playwright page or frame object
   * @param {Object} userProfile - User's profile data
   * @param {Object} jobData - Job description and metadata
   * @param {String} resumePath - Path to user's resume PDF file (optional)
   * @returns {Object} Result of form filling
   */
  async fillFormIntelligently(page, userProfile, jobData, resumePath = null) {
    logger.info('Starting AI-powered form filling...');

    // Validate and sanitize resume path before storing
    if (resumePath) {
      const validation = await this.validateResumePath(resumePath);
      if (!validation.valid) {
        logger.error({ error: validation.error }, 'Resume path validation failed');
        // Store null to prevent upload attempts
        this.userResumePath = null;
      } else {
        // Store validated absolute path
        this.userResumePath = validation.path;
        logger.info({ resumePath: validation.path }, 'Resume path validated and stored');
      }
    } else {
      this.userResumePath = null;
    }

    const result = {
      success: false,
      fieldsExtracted: 0,
      fieldsFilled: 0,
      errors: [],
      warnings: [],
      screenshots: [],
      learningRecorded: false
    };

    // Track which frame/page we're working with
    let workingPage = page;
    let usedIframe = false;

    try {
      // Step 1: Check for learned patterns
      const url = page.url();
      const learnedPatterns = await this.learningSystem.getLearnedPatternsForUrl(url);
      if (learnedPatterns) {
        logger.info('Found learned patterns for this domain');
        result.usedLearnedPatterns = true;
      }

      // Step 1.5: Check for embedded application iframes FIRST
      // Many ATS like Greenhouse embed forms in iframes
      logger.info('🔍 Checking for embedded application iframes...');
      const iframeCheck = await this.findFormFrame(page);
      if (iframeCheck.found && iframeCheck.frame) {
        logger.info({ atsType: iframeCheck.atsType }, '✅ Found application iframe - switching context');
        workingPage = iframeCheck.frame;
        usedIframe = true;
        result.usedIframe = true;
        result.iframeAtsType = iframeCheck.atsType;
      }

      // Step 2: Extract all form fields from the working page/frame
      logger.info('Extracting form fields...');
      const extraction = await this.extractor.extractComplete(workingPage);

      result.fieldsExtracted = extraction.fields.length;
      result.hasCaptcha = extraction.hasCaptcha;
      result.complexity = extraction.complexity.complexity;

      // Step 2.5: If few/no fields found, try clicking Apply button
      // This handles job description pages that need navigation to the form
      if (extraction.fields.length <= 3) {
        logger.warn({ fieldCount: extraction.fields.length }, '⚠️  Very few fields found - checking for Apply button');

        // Try clicking Apply button on the main page
        const applyButton = await this.findAndClickApplyButton(page);
        if (applyButton.clicked) {
          logger.info({ buttonText: applyButton.text }, '✅ Clicked Apply button - waiting for application form');

          // Wait for navigation, modal, or iframe to load
          await this.sleep(3000);

          // After clicking Apply, check for NEW iframes that may have loaded
          const newIframeCheck = await this.findFormFrame(page);
          if (newIframeCheck.found && newIframeCheck.frame) {
            logger.info({ atsType: newIframeCheck.atsType }, '✅ Found application iframe after clicking Apply');
            workingPage = newIframeCheck.frame;
            usedIframe = true;
            result.usedIframe = true;
            result.iframeAtsType = newIframeCheck.atsType;
          }

          // Re-extract form fields from the working page (could be iframe or main page)
          logger.info('Re-extracting form fields from application page/iframe...');
          const newExtraction = await this.extractor.extractComplete(workingPage);

          if (newExtraction.fields.length > extraction.fields.length) {
            logger.info({
              oldCount: extraction.fields.length,
              newCount: newExtraction.fields.length,
              usedIframe
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
            // Still no fields - check if we need to look harder
            logger.warn('No additional fields found after clicking Apply button');

            // Last attempt: try different iframe selectors more aggressively
            if (!usedIframe) {
              const frames = page.frames();
              for (const frame of frames) {
                if (frame === page.mainFrame()) continue;
                try {
                  const frameFields = await this.extractor.extractComplete(frame);
                  if (frameFields.fields.length > extraction.fields.length) {
                    logger.info({ frameUrl: frame.url(), fieldCount: frameFields.fields.length }, '✅ Found fields in secondary frame');
                    extraction.fields = frameFields.fields;
                    extraction.submitButton = frameFields.submitButton;
                    result.fieldsExtracted = frameFields.fields.length;
                    workingPage = frame;
                    usedIframe = true;
                    result.usedIframe = true;
                    break;
                  }
                } catch (e) {
                  // Continue to next frame
                }
              }
            }
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

      // Step 5: Fill the form (use workingPage which may be an iframe)
      logger.info({ usedIframe }, 'Filling form fields...');
      const fillResult = await this.fillFields(workingPage, extraction.fields, aiResponses);

      result.fieldsFilled = fillResult.filled;
      result.errors.push(...fillResult.errors);

      // Step 6: Handle any errors with screenshot analysis
      if (fillResult.errors.length > 0) {
        logger.info('Errors detected, analyzing with AI vision...');
        // Use main page for screenshot (captures full context)
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
          // Retry with AI's suggested fix (use workingPage for the iframe context)
          logger.info('Retrying with AI solution...');
          await this.fillSingleField(
            workingPage,
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
        logger.info({ buttonText: extraction.submitButton.text, usedIframe }, 'Found submit button');
        result.submitButton = extraction.submitButton;

        // Store the workingPage reference for later use by submitForm
        result._workingPage = workingPage;
        result._usedIframe = usedIframe;

        // Optional auto-submit (useful for testing)
        if (process.env.AUTO_SUBMIT_FOR_TESTING === 'true') {
          logger.warn('TESTING MODE: AUTO_SUBMIT_FOR_TESTING enabled - attempting auto-submit');

          // Wait a bit for any async form updates to complete
          await this.sleep(1000);

          // Verify form is ready before submitting (use workingPage for iframe context)
          const readyCheck = await this.verifyFormReadyForSubmission(workingPage);
          if (!readyCheck.ready && readyCheck.issues.length > 0) {
            logger.warn({
              issues: readyCheck.issues,
              note: 'Form has validation issues but proceeding due to AUTO_SUBMIT_FOR_TESTING'
            }, '⚠️  Form validation warnings before auto-submit');
          }

          try {
            // Use workingPage for submit if we're in an iframe
            const submitRes = await this.submitForm(workingPage, extraction.submitButton, userProfile);
            result.autoSubmitted = true;
            result.submitResult = submitRes;
            
            if (submitRes.success) {
              logger.info({ 
                urlChanged: submitRes.urlChanged,
                successMessages: submitRes.successMessages 
              }, '✅ Auto-submit successful');
            } else {
              logger.error({ 
                error: submitRes.error,
                issues: submitRes.issues 
              }, '❌ Auto-submit failed');
              result.errors.push('Auto-submit failed: ' + (submitRes.error || 'unknown'));
            }
          } catch (submitError) {
            logger.error({ error: submitError.message }, 'Auto-submit threw exception');
            result.autoSubmitted = false;
            result.errors.push('Auto-submit exception: ' + submitError.message);
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

      // Consider successful if >70% fields filled (allows file upload failures, unnamed field errors, and screenshot analysis failures)
      const fillRate = result.fieldsExtracted > 0 ? result.fieldsFilled / result.fieldsExtracted : 0;
      const hasOnlyAcceptableErrors = result.errors.every(err =>
        err.includes('file') ||
        err.includes('File') ||
        err.includes('InvalidStateError') ||
        err.includes('unnamed_') ||
        err.includes('Field not found') ||
        err.includes('Manual intervention') ||
        err.includes('screenshot') ||
        err.includes('Screenshot')
      );

      result.success = result.fieldsFilled > 0 && (result.errors.length === 0 || (fillRate >= 0.7 && hasOnlyAcceptableErrors));

      logger.info({ fieldsFilled: result.fieldsFilled, fieldsExtracted: result.fieldsExtracted }, 'Form filling complete');

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
        logger.error({ fieldName: field.name, fieldType: field.type, error: error.message }, 'Failed to fill field');
        
        // For dropdowns, provide more detailed error info
        if (field.type === 'select' || field.type === 'select-one' || field.type === 'select-multiple' || error.message.includes('dropdown')) {
          result.errors.push(`Dropdown "${field.name}" failed: ${error.message}`);
        } else {
          result.errors.push(`Failed to fill ${field.name}: ${error.message}`);
        }
        
        // Continue filling other fields even if one fails
        // This allows partial form completion
      }
    }

    logger.info({ 
      filled: result.filled, 
      totalFields: fields.length, 
      errors: result.errors.length 
    }, 'Form filling summary');

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

      // EXCLUSIONS: Never treat these as custom dropdowns
      // 1. Phone/tel fields - these are always text inputs
      if (element.type === 'tel' || element.id?.includes('phone') || element.name?.includes('phone')) {
        return false;
      }

      // 2. Location/autocomplete fields - these need special handling
      if (element.id?.includes('location') || element.name?.includes('location') ||
          element.placeholder?.toLowerCase().includes('city') ||
          element.placeholder?.toLowerCase().includes('location')) {
        return false;
      }

      // 3. Fields with autocomplete attribute - these are autocomplete fields
      if (element.hasAttribute('autocomplete') && element.getAttribute('autocomplete') !== 'off') {
        return false;
      }

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

    // Check if this is an autocomplete field (e.g., location)
    const isAutocompleteField =
      field.name?.includes('location') ||
      field.label?.toLowerCase().includes('location') ||
      field.label?.toLowerCase().includes('city') ||
      field.placeholder?.toLowerCase().includes('city') ||
      field.placeholder?.toLowerCase().includes('location');

    if (isAutocompleteField && field.type === 'text') {
      logger.info({
        field: field.name,
        label: field.label
      }, '🌐 Detected autocomplete field (type + select)');
      await this.fillAutocompleteField(page, selector, value, field);
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
   * ENHANCED: Uses ghost cursor for human-like mouse movements
   */
  async fillTextInput(page, selector, text) {
    // Add human-like "reading time" before filling important fields
    const fieldName = selector.toLowerCase();
    if (fieldName.includes('email') || fieldName.includes('phone') ||
        fieldName.includes('location') || fieldName.includes('name')) {
      // Simulate reading the field label (500ms - 1.5s)
      await this.sleep(500 + Math.random() * 1000);
    }

    // Use ghost cursor for human-like click if enabled (with timeout protection)
    if (this.useGhostCursor) {
      try {
        const cursor = this.getGhostCursor(page);
        // Move to and click the field with human-like behavior (5s timeout)
        await Promise.race([
          cursor.click(selector),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Ghost cursor timeout')), 5000))
        ]);
        await this.sleep(50 + Math.random() * 100);
      } catch (e) {
        // Fallback to regular click if ghost cursor fails or times out
        logger.debug({ selector, error: e.message }, 'Ghost cursor click failed, using fallback');
        try {
          await page.click(selector, { timeout: 3000 });
        } catch (clickErr) {
          // Continue anyway, fill might still work
        }
      }
    }

    // Use Playwright's native fill method - properly triggers React/Vue change detection
    try {
      // Clear existing value first
      await page.fill(selector, '');
      // Add tiny delay after clearing (human-like)
      await this.sleep(100 + Math.random() * 200);
      // Fill with new value
      await page.fill(selector, String(text));
      // Longer delay to let any onChange handlers run and simulate "moving to next field"
      await this.sleep(200 + Math.random() * 300);
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
      await this.sleep(200 + Math.random() * 300);
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
   * ENHANCED: Uses ghost cursor for human-like mouse movements
   */
  async fillCustomDropdown(page, selector, value, field) {
    logger.debug({ value, fieldName: field.name }, 'Filling custom dropdown (react-select style)');

    // Helper function for clicking with ghost cursor fallback (with timeout protection)
    const humanClick = async (sel, clickTimeout = 5000) => {
      if (this.useGhostCursor) {
        try {
          const cursor = this.getGhostCursor(page);
          // Add timeout to ghost cursor click
          await Promise.race([
            cursor.click(sel),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Ghost cursor timeout')), 3000))
          ]);
          return;
        } catch (e) {
          logger.debug({ sel, error: e.message }, 'Ghost cursor click failed for dropdown');
        }
      }
      await page.click(sel, { timeout: clickTimeout });
    };

    try {
      // Method 1: Type to search + Tab/Enter (works for most Greenhouse/Lever dropdowns)
      try {
        logger.debug({ selector }, 'Attempting dropdown via type + keyboard method');

        // Click the dropdown to open it with human-like movement
        await humanClick(selector, 5000);
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

      // Click to open with human-like movement
      await humanClick(selector, 5000);
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
          await humanClick(optionSelector, 2000);
          logger.debug({ value, optionSelector }, 'Custom dropdown option clicked');
          await this.sleep(200);
          return { success: true, matched: value, value: value };
        } catch (e) {
          // Try next selector
        }
      }

      // Method 3: Keyboard navigation fallback
      logger.debug('Attempting dropdown via keyboard navigation');
      await humanClick(selector, 5000);
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
   * Fill custom dropdown (for Greenhouse-style dropdowns)
   * These are text inputs styled to look like dropdowns
   * Uses hybrid approach: Playwright locators + page.evaluate() for reliability
   */
  async fillCustomDropdownWithMouse(page, selector, value, field) {
    logger.info({ selector, value, field: field.name }, '🖱️  Filling custom dropdown with enhanced matching');

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug({ attempt, maxRetries }, 'Dropdown fill attempt');

        // Step 1: Try multiple strategies to open the dropdown
        let dropdownOpened = false;
        
        // Strategy 1: Use Playwright locator to click (triggers proper events)
        try {
          const locator = page.locator(selector).first();
          await locator.scrollIntoViewIfNeeded();
          
          // Try clicking the input directly
          await locator.click({ timeout: 5000, force: false });
          await this.sleep(300);
          
          // Check if dropdown opened
          dropdownOpened = await page.evaluate(() => {
            const menus = document.querySelectorAll('[role="listbox"], [role="menu"], .select-options, .dropdown-menu, ul.options, div.options');
            return Array.from(menus).some(menu => menu.offsetParent !== null);
          });
          
          if (dropdownOpened) {
            logger.debug('Dropdown opened via direct locator click');
          }
        } catch (e) {
          logger.debug({ error: e.message }, 'Direct locator click failed, trying alternatives');
        }

        // Strategy 2: If direct click didn't work, try clicking parent container
        if (!dropdownOpened) {
          try {
            const parentInfo = await page.evaluate((sel) => {
              const el = document.querySelector(sel);
              if (!el) return null;

              // Find clickable parent container
              let parent = el.parentElement;
              let attempts = 0;
              while (parent && parent !== document.body && attempts < 5) {
                const classes = parent.className || '';
                const id = parent.id || '';
                
                // Check if this looks like a clickable dropdown container
                if (classes.includes('select') ||
                    classes.includes('dropdown') ||
                    classes.includes('field') ||
                    id.includes('select') ||
                    id.includes('dropdown') ||
                    parent.getAttribute('role') === 'combobox') {
                  return {
                    selector: parent.id ? `#${parent.id}` : 
                             parent.className ? `.${parent.className.split(' ')[0]}` : null,
                    tagName: parent.tagName,
                    className: classes
                  };
                }
                parent = parent.parentElement;
                attempts++;
              }
              
              // If no specific container found, return parent element info
              if (el.parentElement) {
                return {
                  selector: null,
                  tagName: el.parentElement.tagName,
                  className: el.parentElement.className || ''
                };
              }
              
              return null;
            }, selector);

            if (parentInfo) {
              logger.debug({ parentInfo }, 'Found parent container, trying to click it');
              
              // Try clicking parent using multiple methods
              const parentClickSuccess = await page.evaluate(({ inputSel }) => {
                const input = document.querySelector(inputSel);
                if (!input) return false;
                
                // Try clicking parent
                let parent = input.parentElement;
                if (parent) {
                  // Try multiple click methods
                  parent.click();
                  parent.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                  parent.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                  parent.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                  
                  // Also try focusing and triggering focus events
                  if (input.focus) {
                    input.focus();
                    input.dispatchEvent(new Event('focus', { bubbles: true }));
                  }
                  
                  return true;
                }
                return false;
              }, { inputSel: selector });
              
              if (parentClickSuccess) {
                await this.sleep(400);
                
                // Check if dropdown opened
                dropdownOpened = await page.evaluate(() => {
                  const menus = document.querySelectorAll('[role="listbox"], [role="menu"], .select-options, .dropdown-menu');
                  return Array.from(menus).some(menu => menu.offsetParent !== null);
                });
                
                if (dropdownOpened) {
                  logger.debug('Dropdown opened via parent container click');
                }
              }
            }
          } catch (e) {
            logger.debug({ error: e.message }, 'Parent click strategy failed');
          }
        }

        // Strategy 3: Try clicking arrow/chevron button (common in custom dropdowns)
        if (!dropdownOpened) {
          try {
            logger.debug('Trying to find and click dropdown arrow/chevron');
            const arrowClicked = await page.evaluate((sel) => {
              const input = document.querySelector(sel);
              if (!input) return false;
              
              // Look for arrow/chevron icon in parent containers
              let parent = input.parentElement;
              let attempts = 0;
              
              while (parent && parent !== document.body && attempts < 5) {
                // Look for SVG icons (arrows, chevrons)
                const svgs = parent.querySelectorAll('svg');
                for (const svg of svgs) {
                  const classes = svg.className?.baseVal || svg.className || '';
                  if (classes.includes('arrow') ||
                      classes.includes('chevron') ||
                      classes.includes('caret') ||
                      classes.includes('dropdown')) {
                    // Click the SVG or its parent
                    const clickable = svg.closest('button') || svg.closest('[role="button"]') || svg.parentElement;
                    if (clickable) {
                      clickable.click();
                      return true;
                    }
                  }
                }
                
                // Look for button elements with arrow classes
                const buttons = parent.querySelectorAll('button, [role="button"]');
                for (const btn of buttons) {
                  const classes = btn.className || '';
                  if (classes.includes('arrow') ||
                      classes.includes('chevron') ||
                      classes.includes('dropdown-toggle') ||
                      classes.includes('select-arrow')) {
                    btn.click();
                    return true;
                  }
                }
                
                parent = parent.parentElement;
                attempts++;
              }
              
              return false;
            }, selector);
            
            if (arrowClicked) {
              await this.sleep(400);
              dropdownOpened = await page.evaluate(() => {
                const menus = document.querySelectorAll('[role="listbox"], [role="menu"], .select-options, .dropdown-menu');
                return Array.from(menus).some(menu => menu.offsetParent !== null);
              });
              
              if (dropdownOpened) {
                logger.debug('Dropdown opened via arrow/chevron click');
              }
            }
          } catch (e) {
            logger.debug({ error: e.message }, 'Arrow click strategy failed');
          }
        }

        // Strategy 4: Try keyboard approach - focus and press Space or ArrowDown
        if (!dropdownOpened) {
          try {
            logger.debug('Trying keyboard approach to open dropdown');
            const locator = page.locator(selector).first();
            await locator.focus();
            await this.sleep(200);
            
            // Try Space key (common for opening dropdowns)
            await page.keyboard.press('Space');
            await this.sleep(300);
            
            dropdownOpened = await page.evaluate(() => {
              const menus = document.querySelectorAll('[role="listbox"], [role="menu"], .select-options, .dropdown-menu');
              return Array.from(menus).some(menu => menu.offsetParent !== null);
            });
            
            if (!dropdownOpened) {
              // Try ArrowDown
              await page.keyboard.press('ArrowDown');
              await this.sleep(300);
              
              dropdownOpened = await page.evaluate(() => {
                const menus = document.querySelectorAll('[role="listbox"], [role="menu"], .select-options, .dropdown-menu');
                return Array.from(menus).some(menu => menu.offsetParent !== null);
              });
            }
            
            if (dropdownOpened) {
              logger.debug('Dropdown opened via keyboard');
            }
          } catch (e) {
            logger.debug({ error: e.message }, 'Keyboard approach failed');
          }
        }

        if (!dropdownOpened) {
          logger.warn({ selector, field: field.name }, 'Could not open dropdown with any strategy');
          throw new Error('Dropdown menu did not open after multiple attempts');
        }

        // Give dropdown a moment to fully render
        await this.sleep(300);

        // Step 2: Wait for dropdown menu to appear (async wait outside evaluate)
        // Expanded selectors to catch more dropdown patterns (especially Greenhouse)
        let dropdownVisible = false;
        const dropdownSelectors = [
          'ul[role="listbox"]',
          'div[role="listbox"]',
          '[role="menu"]',
          '[role="listbox"]',
          '.select-options',
          '.dropdown-menu',
          '.select-menu',
          '.select__menu',
          '.select__menu-list',
          'ul.options',
          'div.options',
          'div[class*="option"]',
          'div[class*="menu"]',
          'div[class*="dropdown"]',
          'div[class*="Select-menu"]',
          'div[class*="react-select"]',
          '[class*="menu-portal"]',
          '[class*="menu-list"]',
          '[class*="options-list"]',
          'ul[class*="menu"]',
          'div[class*="popover"]',
          '[data-testid*="menu"]',
          '[data-testid*="dropdown"]'
        ];

        // Wait up to 3 seconds for dropdown to appear
        for (let waitAttempt = 0; waitAttempt < 15; waitAttempt++) {
          dropdownVisible = await page.evaluate((selectors) => {
            // Try all selectors
            for (const sel of selectors) {
              try {
                const menus = document.querySelectorAll(sel);
                for (const menu of menus) {
                  // Check if menu is visible
                  if (menu && menu.offsetParent !== null) {
                    // Additional check: make sure it's actually visible (not just in DOM)
                    const style = window.getComputedStyle(menu);
                    if (style.display !== 'none' && 
                        style.visibility !== 'hidden' && 
                        style.opacity !== '0') {
                      return true;
                    }
                  }
                }
              } catch (e) {
                // Invalid selector, continue
              }
            }
            return false;
          }, dropdownSelectors);

          if (dropdownVisible) {
            logger.debug({ waitAttempt }, 'Dropdown menu detected as visible');
            break;
          }
          await this.sleep(200);
        }

        if (!dropdownVisible) {
          // Log what we found for debugging
          const debugInfo = await page.evaluate(() => {
            const allMenus = document.querySelectorAll('[role="listbox"], [role="menu"], [class*="menu"], [class*="dropdown"]');
            return Array.from(allMenus).map(menu => ({
              tagName: menu.tagName,
              className: menu.className,
              id: menu.id,
              role: menu.getAttribute('role'),
              visible: menu.offsetParent !== null,
              display: window.getComputedStyle(menu).display,
              visibility: window.getComputedStyle(menu).visibility
            }));
          });
          
          logger.warn({ 
            selector, 
            field: field.name,
            foundMenus: debugInfo 
          }, 'Dropdown menu did not appear - debug info');
          
          throw new Error('Dropdown menu did not appear after clicking');
        }

        // Step 3: Get all available options and find best match
        const result = await page.evaluate(({ selectors, targetValue }) => {
          // Find the dropdown menu with better visibility checks
          let dropdownMenu = null;
          for (const sel of selectors) {
            try {
              const menus = document.querySelectorAll(sel);
              for (const menu of menus) {
                if (menu && menu.offsetParent !== null) {
                  const style = window.getComputedStyle(menu);
                  if (style.display !== 'none' && 
                      style.visibility !== 'hidden' && 
                      style.opacity !== '0') {
                    dropdownMenu = menu;
                    break;
                  }
                }
              }
              if (dropdownMenu) break;
            } catch (e) {
              // Invalid selector, continue
            }
          }

          if (!dropdownMenu) {
            return { success: false, reason: 'Dropdown menu not found' };
          }

          // Enumerate all visible options with expanded selectors
          const optionSelectors = [
            'li',
            'div[role="option"]',
            '[role="option"]',
            '[data-option]',
            'div[class*="option"]',
            'span[class*="option"]',
            'a[role="option"]',
            '[class*="Select-option"]',
            '[class*="react-select__option"]',
            '[class*="menu-item"]',
            '[class*="dropdown-item"]'
          ];
          
          const allOptions = [];
          for (const optSel of optionSelectors) {
            try {
              const opts = dropdownMenu.querySelectorAll(optSel);
              allOptions.push(...Array.from(opts));
            } catch (e) {
              // Invalid selector, continue
            }
          }
          
          // Filter to only visible options with text
          const optionElements = allOptions.filter(el => {
            // Only visible elements
            if (el.offsetParent === null) return false;
            
            // Check computed style
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || 
                style.visibility === 'hidden' || 
                style.opacity === '0') {
              return false;
            }
            
            // Must have text content
            const text = el.textContent?.trim() || '';
            return text.length > 0;
          });

          const availableOptions = optionElements
            .map(opt => opt.textContent?.trim())
            .filter(Boolean);

          if (availableOptions.length === 0) {
            return { success: false, reason: 'No options found in dropdown', availableOptions: [] };
          }

          // Fuzzy matching function with scoring
          const fuzzyMatch = (needle, haystack) => {
            if (!needle || !haystack) return 0;
            const needleLower = needle.toLowerCase().trim();
            const haystackLower = haystack.toLowerCase().trim();

            // Exact match
            if (needleLower === haystackLower) return 1.0;

            // Contains match
            if (haystackLower.includes(needleLower)) return 0.9;
            if (needleLower.includes(haystackLower)) return 0.85;

            // Word overlap scoring
            const needleWords = needleLower.split(/\s+/).filter(w => w.length > 1);
            const haystackWords = haystackLower.split(/\s+/).filter(w => w.length > 1);
            if (needleWords.length === 0 || haystackWords.length === 0) return 0;

            const needleSet = new Set(needleWords);
            let overlap = 0;
            for (const word of haystackWords) {
              if (needleSet.has(word)) overlap++;
            }

            return overlap / Math.max(needleWords.length, haystackWords.length);
          };

          // Find best matching option
          let bestOption = null;
          let bestScore = -1;
          const aiValue = String(targetValue || '').trim();

          optionElements.forEach((opt) => {
            const optText = opt.textContent?.trim() || '';
            const score = fuzzyMatch(aiValue, optText);

            if (score > bestScore) {
              bestScore = score;
              bestOption = opt;
            }
          });

          // Fallback to first non-placeholder option if match score is too low
          if (!bestOption || bestScore < 0.5) {
            const placeholderPatterns = /^(select|choose|pick|--|please)/i;
            const firstNonPlaceholder = optionElements.find(opt => {
              const text = opt.textContent?.trim() || '';
              return text.length > 0 && !placeholderPatterns.test(text);
            });

            if (firstNonPlaceholder) {
              // Click option (no scroll to avoid movement)
              firstNonPlaceholder.click();

              return {
                success: true,
                matched: firstNonPlaceholder.textContent?.trim(),
                value: targetValue,
                usedFallback: true,
                originalScore: bestScore,
                availableOptions: availableOptions.slice(0, 15),
                reason: `Low match score (${bestScore.toFixed(2)}), used fallback`
              };
            }
          }

          if (!bestOption) {
            return {
              success: false,
              reason: 'No matching option found',
              availableOptions: availableOptions.slice(0, 15)
            };
          }

          // Click option (no scroll to avoid movement)
          bestOption.click();

          return {
            success: true,
            matched: bestOption.textContent?.trim(),
            value: targetValue,
            matchScore: bestScore,
            availableOptions: availableOptions.slice(0, 15)
          };
        }, { selectors: dropdownSelectors, targetValue: String(value) });

        // Wait for dropdown to close and value to be set
        await this.sleep(400);

        if (result.success) {
          const logData = {
            matched: result.matched,
            matchScore: result.matchScore,
            usedFallback: result.usedFallback,
            availableOptions: result.availableOptions
          };

          if (result.usedFallback) {
            logger.warn(logData, '⚠️  Used fallback option for custom dropdown');
          } else {
            logger.info(logData, '✅ Custom dropdown option selected with fuzzy match');
          }
          return; // Success!
        } else {
          lastError = new Error(`Failed to select: ${result.reason}. Available options: ${result.availableOptions?.join(', ') || 'none'}`);
          logger.warn({ attempt, reason: result.reason, availableOptions: result.availableOptions }, 'Dropdown selection failed, will retry');
        }
      } catch (error) {
        lastError = error;
        logger.warn({ attempt, error: error.message }, 'Dropdown fill attempt failed, will retry');
        if (attempt < maxRetries) {
          await this.sleep(500 * attempt); // Exponential backoff
        }
      }
    }

    // All retries failed
    const errorMsg = `Failed to fill custom dropdown "${field.name}" after ${maxRetries} attempts. AI provided: "${value}". Error: ${lastError?.message || 'unknown'}`;
    logger.error({ selector, value, field: field.name, error: lastError?.message }, errorMsg);
    throw new Error(errorMsg);
  }

  /**
   * Fill autocomplete field (type + wait for suggestions + select)
   * Used for location/city fields that show autocomplete suggestions
   */
  async fillAutocompleteField(page, selector, value, field) {
    logger.info({ selector, value, field: field.name }, '🌐 Filling autocomplete field');

    try {
      // Step 1: Click and focus the field
      await page.click(selector);
      await this.sleep(300);

      // Step 2: Clear and type the value slowly (character by character for autocomplete to trigger)
      await page.fill(selector, ''); // Clear first
      await page.type(selector, String(value), { delay: 50 }); // Type with delay
      await this.sleep(1200); // Wait longer for autocomplete suggestions to appear

      logger.debug('Waiting for autocomplete suggestions...');

      // Step 3: Try multiple strategies to select from autocomplete

      // Strategy 1: Try to find and click autocomplete suggestion
      const suggestionSelected = await page.evaluate(({ targetValue }) => {
        const selectors = [
          '[role="option"]',
          '[role="listbox"] > *',
          '.autocomplete-option',
          '.suggestion',
          'li[class*="option"]',
          'div[class*="suggestion"]',
          '[class*="autocomplete"] li',
          '[class*="dropdown"] li',
          'ul[role="listbox"] li',
          'div[role="listbox"] div',
          // Greenhouse-specific selectors
          '.select__menu [class*="option"]',
          '[class*="MenuList"] > div',
          '[class*="option-list"] > *'
        ];

        const allOptions = [];

        // Find visible suggestions and collect them
        for (const sel of selectors) {
          const options = Array.from(document.querySelectorAll(sel))
            .filter(el => {
              if (el.offsetParent === null) return false; // Not visible
              const text = el.textContent?.trim() || '';
              if (text.length === 0) return false; // No text
              // Filter out duplicates
              if (allOptions.some(opt => opt.textContent === text)) return false;
              return true;
            });

          if (options.length > 0) {
            allOptions.push(...options);
          }
        }

        // Log what we found
        const optionTexts = allOptions.map(el => el.textContent?.trim()).slice(0, 10);

        if (allOptions.length > 0) {
          // Try to find best match
          const needle = targetValue.toLowerCase().trim();
          let bestMatch = null;
          let bestScore = -1;

          for (const opt of allOptions) {
            const text = opt.textContent?.trim().toLowerCase() || '';
            // Match city name (handle "Austin, TX" format)
            const cityPart = text.split(',')[0].trim();
            if (text.includes(needle) || needle.includes(cityPart) || cityPart.includes(needle.split(',')[0].trim())) {
              const score = text === needle ? 1.0 : (cityPart === needle.split(',')[0].trim() ? 0.9 : 0.8);
              if (score > bestScore) {
                bestScore = score;
                bestMatch = opt;
              }
            }
          }

          if (bestMatch) {
            try {
              // Try multiple click methods (no scroll to avoid movement)
              bestMatch.click();
              bestMatch.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
              bestMatch.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
              return { success: true, matched: bestMatch.textContent?.trim(), strategy: 'click', availableOptions: optionTexts };
            } catch (e) {
              return { success: false, reason: 'Click failed: ' + e.message, availableOptions: optionTexts };
            }
          }

          // If no match, click first option
          if (allOptions.length > 0) {
            try {
              const first = allOptions[0];
              // Click first option (no scroll to avoid movement)
              first.click();
              first.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
              first.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
              return { success: true, matched: first.textContent?.trim(), usedFirst: true, strategy: 'click-first', availableOptions: optionTexts };
            } catch (e) {
              return { success: false, reason: 'Click first failed: ' + e.message, availableOptions: optionTexts };
            }
          }
        }

        return { success: false, reason: 'No autocomplete suggestions found', checkedSelectors: selectors.length };
      }, { targetValue: String(value) });

      logger.debug({ suggestionResult: suggestionSelected }, 'Autocomplete suggestion result');

      if (suggestionSelected.success) {
        logger.info({
          matched: suggestionSelected.matched,
          usedFirst: suggestionSelected.usedFirst,
          strategy: suggestionSelected.strategy
        }, '✅ Autocomplete suggestion selected');
        await this.sleep(500);
        return;
      }

      // Strategy 2: Keyboard navigation fallback (ArrowDown + Enter)
      logger.info('Trying keyboard navigation for autocomplete...');
      await page.keyboard.press('ArrowDown');
      await this.sleep(200);
      await page.keyboard.press('Enter');
      await this.sleep(500);

      // Verify the field has a value
      const fieldValue = await page.inputValue(selector);
      if (fieldValue && fieldValue.trim().length > 0) {
        logger.info({ value: fieldValue }, '✅ Autocomplete field filled via keyboard');
        return;
      }

      // Strategy 3: If still empty, try typing again and pressing Tab
      logger.warn('Autocomplete value not accepted, trying Tab key...');
      await page.fill(selector, String(value));
      await this.sleep(300);
      await page.keyboard.press('Tab');
      await this.sleep(500);

      // Final check
      const finalValue = await page.inputValue(selector);
      if (finalValue && finalValue.trim().length > 0) {
        logger.info({ value: finalValue }, '✅ Autocomplete field filled via Tab');
      } else {
        logger.warn({
          value,
          finalValue
        }, '⚠️  Autocomplete field may not be properly filled');
      }

    } catch (error) {
      logger.error({ selector, value, error: error.message }, '❌ Failed to fill autocomplete field');
      // Fallback: just type the value
      await this.fillTextInput(page, selector, value);
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
        // Legacy fallback (should not be reached with Playwright)
        logger.warn({ value: bestMatch.value }, '⚠️ Using legacy select method');
        await page.selectOption(selector, bestMatch.value);
        logger.info({ selected: bestMatch.text }, '✅ Selected option using legacy method');
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

      // Resume path was already validated in fillFormIntelligently()
      // This is a final sanity check
      const path = await import('path');
      logger.debug({ fileName: path.basename(resumePath) }, 'Using validated resume for upload');

      // Use Playwright's setInputFiles API
      logger.debug('Using Playwright setInputFiles');

      if (typeof page.setInputFiles === 'function') {
        await page.setInputFiles(selector, resumePath);
        logger.debug('File uploaded successfully (Playwright)');
      } else {
        // Fallback for ElementHandle
        const fileInput = await page.$(selector);
        if (!fileInput) {
          throw new Error(`File input not found: ${selector}`);
        }
        if (typeof fileInput.setInputFiles === 'function') {
          await fileInput.setInputFiles(resumePath);
          logger.debug('File uploaded successfully');
        } else {
          throw new Error('setInputFiles method not available');
        }
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

      // Step 3: Click submit button (with retry logic)
      try {
        // Try using Playwright locator first (more reliable)
        const submitLocator = page.locator(submitButton.selector).first();
        // No scroll to avoid constant movement - button should be visible
        await submitLocator.click({ timeout: 10000 });
        logger.info('Submit button clicked using locator');
      } catch (locatorError) {
        logger.warn({ error: locatorError.message }, 'Locator click failed, trying direct click');
        // Fallback to direct click
        await page.click(submitButton.selector, { timeout: 10000 });
        logger.info('Submit button clicked using direct click');
      }

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
        logger.warn({
          errorMessages: verification.errorMessages,
          formStillVisible: verification.formStillVisible
        }, 'Form submission failed - checking for empty required fields to retry');

        // RETRY LOGIC: Check for empty required fields and try to fill them
        const retryable = verification.formStillVisible && verification.errorMessages.length > 0;

        if (retryable && !this._submitRetried) {
          this._submitRetried = true; // Prevent infinite retry loop

          logger.info('🔄 Attempting to fill empty required fields and retry submission...');

          // Find empty required fields
          const emptyFields = await page.evaluate(() => {
            const fields = [];
            const inputs = document.querySelectorAll('input[required], textarea[required], select[required]');

            for (const input of inputs) {
              const value = input.value?.trim() || '';
              const type = input.type || input.tagName.toLowerCase();

              // Check if field is empty or invalid
              const isEmpty = !value || value === '' || value === 'Select...' || value === 'Choose...';
              const hasError = input.classList.contains('error') ||
                              input.classList.contains('invalid') ||
                              input.getAttribute('aria-invalid') === 'true';

              if (isEmpty || hasError) {
                fields.push({
                  selector: `#${input.id}` || `input[name="${input.name}"]`,
                  name: input.name || input.id,
                  type: type,
                  label: input.labels?.[0]?.textContent?.trim() || input.placeholder || input.name,
                  value: value,
                  isEmpty: isEmpty,
                  hasError: hasError
                });
              }
            }

            return fields;
          });

          if (emptyFields.length > 0) {
            logger.info({ count: emptyFields.length, fields: emptyFields }, 'Found empty/invalid required fields');

            // Try to fill empty fields using existing AI responses
            for (const field of emptyFields) {
              try {
                logger.info({ field: field.name, label: field.label }, 'Retrying fill for empty field');

                // Get value from user profile or use a sensible default
                let value = null;

                // Try to map field name to userProfile
                if (field.name?.includes('phone') || field.label?.toLowerCase().includes('phone')) {
                  value = userProfile?.phone;
                } else if (field.name?.includes('location') || field.label?.toLowerCase().includes('location') || field.label?.toLowerCase().includes('city')) {
                  value = userProfile?.location || userProfile?.city;
                } else if (field.name?.includes('email')) {
                  value = userProfile?.email;
                } else if (field.name?.includes('name')) {
                  value = userProfile?.fullName || `${userProfile?.firstName} ${userProfile?.lastName}`;
                }

                if (value) {
                  await this.fillSingleField(page, field, value);
                  logger.info({ field: field.name }, '✅ Retried field fill');
                } else {
                  logger.warn({ field: field.name }, 'No value available for retry');
                }

                await this.sleep(200);
              } catch (fillError) {
                logger.warn({ field: field.name, error: fillError.message }, 'Failed to retry field fill');
              }
            }

            // Wait a bit for validation
            await this.sleep(1000);

            // Retry submit
            logger.info('🔁 Retrying submit after filling empty fields...');
            try {
              // Click submit again
              const submitLocator = page.locator(submitButton.selector).first();
              await submitLocator.click({ timeout: 10000 });
              logger.info('Submit button clicked (retry)');

              // Wait for response
              await this.sleep(5000);

              // Re-verify submission
              const retryVerification = await this.verifySubmissionSuccess(page, initialUrl);

              if (retryVerification.success) {
                logger.info('✅ Retry submission successful!');
                return {
                  success: true,
                  urlChanged: retryVerification.urlChanged,
                  currentUrl: retryVerification.currentUrl,
                  successMessages: retryVerification.successMessages,
                  retriedAfterErrors: true
                };
              } else {
                logger.warn('Retry submission still failed');
              }
            } catch (retryError) {
              logger.error({ error: retryError.message }, 'Retry submission attempt failed');
            }
          } else {
            logger.info('No empty required fields found to retry');
          }
        }

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
   * Find application form iframe (Greenhouse, Lever, Workday, etc.)
   * Many ATS platforms embed their forms in iframes
   * @param {Page} page - Playwright page
   * @returns {Object} { found: boolean, frame: Frame|null, atsType: string|null }
   */
  async findFormFrame(page) {
    logger.info('🔍 Checking for embedded application form iframes...');

    try {
      // Common ATS iframe patterns
      const iframePatterns = [
        { pattern: 'greenhouse', name: 'Greenhouse' },
        { pattern: 'lever.co', name: 'Lever' },
        { pattern: 'workday', name: 'Workday' },
        { pattern: 'icims', name: 'iCIMS' },
        { pattern: 'smartrecruiters', name: 'SmartRecruiters' },
        { pattern: 'jobvite', name: 'Jobvite' },
        { pattern: 'ashbyhq', name: 'Ashby' },
        { pattern: 'apply', name: 'Generic Apply' }
      ];

      // Get all frames in the page
      const frames = page.frames();
      logger.info({ frameCount: frames.length }, 'Found frames in page');

      for (const frame of frames) {
        const url = frame.url();
        if (!url || url === 'about:blank') continue;

        for (const { pattern, name } of iframePatterns) {
          if (url.toLowerCase().includes(pattern)) {
            logger.info({ frameUrl: url, atsType: name }, '✅ Found ATS iframe');

            // Verify frame has form elements
            try {
              const formCount = await frame.locator('form, input, select, textarea').count();
              if (formCount > 0) {
                logger.info({ formElements: formCount, atsType: name }, '✅ ATS iframe contains form elements');
                return { found: true, frame, atsType: name };
              }
            } catch (e) {
              logger.debug({ error: e.message }, 'Error checking iframe form elements');
            }
          }
        }
      }

      // Also check for iframes by ID/class patterns
      const iframeSelectors = [
        'iframe#grnhse_iframe',           // Greenhouse
        'iframe[id*="greenhouse"]',
        'iframe[src*="greenhouse"]',
        'iframe[id*="lever"]',
        'iframe[src*="lever"]',
        'iframe[id*="apply"]',
        'iframe[src*="apply"]',
        'iframe[id*="job"]',
        'iframe[class*="application"]'
      ];

      for (const selector of iframeSelectors) {
        try {
          const iframeLocator = page.locator(selector).first();
          const count = await iframeLocator.count();

          if (count > 0) {
            const frame = await iframeLocator.contentFrame();
            if (frame) {
              const url = frame.url();
              logger.info({ selector, frameUrl: url }, '✅ Found application iframe via selector');
              return { found: true, frame, atsType: 'Embedded' };
            }
          }
        } catch (e) {
          // Try next selector
        }
      }

      logger.info('No embedded application iframe found');
      return { found: false, frame: null, atsType: null };

    } catch (error) {
      logger.error({ error: error.message }, 'Error finding form frame');
      return { found: false, frame: null, atsType: null };
    }
  }

  /**
   * Find and click Apply button to navigate to application form
   * Enhanced with more ATS-specific selectors
   */
  async findAndClickApplyButton(page) {
    logger.info('🔍 Looking for Apply button...');

    try {
      // STEP 1: Try ATS-specific selectors first (most reliable)
      const atsSelectors = [
        // Greenhouse
        '#apply_button',
        '#application_form_submit',
        '[data-id="apply-button"]',
        'a[href*="#app"]',
        'a[href*="greenhouse.io/job_app"]',
        '.apply-btn',
        '.js-apply-button',

        // Lever
        '.postings-btn-wrapper a',
        '.lever-apply-btn',
        'a[href*="lever.co/"]',

        // Workday
        '[data-automation-id="applyButton"]',
        '[data-automation-id="applyBtn"]',
        '.WDPT button[type="button"]',

        // Generic job boards
        '[data-testid="apply-button"]',
        '[data-cy="apply-button"]',
        '[aria-label*="Apply"]',
        '.job-apply-button',
        '.apply-now-button',
        '.careers-apply-btn',
        '#job-apply',
        '.job-apply',
        'a.apply',
        'button.apply'
      ];

      for (const selector of atsSelectors) {
        try {
          const element = page.locator(selector).first();
          const count = await element.count();

          if (count > 0) {
            const isVisible = await element.isVisible().catch(() => false);
            if (isVisible) {
              const text = await element.textContent().catch(() => 'Apply');
              logger.info({ text: text?.trim(), selector }, '✅ Found Apply button via ATS selector');

              await element.click();
              await this.sleep(2000); // Wait for navigation/modal
              return { clicked: true, text: text?.trim() };
            }
          }
        } catch (error) {
          // Try next selector
        }
      }

      // STEP 2: Try text-based matching with more variations
      const applyTexts = [
        'apply for this position',
        'apply for this role',
        'apply for job',
        'apply now',
        'apply for this job',
        'apply here',
        'apply online',
        'apply today',
        'apply',
        'submit application',
        'start application',
        'begin application',
        'i\'m interested',
        'easy apply',
        'quick apply'
      ];

      for (const text of applyTexts) {
        try {
          // Try buttons first
          const button = page.getByRole('button', { name: new RegExp(`^${text}$`, 'i') });
          const count = await button.count();

          if (count > 0) {
            const isVisible = await button.first().isVisible().catch(() => false);
            if (isVisible) {
              const buttonText = await button.first().textContent();
              logger.info({ buttonText, searchText: text }, '✅ Found Apply button by text');

              await button.first().click();
              await this.sleep(2000);
              return { clicked: true, text: buttonText };
            }
          }
        } catch (error) {
          // Try next variant
        }

        // Try links
        try {
          const link = page.getByRole('link', { name: new RegExp(text, 'i') });
          const count = await link.count();

          if (count > 0) {
            const isVisible = await link.first().isVisible().catch(() => false);
            if (isVisible) {
              const linkText = await link.first().textContent();
              logger.info({ linkText, searchText: text }, '✅ Found Apply link by text');

              await link.first().click();
              await this.sleep(2000);
              return { clicked: true, text: linkText };
            }
          }
        } catch (error) {
          // Try next variant
        }
      }

      // STEP 3: Try generic CSS selectors
      const genericSelectors = [
        'button:has-text("Apply")',
        'a:has-text("Apply")',
        '[class*="apply"][class*="button"]',
        '[class*="apply"][class*="btn"]',
        '[class*="Apply"]',
        '[data-qa*="apply"]',
        '#apply-button',
        '.apply-button',
        'a[href*="apply"]'
      ];

      for (const selector of genericSelectors) {
        try {
          const element = page.locator(selector).first();
          const count = await element.count();

          if (count > 0) {
            const isVisible = await element.isVisible().catch(() => false);
            if (isVisible) {
              const text = await element.textContent();
              logger.info({ text: text?.trim(), selector }, '✅ Found Apply button via generic selector');

              await element.click();
              await this.sleep(2000);
              return { clicked: true, text: text?.trim() };
            }
          }
        } catch (error) {
          // Try next selector
        }
      }

      // STEP 4: Look for any prominent CTA button in job description area
      try {
        const ctaSelectors = [
          '.job-details button:visible',
          '.job-description button:visible',
          '.careers-content button:visible',
          'main button:visible',
          'article button:visible'
        ];

        for (const selector of ctaSelectors) {
          try {
            const buttons = page.locator(selector);
            const count = await buttons.count();

            for (let i = 0; i < Math.min(count, 5); i++) {
              const btn = buttons.nth(i);
              const text = await btn.textContent().catch(() => '');
              const textLower = text?.toLowerCase() || '';

              if (textLower.includes('apply') || textLower.includes('submit') || textLower.includes('interested')) {
                logger.info({ text: text?.trim() }, '✅ Found Apply button in job content');
                await btn.click();
                await this.sleep(2000);
                return { clicked: true, text: text?.trim() };
              }
            }
          } catch (e) {
            // Continue
          }
        }
      } catch (e) {
        // Continue
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
      learning: this.learningSystem.getLearningSummary()
    };
  }

  /**
   * Comprehensive validation that application was properly submitted
   * Checks: required fields filled, no validation errors, form actually submitted
   *
   * @param {Page} page - Playwright page
   * @param {Object} fillResult - Result from fillFormIntelligently
   * @param {Object} submitResult - Result from submitForm (if available)
   * @returns {Object} Validation result with status and issues
   */
  async validateApplicationSubmission(page, fillResult, submitResult = null) {
    logger.info('🔍 Running comprehensive application submission validation...');

    const validation = {
      isValid: false,
      confidence: 0, // 0-100 confidence score
      issues: [],
      warnings: [],
      checks: {
        requiredFieldsFilled: false,
        noValidationErrors: false,
        formSubmitted: false,
        confirmationDetected: false,
        emailMatch: false
      },
      recommendation: 'UNKNOWN'
    };

    try {
      // CHECK 1: Verify required fields were actually filled
      const requiredFieldsCheck = await page.evaluate(() => {
        const result = {
          totalRequired: 0,
          filledRequired: 0,
          emptyRequired: [],
          invalidRequired: []
        };

        const requiredFields = document.querySelectorAll(
          'input[required], select[required], textarea[required], ' +
          '[aria-required="true"], .required input, .required select, .required textarea'
        );

        for (const field of requiredFields) {
          result.totalRequired++;
          const value = field.value?.trim() || '';
          const fieldName = field.name || field.id || field.getAttribute('aria-label') || 'unnamed';

          // Check if empty
          if (!value || value === '' || value === 'Select...' || value === 'Choose...') {
            result.emptyRequired.push(fieldName);
            continue;
          }

          // Check for validation error indicators on the field
          const hasError = field.classList.contains('error') ||
                          field.classList.contains('invalid') ||
                          field.getAttribute('aria-invalid') === 'true' ||
                          field.parentElement?.classList.contains('error');

          if (hasError) {
            result.invalidRequired.push({ name: fieldName, value });
          } else {
            result.filledRequired++;
          }
        }

        return result;
      });

      validation.checks.requiredFieldsFilled =
        requiredFieldsCheck.emptyRequired.length === 0 &&
        requiredFieldsCheck.invalidRequired.length === 0;

      if (requiredFieldsCheck.emptyRequired.length > 0) {
        validation.issues.push(`Empty required fields: ${requiredFieldsCheck.emptyRequired.join(', ')}`);
      }
      if (requiredFieldsCheck.invalidRequired.length > 0) {
        validation.issues.push(`Invalid required fields: ${requiredFieldsCheck.invalidRequired.map(f => f.name).join(', ')}`);
      }

      logger.info({
        totalRequired: requiredFieldsCheck.totalRequired,
        filledRequired: requiredFieldsCheck.filledRequired,
        emptyRequired: requiredFieldsCheck.emptyRequired.length,
        invalidRequired: requiredFieldsCheck.invalidRequired.length
      }, 'Required fields check');

      // CHECK 2: Look for validation error messages on the page
      const pageErrors = await page.evaluate(() => {
        const errors = [];
        const errorSelectors = [
          '.error-message', '.field-error', '.form-error', '.validation-error',
          '[class*="error-text"]', '[class*="error-msg"]',
          '[role="alert"]', '.alert-danger', '.alert-error',
          '.text-red-500', '.text-danger', '.text-error'
        ];

        for (const selector of errorSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            // Only count visible errors
            if (el.offsetParent !== null && el.textContent?.trim()) {
              const text = el.textContent.trim();
              // Filter out success messages that might match selectors
              if (!text.toLowerCase().includes('success') &&
                  !text.toLowerCase().includes('thank')) {
                errors.push(text.substring(0, 100)); // Limit length
              }
            }
          }
        }

        return [...new Set(errors)]; // Deduplicate
      });

      validation.checks.noValidationErrors = pageErrors.length === 0;

      if (pageErrors.length > 0) {
        validation.issues.push(...pageErrors.slice(0, 5)); // Max 5 errors
      }

      // CHECK 3: Form submission verification (if submitResult provided)
      if (submitResult) {
        validation.checks.formSubmitted = submitResult.success === true;

        if (!submitResult.success) {
          validation.issues.push(submitResult.error || 'Form submission failed');
        }
      } else {
        // Check if form is still visible (indicates not submitted)
        const formStillVisible = await page.evaluate(() => {
          const submitButtons = document.querySelectorAll(
            'button[type="submit"], input[type="submit"], ' +
            'button:has-text("Submit"), button:has-text("Apply")'
          );
          return Array.from(submitButtons).some(btn => btn.offsetParent !== null);
        });

        validation.checks.formSubmitted = !formStillVisible;

        if (formStillVisible) {
          validation.warnings.push('Form submit button still visible - form may not have been submitted');
        }
      }

      // CHECK 4: Look for confirmation/success indicators
      const confirmationCheck = await page.evaluate(() => {
        const indicators = {
          hasSuccessMessage: false,
          hasConfirmationNumber: false,
          hasThankYouPage: false,
          successText: null
        };

        // Success message patterns
        const successPatterns = [
          /thank\s*you/i,
          /application\s*(has\s*been\s*)?(received|submitted|sent)/i,
          /success(fully)?/i,
          /confirmation/i,
          /we('ve|\s*have)\s*received/i,
          /your\s*application/i
        ];

        // Check page text
        const bodyText = document.body.textContent || '';
        for (const pattern of successPatterns) {
          if (pattern.test(bodyText)) {
            indicators.hasSuccessMessage = true;
            const match = bodyText.match(pattern);
            if (match) {
              indicators.successText = match[0];
            }
            break;
          }
        }

        // Check for confirmation number/ID
        const confirmPatterns = [
          /confirmation\s*(number|id|#)[\s:]*([A-Z0-9-]+)/i,
          /reference\s*(number|id|#)[\s:]*([A-Z0-9-]+)/i,
          /application\s*(id|#)[\s:]*([A-Z0-9-]+)/i
        ];

        for (const pattern of confirmPatterns) {
          const match = bodyText.match(pattern);
          if (match) {
            indicators.hasConfirmationNumber = true;
            break;
          }
        }

        // Check URL for success indicators
        const url = window.location.href.toLowerCase();
        if (url.includes('success') || url.includes('thank') ||
            url.includes('confirm') || url.includes('complete')) {
          indicators.hasThankYouPage = true;
        }

        return indicators;
      });

      validation.checks.confirmationDetected =
        confirmationCheck.hasSuccessMessage ||
        confirmationCheck.hasConfirmationNumber ||
        confirmationCheck.hasThankYouPage;

      if (confirmationCheck.hasSuccessMessage) {
        logger.info({ successText: confirmationCheck.successText }, 'Success message detected');
      }

      // CHECK 5: Verify fill rate from fillResult
      if (fillResult) {
        const fillRate = fillResult.fieldsExtracted > 0
          ? fillResult.fieldsFilled / fillResult.fieldsExtracted
          : 0;

        if (fillRate < 0.7) {
          validation.warnings.push(`Only ${Math.round(fillRate * 100)}% of fields were filled`);
        }
      }

      // CALCULATE CONFIDENCE SCORE
      let confidenceScore = 0;

      // Required fields filled: 25 points
      if (validation.checks.requiredFieldsFilled) confidenceScore += 25;
      else if (requiredFieldsCheck.emptyRequired.length <= 1) confidenceScore += 15;

      // No validation errors: 25 points
      if (validation.checks.noValidationErrors) confidenceScore += 25;
      else if (pageErrors.length <= 2) confidenceScore += 10;

      // Form submitted: 25 points
      if (validation.checks.formSubmitted) confidenceScore += 25;

      // Confirmation detected: 25 points
      if (validation.checks.confirmationDetected) confidenceScore += 25;
      else if (submitResult?.urlChanged) confidenceScore += 15;

      validation.confidence = confidenceScore;

      // DETERMINE RECOMMENDATION
      if (confidenceScore >= 80) {
        validation.isValid = true;
        validation.recommendation = 'SUBMITTED';
      } else if (confidenceScore >= 50) {
        validation.isValid = true;
        validation.recommendation = 'LIKELY_SUBMITTED';
        validation.warnings.push('Application may have been submitted but confirmation unclear');
      } else if (confidenceScore >= 25) {
        validation.isValid = false;
        validation.recommendation = 'UNCERTAIN';
        validation.issues.push('Could not confirm application was submitted');
      } else {
        validation.isValid = false;
        validation.recommendation = 'FAILED';
      }

      logger.info({
        isValid: validation.isValid,
        confidence: validation.confidence,
        recommendation: validation.recommendation,
        checks: validation.checks,
        issueCount: validation.issues.length,
        warningCount: validation.warnings.length
      }, 'Application validation complete');

      return validation;

    } catch (error) {
      logger.error({ error: error.message }, 'Application validation failed');
      validation.issues.push(`Validation error: ${error.message}`);
      validation.recommendation = 'VALIDATION_ERROR';
      return validation;
    }
  }
}

export default AIFormFiller;
