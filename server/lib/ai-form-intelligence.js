/**
 * AI Form Intelligence
 * Uses OpenAI GPT-4 to intelligently fill form fields and solve problems via screenshots
 */

import OpenAI from 'openai';

class AIFormIntelligence {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.costTracker = {
      totalTokens: 0,
      totalCost: 0,
      requests: 0
    };
  }

  /**
   * Generate intelligent responses for all form fields
   * @param {Array} fields - Extracted form fields
   * @param {Object} userProfile - User's profile data
   * @param {Object} jobData - Job description and metadata
   * @returns {Object} AI-generated field responses
   */
  async generateFieldResponses(fields, userProfile, jobData) {
    console.log('🤖 Asking AI to generate field responses...');

    const prompt = this.buildFormFillingPrompt(fields, userProfile, jobData);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert job application assistant. Your job is to intelligently fill out job application forms based on the user's profile and the job requirements.

CRITICAL RULES:
1. Return ONLY valid JSON, no markdown, no explanation
2. Every field must have a response
3. Answers must be truthful based on user profile
4. Match the expected format (date format, number format, etc.)
5. For essay questions, write compelling 2-3 paragraph responses
6. For "why" questions, relate user's experience to the specific job
7. Keep text field responses concise unless it's a textarea
8. For select/dropdown fields, choose the EXACT value from options
9. For checkboxes/radios, return true/false or the value
10. Be professional and enthusiastic`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const content = response.choices[0].message.content.trim();

      // Track costs
      this.updateCostTracking(response.usage);

      // Parse JSON response
      let fieldResponses;
      try {
        // Remove markdown code blocks if present
        const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        fieldResponses = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error('❌ Failed to parse AI response as JSON:', content);
        throw new Error('AI returned invalid JSON');
      }

      console.log(`✅ AI generated responses for ${Object.keys(fieldResponses).length} fields`);
      console.log(`💰 Cost: $${this.costTracker.totalCost.toFixed(4)} (${this.costTracker.totalTokens} tokens)`);

      return fieldResponses;
    } catch (error) {
      console.error('❌ AI form filling failed:', error.message);
      throw error;
    }
  }

  /**
   * Build prompt for form filling
   */
  buildFormFillingPrompt(fields, userProfile, jobData) {
    const fieldsDescription = fields.map(field => {
      let desc = `- ${field.name} (${field.type})`;
      if (field.label) desc += `: "${field.label}"`;
      if (field.placeholder) desc += ` [placeholder: "${field.placeholder}"]`;
      if (field.required) desc += ' [REQUIRED]';
      if (field.options && field.options.length > 0) {
        desc += `\n  Options: ${field.options.map(o => o.text || o.value).join(', ')}`;
      }
      return desc;
    }).join('\n');

    return `Job Application Form Filling Task

JOB DETAILS:
Title: ${jobData.title || 'Not specified'}
Company: ${jobData.company || 'Not specified'}
Description: ${jobData.description ? jobData.description.substring(0, 500) : 'Not provided'}

USER PROFILE:
Name: ${userProfile.fullName || userProfile.firstName + ' ' + userProfile.lastName || 'Not provided'}
Email: ${userProfile.email || 'Not provided'}
Phone: ${userProfile.phone || 'Not provided'}
Location: ${userProfile.location || 'Not provided'}
LinkedIn: ${userProfile.linkedIn || 'Not provided'}
Portfolio: ${userProfile.portfolio || 'Not provided'}

Work Experience:
${userProfile.experience ? userProfile.experience.map(exp =>
  `- ${exp.title} at ${exp.company} (${exp.duration || ''})`
).join('\n') : 'Not provided'}

Education:
${userProfile.education ? userProfile.education.map(edu =>
  `- ${edu.degree} in ${edu.field} from ${edu.school}`
).join('\n') : 'Not provided'}

Skills: ${userProfile.skills ? userProfile.skills.join(', ') : 'Not provided'}

FORM FIELDS TO FILL:
${fieldsDescription}

TASK:
Generate intelligent, truthful responses for ALL fields above. Return as JSON object with field names as keys.

For essay/textarea questions (like "Why do you want this job?"):
- Write 2-3 compelling paragraphs
- Connect user's experience to the specific job
- Show enthusiasm and cultural fit
- Be specific, not generic

For select/dropdown fields:
- Choose the EXACT value from the options list
- Pick the most appropriate match

RETURN FORMAT (JSON only, no markdown):
{
  "fieldName1": "response1",
  "fieldName2": "response2",
  "essayField": "Multi-paragraph response here...",
  "selectField": "Exact option value"
}`;
  }

  /**
   * Analyze screenshot to solve problems
   * @param {String} screenshotBase64 - Base64 encoded screenshot
   * @param {String} problem - Description of the problem
   * @param {Object} context - Additional context
   * @returns {Object} AI's solution
   */
  async analyzeScreenshotAndSolve(screenshotBase64, problem, context = {}) {
    console.log('👁️ Asking AI to analyze screenshot and solve problem...');

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',  // Vision model
        messages: [
          {
            role: 'system',
            content: `You are an expert at analyzing web page screenshots and solving form-filling problems.

When you see an error or issue:
1. Identify what went wrong
2. Suggest the exact fix
3. Return structured JSON with the solution

Return format:
{
  "issue": "Description of what went wrong",
  "solution": "Specific action to take",
  "fieldToRetry": "field_name or null",
  "newValue": "corrected value or null",
  "needsManualIntervention": false/true,
  "learnedPattern": "Pattern to remember for future"
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `PROBLEM: ${problem}

CONTEXT:
${JSON.stringify(context, null, 2)}

Analyze the screenshot and provide a solution.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${screenshotBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.5
      });

      const content = response.choices[0].message.content.trim();
      this.updateCostTracking(response.usage);

      // Parse solution
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const solution = JSON.parse(jsonContent);

      console.log('✅ AI analyzed screenshot and provided solution');
      console.log('💡 Solution:', solution.solution);

      return solution;
    } catch (error) {
      console.error('❌ Screenshot analysis failed:', error.message);
      return {
        issue: 'Failed to analyze screenshot',
        solution: 'Manual intervention required',
        needsManualIntervention: true
      };
    }
  }

  /**
   * Validate AI-generated responses against field constraints
   * @param {Object} responses - AI-generated responses
   * @param {Array} fields - Form fields with constraints
   * @returns {Object} Validation results
   */
  validateResponses(responses, fields) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };

    fields.forEach(field => {
      const response = responses[field.name];

      // Check required fields
      if (field.required && (!response || response === '')) {
        validation.valid = false;
        validation.errors.push({
          field: field.name,
          message: 'Required field is empty'
        });
      }

      // Check field type constraints
      if (response) {
        // Email validation
        if (field.type === 'email' && !this.isValidEmail(response)) {
          validation.errors.push({
            field: field.name,
            message: 'Invalid email format'
          });
        }

        // Phone validation
        if (field.type === 'tel' && !this.isValidPhone(response)) {
          validation.warnings.push({
            field: field.name,
            message: 'Phone format may be invalid'
          });
        }

        // URL validation
        if (field.type === 'url' && !this.isValidUrl(response)) {
          validation.errors.push({
            field: field.name,
            message: 'Invalid URL format'
          });
        }

        // Number validation
        if (field.type === 'number' && isNaN(response)) {
          validation.errors.push({
            field: field.name,
            message: 'Must be a number'
          });
        }

        // Select field - value must be in options
        if (field.type === 'select' && field.options && field.options.length > 0) {
          const validValues = field.options.map(o => o.value);
          if (!validValues.includes(response)) {
            validation.errors.push({
              field: field.name,
              message: `Value must be one of: ${validValues.join(', ')}`
            });
          }
        }

        // Maxlength check
        if (field.maxLength && response.length > field.maxLength) {
          validation.warnings.push({
            field: field.name,
            message: `Response may be too long (${response.length}/${field.maxLength} chars)`
          });
        }
      }
    });

    return validation;
  }

  // Validation helpers
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  isValidPhone(phone) {
    return /^[\d\s\-\+\(\)]+$/.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update cost tracking
   */
  updateCostTracking(usage) {
    this.costTracker.requests++;
    this.costTracker.totalTokens += usage.total_tokens;

    // GPT-4o-mini pricing: $0.150/1M input, $0.600/1M output
    const inputCost = (usage.prompt_tokens / 1_000_000) * 0.15;
    const outputCost = (usage.completion_tokens / 1_000_000) * 0.60;
    this.costTracker.totalCost += inputCost + outputCost;
  }

  /**
   * Get cost summary
   */
  getCostSummary() {
    return {
      totalRequests: this.costTracker.requests,
      totalTokens: this.costTracker.totalTokens,
      totalCost: this.costTracker.totalCost,
      avgCostPerRequest: this.costTracker.requests > 0
        ? this.costTracker.totalCost / this.costTracker.requests
        : 0
    };
  }

  /**
   * Reset cost tracking
   */
  resetCostTracking() {
    this.costTracker = {
      totalTokens: 0,
      totalCost: 0,
      requests: 0
    };
  }
}

export default AIFormIntelligence;
