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
   * Detect and extract options from custom dropdown fields
   * Many modern sites (like Greenhouse) use custom dropdowns instead of native <select>
   * @param {Page} page - Playwright page object
   * @param {Array} fields - Fields extracted from page
   * @returns {Array} Fields with updated custom dropdown info
   */
  async detectCustomDropdowns(page, fields) {
    logger.info('🔍 Detecting custom dropdowns...');

    // Identify potential custom dropdowns using multiple detection strategies
    const customDropdownCandidates = await page.evaluate((fieldsList) => {
      return fieldsList.filter(field => {
        if (field.type !== 'text') return false;

        const elem = document.querySelector(field.selector);
        if (!elem) return false;

        // Strategy 1: Role-based detection (Greenhouse, modern sites)
        const role = elem.getAttribute('role');
        if (role === 'combobox' || role === 'listbox') return true;

        // Strategy 2: Class-based detection (Greenhouse: select__input)
        const className = elem.className || '';
        if (className.includes('select__input') ||
            className.includes('select-input') ||
            className.includes('dropdown-input') ||
            className.includes('combobox')) return true;

        // Strategy 3: Placeholder-based detection
        const placeholder = elem.placeholder || '';
        if (placeholder.toLowerCase().includes('select') ||
            placeholder === '...' ||
            placeholder.toLowerCase().startsWith('choose')) return true;

        // Strategy 4: Readonly + click behavior (some custom dropdowns)
        if (elem.readOnly && elem.onclick) return true;

        return false;
      }).map(f => f.name);
    }, fields);

    // Filter original fields array based on detected names
    const detectedFields = fields.filter(f => customDropdownCandidates.includes(f.name));

    if (detectedFields.length === 0) {
      logger.info('No custom dropdowns detected');
      return fields;
    }

    logger.info(`Found ${detectedFields.length} potential custom dropdowns`);

    // Try to extract options from each custom dropdown
    for (const field of detectedFields) {
      try {
        const options = await this.extractCustomDropdownOptions(page, field);

        if (options && options.length > 0) {
          // Update field to be a select type with options
          field.type = 'select';
          field.options = options;
          field.isCustomDropdown = true;
          logger.info(`✅ Extracted ${options.length} options from custom dropdown: ${field.name}`);
        }
      } catch (error) {
        logger.warn(`Failed to extract options from ${field.name}: ${error.message}`);
      }
    }

    return fields;
  }

  /**
   * Extract options from a single custom dropdown by clicking it
   * @param {Page} page - Playwright page object
   * @param {Object} field - Field metadata
   * @returns {Array} Dropdown options
   */
  async extractCustomDropdownOptions(page, field) {
    const options = await page.evaluate((fieldSelector) => {
      const input = document.querySelector(fieldSelector);
      if (!input) return null;

      // Click the input to reveal dropdown
      input.click();
      input.focus();

      // Wait a bit for dropdown to appear (synchronous wait in browser context)
      const startTime = Date.now();
      const maxWait = 1000; // 1 second

      // Look for dropdown menu that appeared
      // Common patterns for custom dropdowns
      const dropdownSelectors = [
        // Greenhouse specific
        'ul[role="listbox"]',
        'div[role="listbox"]',
        '.select-options',
        '.dropdown-menu',
        '[class*="dropdown"][class*="menu"]',
        '[class*="select"][class*="menu"]',
        'ul.options',
        'div.options',
        // Generic patterns
        'ul[aria-expanded="true"]',
        'div[aria-expanded="true"]'
      ];

      let dropdownMenu = null;
      while (!dropdownMenu && (Date.now() - startTime) < maxWait) {
        for (const selector of dropdownSelectors) {
          const menu = document.querySelector(selector);
          if (menu && menu.offsetParent !== null) {
            dropdownMenu = menu;
            break;
          }
        }
      }

      if (!dropdownMenu) {
        // Try to find any visible ul/div that appeared near the input
        const parent = input.closest('div');
        if (parent) {
          const visibleMenus = parent.querySelectorAll('ul, div[role="listbox"]');
          for (const menu of visibleMenus) {
            if (menu.offsetParent !== null && menu !== input) {
              dropdownMenu = menu;
              break;
            }
          }
        }
      }

      if (!dropdownMenu) return null;

      // Extract options from menu
      const optionElements = Array.from(
        dropdownMenu.querySelectorAll('li, div[role="option"], [data-option]')
      );

      const extractedOptions = optionElements
        .filter(opt => opt.offsetParent !== null) // Only visible options
        .map(opt => {
          const text = opt.textContent?.trim() || '';
          const value = opt.getAttribute('data-value') ||
                       opt.getAttribute('value') ||
                       text;

          return {
            value: value,
            text: text,
            selected: false
          };
        })
        .filter(opt => opt.text && opt.text.length > 0 && opt.text !== 'Select...');

      // Close dropdown by clicking input again or pressing Escape
      input.blur();
      document.body.click(); // Click elsewhere to close

      return extractedOptions;
    }, field.selector);

    // Give page a moment to close dropdown
    await this.sleep(100);

    return options;
  }

  /**
   * Extract all form fields from the current page
   * @param {Page} page - Playwright page object
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
   * @param {Page} page - Playwright page object
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
   * @param {Page} page - Playwright page object
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
   * @param {Page} page - Playwright page object
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
   * @param {Page} page - Playwright page object
   * @returns {Object} Complete form extraction
   */
  async extractComplete(page) {
    const extraction = await this.extractFormFields(page);

    // Detect and extract custom dropdowns (Greenhouse, Lever, etc.)
    extraction.fields = await this.detectCustomDropdowns(page, extraction.fields);

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

  /**
   * Helper: sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default AIFormExtractor;
