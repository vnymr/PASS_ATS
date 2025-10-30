/**
 * AI Form Extractor
 * Extracts ALL form fields from any web page for AI-powered filling
 */

import logger from './logger.js';

class AIFormExtractor {
  constructor() {
    this.fieldTypes = [
      'input[type="text"]',
      'input[type="email"]',
      'input[type="tel"]',
      'input[type="number"]',
      'input[type="url"]',
      'input[type="date"]',
      'input:not([type])',
      'textarea',
      'select',
      'input[type="radio"]',
      'input[type="checkbox"]'
    ];
  }

  /**
   * Extract all form fields from the current page
   * @param {Page} page - Puppeteer page object
   * @returns {Object} Extracted form data with fields and context
   */
  async extractFormFields(page) {
    logger.info('🔍 Extracting form fields from page...');

    const extraction = await page.evaluate(() => {
      const fields = [];
      const context = {
        pageTitle: document.title,
        pageUrl: window.location.href,
        companyName: '',
        jobTitle: ''
      };

      // Try to detect company and job title from page
      const h1 = document.querySelector('h1');
      if (h1) context.jobTitle = h1.textContent.trim();

      // Find all forms
      const forms = document.querySelectorAll('form');

      // If no forms, look for common application containers
      const containers = forms.length > 0
        ? forms
        : [document.body];

      containers.forEach((container, formIndex) => {
        // Extract all input fields
        const inputs = container.querySelectorAll(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'
        );

        inputs.forEach((input, fieldIndex) => {
          const fieldData = {
            id: input.id || `field_${formIndex}_${fieldIndex}`,
            name: input.name || input.id || `unnamed_${fieldIndex}`,
            type: input.type || input.tagName.toLowerCase(),
            label: '',
            placeholder: input.placeholder || '',
            required: input.required || input.hasAttribute('required'),
            value: input.value || '',
            visible: input.offsetParent !== null,
            selector: '',
            options: []
          };

          // Try to find associated label
          let label = null;
          if (input.id) {
            label = document.querySelector(`label[for="${input.id}"]`);
          }
          if (!label) {
            label = input.closest('label');
          }
          if (!label) {
            const parent = input.parentElement;
            label = parent?.querySelector('label');
          }
          if (!label) {
            // Look for text before the input
            const parent = input.parentElement;
            const textContent = parent?.textContent?.trim() || '';
            const words = textContent.split('\n')[0]?.trim();
            if (words && words.length < 100) {
              fieldData.label = words;
            }
          } else {
            fieldData.label = label.textContent.trim();
          }

          // Generate CSS selector with better specificity
          if (input.id) {
            fieldData.selector = `#${input.id}`;
          } else if (input.name) {
            // For radio/checkbox, include value for specific selection
            if ((input.type === 'radio' || input.type === 'checkbox') && input.value) {
              fieldData.selector = `input[name="${input.name}"][value="${input.value}"]`;
              fieldData.specificValue = input.value; // Store for later use
            } else {
              fieldData.selector = `[name="${input.name}"]`;
            }
          } else {
            // Generate unique selector
            let path = [];
            let element = input;
            while (element && element.tagName !== 'BODY') {
              let selector = element.tagName.toLowerCase();
              if (element.className) {
                const classes = element.className.split(' ').filter(c => c && c.trim());
                if (classes.length > 0) {
                  selector += '.' + classes.map(c => c.trim()).join('.');
                }
              }
              path.unshift(selector);
              element = element.parentElement;
              if (path.length > 5) break;
            }
            fieldData.selector = path.join(' > ');
          }

          // For select/dropdown fields, extract options
          if (input.tagName === 'SELECT') {
            const options = Array.from(input.querySelectorAll('option'));
            fieldData.options = options.map(opt => ({
              value: opt.value,
              text: opt.textContent.trim(),
              selected: opt.selected
            }));
          }

          // For radio/checkbox groups
          if (input.type === 'radio' || input.type === 'checkbox') {
            const groupName = input.name;
            const group = container.querySelectorAll(`input[name="${groupName}"]`);
            if (group.length > 1) {
              fieldData.options = Array.from(group).map(opt => {
                const optLabel = opt.closest('label')?.textContent.trim() ||
                               opt.nextSibling?.textContent?.trim() ||
                               opt.value;
                return {
                  value: opt.value,
                  text: optLabel,
                  checked: opt.checked
                };
              });
            }
          }

          // Only add visible fields or required fields
          if (fieldData.visible || fieldData.required) {
            fields.push(fieldData);
          }
        });
      });

      return { fields, context };
    });

    logger.info(`✅ Extracted ${extraction.fields.length} form fields`);
    return extraction;
  }

