/**
 * AI Form Intelligence
 * Uses Google Gemini to intelligently fill form fields and solve problems via screenshots
 */

import logger, { aiLogger } from './logger.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

class AIFormIntelligence {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.warn('GEMINI_API_KEY not configured, AI form intelligence will not work');
    }
    this.genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
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
    logger.info('🤖 Asking AI (Gemini) to generate field responses...');

    if (!this.genAI) {
      throw new Error('Gemini AI client not initialized. Check GEMINI_API_KEY configuration.');
    }

    const prompt = this.buildFormFillingPrompt(fields, userProfile, jobData);

    const systemPrompt = `You are an EXPERT job application assistant with COMPLETE ACCESS to user information. Your job is to intelligently fill out EVERY field in job application forms.

CRITICAL RULES:
1. Return ONLY valid JSON, no markdown, no explanation
2. EVERY field MUST have a response - use ALL available user data
3. Make INTELLIGENT INFERENCES for missing data based on profile
4. Answers must be truthful but persuasive
5. Match the expected format exactly (date format, number format, exact option values)
6. For essay questions, write compelling 2-4 paragraph responses with SPECIFIC examples
7. For "why" questions, relate user's SPECIFIC experience to the job
8. ⚠️  For select/dropdown fields: CRITICAL - You MUST choose from EXACT values shown in options list. DO NOT invent values. Use the "value" field provided.
9. For radio buttons, return the exact value to select
10. For checkbox groups, return an array of values to check
11. For yes/no questions, make intelligent defaults based on user profile
12. Be professional, enthusiastic, and comprehensive
13. AT ANY COST, provide ALL information needed to fill the form completely`;

    try {
      // Note: Don't use Google Search grounding here - it breaks JSON output
      // Form filling uses user profile data, not web search
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        systemInstruction: systemPrompt,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8000,
          responseMimeType: 'application/json'
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const content = response.text().trim();

      // Track costs (estimate for Gemini)
      const estimatedUsage = {
        prompt_tokens: Math.ceil(prompt.length / 4),
        completion_tokens: Math.ceil(content.length / 4),
        total_tokens: Math.ceil((prompt.length + content.length) / 4)
      };
      this.updateCostTracking(estimatedUsage);

      // Parse JSON response
      let fieldResponses;
      try {
        // Remove markdown code blocks if present (Gemini should return pure JSON with responseMimeType)
        const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        fieldResponses = JSON.parse(jsonContent);
      } catch (parseError) {
        logger.error('❌ Failed to parse AI response as JSON:', content.substring(0, 500));
        throw new Error('AI returned invalid JSON');
      }

      logger.info(`✅ AI generated responses for ${Object.keys(fieldResponses).length} fields`);
      logger.info(`💰 Cost: $${this.costTracker.totalCost.toFixed(4)} (${this.costTracker.totalTokens} tokens)`);

      // Log AI decisions for transparency
      logger.info('\n🧠 AI DECISIONS:');
      Object.entries(fieldResponses).slice(0, 10).forEach(([field, value]) => {
        const fieldInfo = fields.find(f => f.name === field);
        if (fieldInfo) {
          let displayValue = String(value);
          if (displayValue.length > 60) {
            displayValue = displayValue.substring(0, 60) + '...';
          }
          logger.info(`   ${field} (${fieldInfo.type}): ${displayValue}`);
        }
      });
      if (Object.keys(fieldResponses).length > 10) {
        logger.info(`   ... and ${Object.keys(fieldResponses).length - 10} more fields`);
      }
      logger.info('');

      return fieldResponses;
    } catch (error) {
      logger.error('❌ AI form filling failed:', error.message);
      throw error;
    }
  }

  /**
   * Build prompt for form filling with COMPLETE user profile data
   */
  buildFormFillingPrompt(fields, userProfile, jobData) {
    const fieldsDescription = fields.map(field => {
      let desc = `- ${field.name} (${field.type})`;
      if (field.label) desc += `: "${field.label}"`;
      if (field.placeholder) desc += ` [placeholder: "${field.placeholder}"]`;
      if (field.required) desc += ' [REQUIRED]';
      if (field.options && field.options.length > 0) {
        // For select/dropdown fields, show options in a clear format with values
        if (field.type === 'select' || field.type === 'select-one' || field.type === 'select-multiple') {
          desc += `\n  ⚠️  MUST choose from these EXACT options:`;
          field.options.forEach(opt => {
            desc += `\n      - "${opt.text}" (value: "${opt.value}")`;
          });
        } else {
          desc += `\n  Options: ${field.options.map(o => o.text || o.value).join(', ')}`;
        }
      }
      return desc;
    }).join('\n');

    // Format work experience with ALL details
    const experienceDetails = userProfile.experience && userProfile.experience.length > 0
      ? userProfile.experience.map(exp => {
          let details = `- ${exp.title || exp.position || 'Position'} at ${exp.company || 'Company'}`;
          if (exp.duration) details += ` (${exp.duration})`;
          if (exp.startDate || exp.endDate) {
            details += ` [${exp.startDate || 'Start'} - ${exp.endDate || 'Present'}]`;
          }
          if (exp.description) details += `\n  Description: ${exp.description}`;
          if (exp.achievements) details += `\n  Achievements: ${Array.isArray(exp.achievements) ? exp.achievements.join('; ') : exp.achievements}`;
          if (exp.technologies) details += `\n  Technologies: ${Array.isArray(exp.technologies) ? exp.technologies.join(', ') : exp.technologies}`;
          return details;
        }).join('\n\n')
      : 'Not provided';

    // Format education with ALL details
    const educationDetails = userProfile.education && userProfile.education.length > 0
      ? userProfile.education.map(edu => {
          let details = `- ${edu.degree || 'Degree'} in ${edu.field || edu.major || 'Field'}`;
          details += ` from ${edu.school || edu.institution || 'Institution'}`;
          if (edu.year || edu.graduationDate) details += ` (${edu.year || edu.graduationDate})`;
          if (edu.gpa) details += `\n  GPA: ${edu.gpa}`;
          if (edu.honors) details += `\n  Honors: ${edu.honors}`;
          if (edu.courses) details += `\n  Relevant Courses: ${Array.isArray(edu.courses) ? edu.courses.join(', ') : edu.courses}`;
          return details;
        }).join('\n\n')
      : 'Not provided';

    // Format pre-answered application questions
    const appQuestions = userProfile.applicationQuestions || {};
    const hasPreAnswers = Object.keys(appQuestions).length > 0;
    const preAnswersSection = hasPreAnswers ? `

=== PRE-ANSWERED APPLICATION QUESTIONS ===
The user has pre-answered the following common questions. USE THESE ANSWERS EXACTLY when you encounter matching fields:

${Object.entries(appQuestions).filter(([_, value]) => value).map(([key, value]) => {
      // Convert camelCase to readable format
      const readableKey = key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
      return `- ${readableKey}: ${value}`;
    }).join('\n')}

IMPORTANT: When a form field matches any of these pre-answered questions (by name, label, or meaning), use the pre-answered value EXACTLY. Do NOT generate a new answer.
` : '';

    return `Job Application Form Filling Task

You are an expert form-filling AI with COMPLETE ACCESS to the user's profile. Your job is to provide accurate, comprehensive, and intelligent responses to ALL form fields.

=== JOB DETAILS ===
Title: ${jobData.title || 'Not specified'}
Company: ${jobData.company || 'Not specified'}
Description: ${jobData.description || 'Not provided'}
${preAnswersSection}
=== COMPLETE USER PROFILE ===

PERSONAL INFORMATION:
- Full Name: ${userProfile.fullName || (userProfile.firstName && userProfile.lastName ? `${userProfile.firstName} ${userProfile.lastName}` : 'Not provided')}
- First Name: ${userProfile.firstName || userProfile.fullName?.split(' ')[0] || 'Not provided'}
- Last Name: ${userProfile.lastName || userProfile.fullName?.split(' ').slice(1).join(' ') || 'Not provided'}
- Email: ${userProfile.email || 'Not provided'}
- Phone: ${userProfile.phone || 'Not provided'}
- Location: ${userProfile.location || userProfile.address || 'Not provided'}
- LinkedIn: ${userProfile.linkedIn || userProfile.linkedin || 'Not provided'}
- Portfolio/Website: ${userProfile.portfolio || userProfile.website || 'Not provided'}
- GitHub: ${userProfile.github || 'Not provided'}

WORK EXPERIENCE (with full details):
${experienceDetails}

EDUCATION (with full details):
${educationDetails}

SKILLS & EXPERTISE:
${userProfile.skills && userProfile.skills.length > 0
  ? '- ' + userProfile.skills.join('\n- ')
  : 'Not provided'}

CERTIFICATIONS:
${userProfile.certifications && userProfile.certifications.length > 0
  ? userProfile.certifications.map(c => `- ${c.name || c} (${c.issuer || ''} ${c.year || ''})`).join('\n')
  : 'Not provided'}

ADDITIONAL INFO:
- Summary/Bio: ${userProfile.summary || userProfile.bio || 'Not provided'}
- Years of Experience: ${userProfile.yearsOfExperience || 'Calculate from work history'}
- Current Title: ${userProfile.currentTitle || userProfile.experience?.[0]?.title || 'Not provided'}

=== FORM FIELDS TO FILL ===
${fieldsDescription}

=== YOUR TASK ===
Generate intelligent, truthful, and compelling responses for EVERY field above.

CRITICAL INSTRUCTIONS:
1. **PRIORITY #1**: If the user has a pre-answered question that matches a form field, use that answer EXACTLY
2. Use ALL available user data - don't leave any information unused
3. For missing data, make INTELLIGENT INFERENCES based on available information
4. Be truthful but persuasive - show the user in the best light
5. Match the exact format and value expected by each field
6. For essay/textarea questions:
   - Write 2-4 compelling paragraphs
   - Connect user's SPECIFIC experience to the job requirements
   - Use concrete examples from user's work history
   - Show enthusiasm, cultural fit, and unique value
   - Be specific, NOT generic

7. For select/dropdown fields (CRITICAL):
   - You MUST choose from the EXACT values provided in the options list
   - Return the "value" field, NOT the "text" field (unless they're the same)
   - If multiple options seem valid, choose the one that best matches the user's profile
   - DO NOT make up or invent dropdown values - only use what's provided
   - Example: If options are "Fluent" (value: "fluent"), "Native" (value: "native"), choose "fluent" or "native", NOT "Advanced"

8. For yes/no questions:
   - Check pre-answered questions FIRST
   - If no pre-answer: Consider legal authorization: default to "Yes" if user is in US/has work history in US
   - If no pre-answer: Consider visa sponsorship: default to "No" if user appears to be citizen
   - If no pre-answer: Consider conflicts of interest: default to "No" unless specified
   - Use intelligent defaults based on profile

8b. For consent/agreement checkboxes (IMPORTANT):
   - ANY checkbox about "agree", "consent", "acknowledge", "terms", "privacy", "data retention", "GDPR", or "future opportunities" should ALWAYS be set to true
   - These are typically required for application processing
   - Return true (boolean) for these checkboxes

9. For date fields: Use ISO format (YYYY-MM-DD) or format specified in field

10. For phone fields: Use user's phone number exactly as provided

11. For work authorization questions:
    - Check pre-answered questions FIRST
    - Legally authorized: Infer from location/work history
    - Visa sponsorship: Infer from citizenship/location
    - Be realistic and truthful

RETURN FORMAT (JSON only, NO markdown, NO explanations):
{
  "fieldName1": "response1",
  "fieldName2": "response2",
  "essayField": "Multi-paragraph compelling response with specific examples from user's experience...",
  "selectField": "exact_option_value_from_list",
  "radioField": "selected_value",
  "checkboxField": ["value1", "value2", "value3"],
  "yesNoField": "Yes" or "No"
}

REMEMBER: You have COMPLETE user data. Provide ALL information needed. Be comprehensive and intelligent.`;
  }

  /**
   * Analyze screenshot to solve problems
   * @param {String} screenshotBase64 - Base64 encoded screenshot
   * @param {String} problem - Description of the problem
   * @param {Object} context - Additional context
   * @returns {Object} AI's solution
   */
  async analyzeScreenshotAndSolve(screenshotBase64, problem, context = {}) {
    logger.info('👁️ Asking AI (Gemini) to analyze screenshot and solve problem...');

    if (!this.genAI) {
      logger.error('Gemini AI client not initialized');
      return {
        issue: 'AI client not available',
        solution: 'Manual intervention required',
        needsManualIntervention: true
      };
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
          responseMimeType: 'application/json'
        }
      });

      const systemPrompt = `You are an expert at analyzing web page screenshots and solving form-filling problems.

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
}`;

      const prompt = `${systemPrompt}

PROBLEM: ${problem}

CONTEXT:
${JSON.stringify(context, null, 2)}

Analyze the screenshot and provide a solution.`;

      // Gemini multimodal: pass image as inline data
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: 'image/png',
            data: screenshotBase64
          }
        }
      ]);

      const response = await result.response;
      const content = response.text().trim();

      // Track costs (estimate)
      const estimatedUsage = {
        prompt_tokens: Math.ceil(prompt.length / 4) + 1000, // Add estimate for image
        completion_tokens: Math.ceil(content.length / 4),
        total_tokens: Math.ceil((prompt.length + content.length) / 4) + 1000
      };
      this.updateCostTracking(estimatedUsage);

      // Parse solution
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const solution = JSON.parse(jsonContent);

      logger.info('✅ AI analyzed screenshot and provided solution');
      logger.info('💡 Solution:', solution.solution);

      return solution;
    } catch (error) {
      logger.error('❌ Screenshot analysis failed:', error.message);
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

    // Gemini 2.0 Flash pricing: $0.10/1M input, $0.40/1M output
    const inputCost = (usage.prompt_tokens / 1_000_000) * 0.10;
    const outputCost = (usage.completion_tokens / 1_000_000) * 0.40;
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
