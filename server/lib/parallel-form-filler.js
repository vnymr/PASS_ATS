/**
 * Parallel Form Filler
 * Fills all form fields at once instead of one-by-one
 *
 * Speed: 10 seconds → 1 second (10x faster!)
 * Method: Use page.evaluate to fill all fields in one go
 */

import logger from './logger.js';

/**
 * Escape CSS selector for IDs with special characters
 */
function escapeCssSelector(selector) {
  if (!selector) return selector;
  if (selector.startsWith('#')) {
    const id = selector.slice(1);
    if (/[\[\]():.~>+*^$|=!@%&]/.test(id) || /^\d/.test(id)) {
      return `[id="${id}"]`;
    }
  }
  return selector;
}

class ParallelFormFiller {
  constructor() {
    this.typingDelay = 20; // Reduced from 50ms for speed
  }

  /**
   * Fill all form fields in parallel
   */
  async fillAllFields(page, fields, responses) {
    logger.info(`📝 Filling ${fields.length} fields in parallel...`);

    const startTime = Date.now();

    try {
      // Prepare field data for batch filling (escape selectors with special characters)
      const fillData = fields.map(field => ({
        selector: escapeCssSelector(field.selector),
        name: field.name,
        type: field.type,
        value: responses[field.name],
        specificValue: field.specificValue,
        required: field.required
      })).filter(f => f.value !== undefined && f.value !== null);

      // Fill all fields at once using page.evaluate
      const result = await page.evaluate((fieldsData) => {
        const results = {
          filled: 0,
          skipped: 0,
          errors: []
        };

        fieldsData.forEach(field => {
          try {
            const element = document.querySelector(field.selector);

            if (!element) {
              // Try alternative selector
              let altElement = null;

              if (field.name) {
                altElement = document.querySelector(`[name="${field.name}"]`);
              }

              if (!altElement) {
                results.errors.push(`Field not found: ${field.selector}`);
                return;
              }

              // Use alternative
              element = altElement;
            }

            // Fill based on type
            switch (field.type) {
              case 'text':
              case 'email':
              case 'tel':
              case 'url':
              case 'number':
              case 'date':
              case 'time':
                element.value = String(field.value);
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                element.dispatchEvent(new Event('blur', { bubbles: true }));
                results.filled++;
                break;

              case 'textarea':
                element.value = String(field.value);
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                results.filled++;
                break;

              case 'select':
                // Find matching option
                const options = Array.from(element.options);
                const matchingOption = options.find(opt =>
                  opt.value === field.value ||
                  opt.text === field.value
                );

                if (matchingOption) {
                  element.value = matchingOption.value;
                  element.dispatchEvent(new Event('change', { bubbles: true }));
                  results.filled++;
                } else {
                  results.errors.push(`Option not found for ${field.name}: ${field.value}`);
                }
                break;

              case 'checkbox':
                // Handle checkbox
                const shouldCheck = field.value === true ||
                                  field.value === 'true' ||
                                  field.value === 'yes' ||
                                  field.value === '1' ||
                                  (Array.isArray(field.value) && field.specificValue && field.value.includes(field.specificValue));

                if (element.checked !== shouldCheck) {
                  element.checked = shouldCheck;
                  element.dispatchEvent(new Event('change', { bubbles: true }));
                  results.filled++;
                } else {
                  results.skipped++;
                }
                break;

              case 'radio':
                // Only click if this is the matching radio button
                if (field.specificValue && field.specificValue === field.value) {
                  element.checked = true;
                  element.dispatchEvent(new Event('change', { bubbles: true }));
                  results.filled++;
                } else if (!field.specificValue) {
                  // Find radio with matching value
                  const radios = document.querySelectorAll(`input[name="${field.name}"]`);
                  const matchingRadio = Array.from(radios).find(r => r.value === field.value);

                  if (matchingRadio) {
                    matchingRadio.checked = true;
                    matchingRadio.dispatchEvent(new Event('change', { bubbles: true }));
                    results.filled++;
                  } else {
                    results.errors.push(`Radio value not found: ${field.value}`);
                  }
                }
                break;

              default:
                // Try as text input
                element.value = String(field.value);
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                results.filled++;
            }
          } catch (error) {
            results.errors.push(`Error filling ${field.name}: ${error.message}`);
          }
        });

        return results;
      }, fillData);

      const duration = Date.now() - startTime;

      logger.info(`✅ Parallel fill complete in ${duration}ms`);
      logger.info(`   Filled: ${result.filled}/${fillData.length}`);
      logger.info(`   Skipped: ${result.skipped}`);

      if (result.errors.length > 0) {
        logger.warn(`   Errors: ${result.errors.length}`);
        result.errors.forEach(err => logger.debug(`   - ${err}`));
      }

      return {
        success: result.filled > 0,
        filled: result.filled,
        skipped: result.skipped,
        errors: result.errors,
        duration
      };

    } catch (error) {
      logger.error('❌ Parallel form filling failed:', error);
      return {
        success: false,
        filled: 0,
        errors: [error.message],
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Smart fill with retries for failed fields
   */
  async fillWithRetry(page, fields, responses, maxRetries = 2) {
    let attempt = 0;
    let result = null;

    while (attempt < maxRetries) {
      result = await this.fillAllFields(page, fields, responses);

      if (result.success && result.errors.length === 0) {
        // All fields filled successfully
        break;
      }

      if (result.errors.length > 0 && attempt < maxRetries - 1) {
        logger.info(`🔄 Retrying ${result.errors.length} failed fields (attempt ${attempt + 2}/${maxRetries})...`);

        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 500));

        // Retry only failed fields
        const failedFieldNames = result.errors
          .map(err => err.match(/Field not found: \[name="(.+?)"\]/)?.[1])
          .filter(Boolean);

        const failedFields = fields.filter(f => failedFieldNames.includes(f.name));

        if (failedFields.length > 0) {
          const retryResult = await this.fillAllFields(page, failedFields, responses);
          result.filled += retryResult.filled;
          result.errors = retryResult.errors;
        }
      }

      attempt++;
    }

    return result;
  }

  /**
   * Fill fields with human-like behavior (slower but more natural)
   */
  async fillWithHumanBehavior(page, fields, responses) {
    logger.info('👤 Filling fields with human-like behavior...');

    const result = {
      filled: 0,
      errors: []
    };

    for (const field of fields) {
      const value = responses[field.name];

      if (!value && !field.required) continue;
      if (!value && field.required) {
        result.errors.push(`Missing required field: ${field.name}`);
        continue;
      }

      try {
        // Check if element exists
        const exists = await page.evaluate((selector) => {
          return document.querySelector(selector) !== null;
        }, field.selector);

        if (!exists) {
          result.errors.push(`Field not found: ${field.selector}`);
          continue;
        }

        // Fill based on type
        switch (field.type) {
          case 'text':
          case 'email':
          case 'tel':
          case 'url':
            await page.click(field.selector);
            await page.keyboard.type(String(value), { delay: this.typingDelay });
            result.filled++;
            break;

          case 'textarea':
            await page.click(field.selector);
            await page.keyboard.type(String(value), { delay: 10 }); // Faster for long text
            result.filled++;
            break;

          case 'select':
            await page.select(field.selector, String(value));
            result.filled++;
            break;

          case 'checkbox':
          case 'radio':
            await page.click(field.selector);
            result.filled++;
            break;
        }

        // Random delay between fields (100-300ms)
        await new Promise(resolve =>
          setTimeout(resolve, 100 + Math.random() * 200)
        );

      } catch (error) {
        result.errors.push(`Error filling ${field.name}: ${error.message}`);
      }
    }

    return {
      success: result.filled > 0,
      filled: result.filled,
      errors: result.errors
    };
  }
}

export default ParallelFormFiller;
