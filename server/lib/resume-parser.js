import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import aiClient from './ai-client.js';
import cacheManager from './cache-manager.js';
import ResumeTextValidator from './resume-text-validator.js';
import SimpleResumeParser from './simple-resume-parser.js';
import crypto from 'crypto';

class ResumeParser {
  constructor() {
    // Use shared AI client (singleton) - NO new OpenAI() instances!
    this.aiClient = aiClient;
    this.cache = cacheManager;
    this.validator = new ResumeTextValidator();
    this.simpleParser = new SimpleResumeParser();
  }

  /**
   * Generate hash for resume content (for caching)
   */
  _generateHash(text) {
    return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);
  }

  async parseResume(buffer, mimeType) {
    let text = '';

    try {
      // Parse based on file type
      if (mimeType === 'application/pdf') {
        // Parse PDF
        const pdfData = await pdfParse(buffer);
        text = pdfData.text;
        console.log('✅ PDF parsed, extracted', text.length, 'characters');
      }
      else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // Parse DOCX (Word 2007+)
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
        console.log('✅ DOCX parsed, extracted', text.length, 'characters');
      }
      else if (mimeType === 'application/msword') {
        // Parse DOC (Word 97-2003)
        // Note: mammoth has limited support for old .doc files
        try {
          const result = await mammoth.extractRawText({ buffer });
          text = result.value;
          console.log('✅ DOC parsed, extracted', text.length, 'characters');
        } catch (docError) {
          console.error('DOC parse error:', docError);
          throw new Error('Cannot parse old .doc format. Please save as .docx or .pdf and try again.');
        }
      }
      else if (mimeType === 'text/plain') {
        // Parse TXT
        text = buffer.toString('utf-8');
        console.log('✅ TXT file read, extracted', text.length, 'characters');
      }
      else {
        throw new Error(`Unsupported file format: ${mimeType}. Please upload PDF, DOCX, DOC, or TXT files.`);
      }

      // Clean up extracted text
      text = text
        .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
        .replace(/\n{3,}/g, '\n\n')     // Replace multiple newlines with double newline
        .trim();

      // Validate extracted text
      if (!text || text.length < 50) {
        throw new Error('Could not extract sufficient text from the document. The file may be empty, corrupted, or contain only images.');
      }

      // OPTIMIZATION: Validate text quality before using AI
      console.log('🔍 Validating resume text quality...');
      const validation = this.validator.validate(text);

      console.log(`📊 Resume quality score: ${validation.score}/${validation.maxScore}`);
      console.log(`   - Has basic info: ${validation.hasBasicInfo}`);
      console.log(`   - Has sections: ${validation.hasSections} (${validation.details.sectionCount} found)`);
      console.log(`   - Has dates: ${validation.hasDates} (${validation.details.dateCount} found)`);
      console.log(`   - Well structured: ${validation.isWellStructured}`);

      let extractedData;
      let parsingMethod;

      if (validation.useSimpleParser) {
        // Use fast regex-based parser (no AI, no cost)
        console.log('✨ Using SIMPLE parser (no AI needed - saving $$$)');
        parsingMethod = 'simple';
        extractedData = this.simpleParser.parse(text);
      } else if (validation.isWellStructured) {
        // Try simple parser first, fallback to AI if needed
        console.log('⚡ Trying SIMPLE parser first, will fallback to AI if needed...');
        try {
          extractedData = this.simpleParser.parse(text);
          parsingMethod = 'simple';

          // Validate extraction quality
          if (!extractedData.email && !extractedData.name) {
            console.log('⚠️  Simple parser failed to extract basic info, using AI...');
            extractedData = await this.extractInformation(text);
            parsingMethod = 'ai-fallback';
          } else {
            console.log('✅ Simple parser succeeded!');
          }
        } catch (err) {
          console.log('⚠️  Simple parser error, using AI:', err.message);
          extractedData = await this.extractInformation(text);
          parsingMethod = 'ai-fallback';
        }
      } else {
        // Use AI parser for complex/poorly formatted resumes
        console.log('🤖 Using AI parser (complex/unstructured resume)');
        parsingMethod = 'ai';
        extractedData = await this.extractInformation(text);
      }

      console.log(`✅ Resume parsed successfully using ${parsingMethod} method`);

      return {
        text,
        extractedData,
        metadata: {
          parsingMethod,
          qualityScore: validation.score,
          usedAI: parsingMethod.includes('ai')
        }
      };

    } catch (error) {
      console.error('Resume parsing error:', error.message);
      throw error;
    }
  }

  async extractInformation(resumeText) {
    try {
      // Check cache first
      const resumeHash = this._generateHash(resumeText);
      const cached = await this.cache.getResumeParsing(resumeHash);

      if (cached) {
        console.log('✅ Resume parsing: CACHE HIT - saving $$$ on AI');
        return cached;
      }

      console.log('💰 Resume parsing: CACHE MISS - calling AI (using Gemini to save $$$)');

      const systemPrompt = 'You are a resume parser. Extract information and return valid JSON only. Do not include any markdown formatting or code blocks.';

      const prompt = `Extract the following information from this resume. Return a JSON object with these exact fields. If a field is not found, use null:

{
  "name": "Full name",
  "email": "Email address",
  "phone": "Phone number",
  "location": "City, State or full address",
  "linkedin": "LinkedIn profile URL",
  "website": "Personal website or portfolio URL",
  "summary": "Professional summary or objective (2-3 sentences)",
  "education": [
    {
      "degree": "Degree name",
      "field": "Field of study",
      "institution": "School/University name",
      "graduationDate": "Graduation date or expected date",
      "gpa": "GPA if mentioned"
    }
  ],
  "experience": [
    {
      "title": "Job title",
      "company": "Company name",
      "location": "Job location",
      "startDate": "Start date",
      "endDate": "End date or 'Present'",
      "description": "Job responsibilities and achievements"
    }
  ],
  "skills": ["skill1", "skill2", "skill3"],
  "certifications": ["certification1", "certification2"],
  "projects": [
    {
      "name": "Project name",
      "description": "Brief project description",
      "technologies": ["tech1", "tech2"],
      "url": "Project URL if available"
    }
  ],
  "languages": ["language1", "language2"],
  "awards": ["award1", "award2"]
}

Resume text:
${resumeText}`;

      // Use AI client (Gemini first, OpenAI fallback) - 99% cheaper than GPT-4 Turbo!
      const responseText = await this.aiClient.generateText({
        prompt,
        systemPrompt,
        aiMode: 'fast', // Use fast mode (Gemini Flash)
        temperature: 0.1,
        jsonMode: true
      });

      const extractedData = JSON.parse(responseText);

      // Clean and validate the extracted data
      const cleanedData = this.validateAndCleanData(extractedData);

      // Cache the result for 1 hour
      await this.cache.setResumeParsing(resumeHash, cleanedData);

      return cleanedData;
    } catch (error) {
      console.error('Failed to extract information from resume:', error);
      // Return a structure with empty fields if extraction fails
      return this.getEmptyStructure();
    }
  }

  validateAndCleanData(data) {
    // Ensure all required fields exist
    const cleaned = {
      name: data.name || null,
      email: this.validateEmail(data.email),
      phone: this.formatPhone(data.phone),
      location: data.location || null,
      linkedin: this.validateUrl(data.linkedin),
      website: this.validateUrl(data.website),
      summary: data.summary || null,
      education: Array.isArray(data.education) ? data.education : [],
      experience: Array.isArray(data.experience) ? data.experience : [],
      skills: Array.isArray(data.skills) ? data.skills.filter(s => s && typeof s === 'string') : [],
      certifications: Array.isArray(data.certifications) ? data.certifications.filter(c => c && typeof c === 'string') : [],
      projects: Array.isArray(data.projects) ? data.projects : [],
      languages: Array.isArray(data.languages) ? data.languages.filter(l => l && typeof l === 'string') : [],
      awards: Array.isArray(data.awards) ? data.awards.filter(a => a && typeof a === 'string') : []
    };

    return cleaned;
  }

  validateEmail(email) {
    if (!email) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? email : null;
  }

  formatPhone(phone) {
    if (!phone) return null;
    // Remove all non-numeric characters except + for international
    const cleaned = phone.replace(/[^\d+]/g, '');
    return cleaned || null;
  }

  validateUrl(url) {
    if (!url) return null;
    try {
      // Add protocol if missing
      let validUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        validUrl = 'https://' + url;
      }
      new URL(validUrl);
      return validUrl;
    } catch {
      return null;
    }
  }

  getEmptyStructure() {
    return {
      name: null,
      email: null,
      phone: null,
      location: null,
      linkedin: null,
      website: null,
      summary: null,
      education: [],
      experience: [],
      skills: [],
      certifications: [],
      projects: [],
      languages: [],
      awards: []
    };
  }
}

export default ResumeParser;