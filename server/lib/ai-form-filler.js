/**
 * AI Form Filler
 * Intelligently fills forms using AI-generated responses with error recovery
 */

import AIFormExtractor from './ai-form-extractor.js';
import AIFormIntelligence from './ai-form-intelligence.js';
import AILearningSystem from './ai-learning-system.js';

class AIFormFiller {
  constructor() {
    this.extractor = new AIFormExtractor();
    this.intelligence = new AIFormIntelligence();
    this.learningSystem = new AILearningSystem();

    this.maxRetries = 3;
    this.typingDelay = 50; // ms between keystrokes for natural typing
  }

  /**
   * Complete AI-powered form filling flow
   * @param {Page} page - Puppeteer page object
   * @param {Object} userProfile - User's profile data
   * @param {Object} jobData - Job description and metadata
   * @returns {Object} Result of form filling
   */
  async fillFormIntelligently(page, userProfile, jobData) {
    console.log('🚀 Starting AI-powered form filling...');

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
        console.log('📖 Found learned patterns for this domain!');
        result.usedLearnedPatterns = true;
      }

      // Step 2: Extract all form fields
      console.log('📋 Extracting form fields...');
      const extraction = await this.extractor.extractComplete(page);

      result.fieldsExtracted = extraction.fields.length;
      result.hasCaptcha = extraction.hasCaptcha;
      result.complexity = extraction.complexity.complexity;

      if (extraction.hasCaptcha) {
        result.errors.push('CAPTCHA detected - manual intervention required');
        return result;
      }

      if (extraction.fields.length === 0) {
        result.errors.push('No form fields found on page');
        return result;
      }

      console.log(`✅ Found ${extraction.fields.length} fields (${extraction.complexity.complexity} complexity)`);

      // Step 3: Generate AI responses
      console.log('🤖 Generating AI responses for fields...');
      const aiResponses = await this.intelligence.generateFieldResponses(
        extraction.fields,
        userProfile,
        jobData
      );

      // Step 4: Validate AI responses
      console.log('✔️ Validating AI responses...');
      const validation = this.intelligence.validateResponses(aiResponses, extraction.fields);

      if (!validation.valid) {
        console.warn('⚠️ Validation found errors:', validation.errors);
        result.errors.push(...validation.errors.map(e => e.message));
      }
      if (validation.warnings.length > 0) {
        console.warn('⚠️ Validation warnings:', validation.warnings);
        result.warnings.push(...validation.warnings.map(w => w.message));
      }

      // Step 5: Fill the form
      console.log('✍️ Filling form fields...');
      const fillResult = await this.fillFields(page, extraction.fields, aiResponses);

      result.fieldsFilled = fillResult.filled;
      result.errors.push(...fillResult.errors);

      // Step 6: Handle any errors with screenshot analysis
      if (fillResult.errors.length > 0) {
        console.log('🔍 Errors detected, analyzing with AI vision...');
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
          console.log('🔄 Retrying with AI solution...');
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
        console.log('📤 Found submit button:', extraction.submitButton.text);
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

      result.success = result.fieldsFilled > 0 && result.errors.length === 0;

      console.log(`✅ Form filling complete: ${result.fieldsFilled}/${result.fieldsExtracted} fields filled`);
      console.log(`💰 Total cost: $${result.cost.toFixed(4)}`);

      return result;

    } catch (error) {
      console.error('❌ AI form filling failed:', error);
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

    for (const field of fields) {
      const response = responses[field.name];

      if (!response && !field.required) {
        // Skip optional empty fields
        continue;
      }

      if (!response && field.required) {
        result.errors.push(`No response for required field: ${field.name}`);
        continue;
      }

      try {
        await this.fillSingleField(page, field, response);
        result.filled++;

        // Small delay between fields to appear human
        await this.sleep(100 + Math.random() * 200);
      } catch (error) {
        console.error(`Failed to fill field ${field.name}:`, error.message);
        result.errors.push(`Failed to fill ${field.name}: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Fill a single form field
   */
  async fillSingleField(page, field, value) {
    console.log(`  Filling ${field.name} (${field.type}): ${field.label || 'No label'}`);

    // Try multiple selector strategies to find the element
    const selector = await this.findWorkingSelector(page, field);

    if (!selector) {
      throw new Error(`Field not found with any selector strategy: ${field.name}`);
    }

    console.log(`    Using selector: ${selector}`);

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
        await this.fillSelect(page, selector, value);
        break;

      case 'checkbox':
        await this.fillCheckbox(page, selector, value);
        break;

      case 'radio':
        await this.fillRadio(page, selector, value, field);
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
    // Try to select by value, then by text if that fails
    const success = await page.evaluate((sel, val) => {
      const element = document.querySelector(sel);
      if (!element) return false;

      // Try to find option by value
      let option = Array.from(element.options).find(opt => opt.value === val);

      // If not found, try by text content
      if (!option) {
        option = Array.from(element.options).find(opt =>
          opt.text.toLowerCase().includes(val.toLowerCase())
        );
      }

      if (option) {
        element.value = option.value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }

      return false;
    }, selector, String(value));

    if (!success) {
      console.warn(`    Could not select value "${value}" for select field`);
    }

    await this.sleep(50);
  }

  /**
   * Fill checkbox
   */
  async fillCheckbox(page, selector, value) {
    const shouldCheck = value === true || value === 'true' || value === 'yes' || value === 1;

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
    await page.click(selector);

    // Trigger change event
    await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, selector);
  }

  /**
   * Submit the form
   */
  async submitForm(page, submitButton) {
    if (!submitButton) {
      throw new Error('No submit button provided');
    }

    console.log(`📤 Clicking submit button: "${submitButton.text}"`);

    try {
      await page.click(submitButton.selector);

      // Wait for navigation or confirmation
      await Promise.race([
        page.waitForNavigation({ timeout: 10000 }),
        page.waitForSelector('.success, .confirmation, .thank-you', { timeout: 10000 }),
        this.sleep(3000)
      ]);

      console.log('✅ Form submitted successfully');
      return true;
    } catch (error) {
      console.error('❌ Form submission failed:', error.message);
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
