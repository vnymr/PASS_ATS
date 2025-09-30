import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import OpenAI from 'openai';

class ResumeParser {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async parseResume(buffer, mimeType) {
    let text = '';

    if (mimeType === 'application/pdf') {
      const pdfData = await pdfParse(buffer);
      text = pdfData.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (mimeType === 'text/plain') {
      text = buffer.toString('utf-8');
    } else {
      throw new Error('Unsupported file format. Please upload PDF, DOCX, or TXT files.');
    }

    const extractedData = await this.extractInformation(text);
    return { text, extractedData };
  }

  async extractInformation(resumeText) {
    try {
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

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a resume parser. Extract information and return valid JSON only. Do not include any markdown formatting or code blocks.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const extractedData = JSON.parse(response.choices[0].message.content);

      // Clean and validate the extracted data
      return this.validateAndCleanData(extractedData);
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