  /**
   * Extract page screenshot for AI vision analysis
   * @param {Page} page - Puppeteer page object
   * @returns {String} Base64 encoded screenshot
   */
  async captureScreenshot(page) {
    try {
      const screenshot = await page.screenshot({
        encoding: 'base64',
        fullPage: false,
        type: 'png'
      });
      return screenshot;
    } catch (error) {
      logger.error('Failed to capture screenshot:', error.message);
      return null;
    }
  }

  /**
   * Analyze form complexity
   * @param {Array} fields - Extracted fields
   * @returns {Object} Analysis result
   */
  analyzeComplexity(fields) {
    const analysis = {
      totalFields: fields.length,
      requiredFields: fields.filter(f => f.required).length,
      textFields: fields.filter(f => f.type === 'text' || f.type === 'textarea').length,
      selectFields: fields.filter(f => f.type === 'select').length,
      checkboxFields: fields.filter(f => f.type === 'checkbox').length,
      radioFields: fields.filter(f => f.type === 'radio').length,
      complexity: 'simple'
    };

    // Determine complexity
    if (analysis.totalFields > 20) {
      analysis.complexity = 'complex';
    } else if (analysis.totalFields > 10) {
      analysis.complexity = 'medium';
    }

    // Check for essay-type questions
    const hasEssayQuestions = fields.some(f =>
      f.type === 'textarea' ||
      (f.label && (
        f.label.toLowerCase().includes('why') ||
        f.label.toLowerCase().includes('tell us') ||
        f.label.toLowerCase().includes('describe')
      ))
    );

    if (hasEssayQuestions) {
      analysis.hasEssayQuestions = true;
      analysis.complexity = analysis.complexity === 'simple' ? 'medium' : 'complex';
    }

    return analysis;
  }

  /**
   * Detect if page has CAPTCHA
   * @param {Page} page - Puppeteer page object
   * @returns {Boolean} True if CAPTCHA detected
   */
  async detectCaptcha(page) {
    const hasCaptcha = await page.evaluate(() => {
      // Check for common CAPTCHA indicators
      const captchaIndicators = [
        'iframe[src*="recaptcha"]',
        'iframe[src*="hcaptcha"]',
        '.g-recaptcha',
        '.h-captcha',
        '#captcha',
        '[class*="captcha"]'
      ];

      return captchaIndicators.some(selector =>
        document.querySelector(selector) !== null
      );
    });

    return hasCaptcha;
  }

  /**
   * Find submit button
   * @param {Page} page - Puppeteer page object
   * @returns {Object} Submit button info
   */
  async findSubmitButton(page) {
    const submitButton = await page.evaluate(() => {
      // Common submit button patterns (without :contains pseudo-class)
      const patterns = [
        'button[type="submit"]',
        'input[type="submit"]',
        'a.submit',
        '.submit-button',
        'button.apply-button',
        '[data-qa="apply-button"]'
      ];

      for (const pattern of patterns) {
        try {
          const btn = document.querySelector(pattern);
          if (btn) {
            return {
              selector: pattern,
              text: btn.textContent || btn.value || 'Submit',
              visible: btn.offsetParent !== null
            };
          }
        } catch (e) {
          // Skip invalid selectors
          continue;
        }
      }

      // Fallback: find any button with submit-like text
      const buttons = Array.from(document.querySelectorAll('button, input[type="button"]'));
      const submitBtn = buttons.find(btn => {
        const text = (btn.textContent || btn.value || '').toLowerCase();
        return text.includes('submit') ||
               text.includes('apply') ||
               text.includes('send') ||
               text.includes('continue');
      });

      if (submitBtn) {
        return {
          selector: submitBtn.id ? `#${submitBtn.id}` : 'button',
          text: submitBtn.textContent || submitBtn.value,
          visible: submitBtn.offsetParent !== null
        };
      }

      return null;
    });

    return submitButton;
  }

  /**
   * Complete extraction with all metadata
   * @param {Page} page - Puppeteer page object
   * @returns {Object} Complete form extraction
   */
  async extractComplete(page) {
    const extraction = await this.extractFormFields(page);
    const complexity = this.analyzeComplexity(extraction.fields);
    const hasCaptcha = await this.detectCaptcha(page);
    const submitButton = await this.findSubmitButton(page);
    const screenshot = await this.captureScreenshot(page);

    return {
      ...extraction,
      complexity,
      hasCaptcha,
      submitButton,
      screenshot,
      timestamp: new Date().toISOString()
    };
  }
}

export default AIFormExtractor;
