/**
 * Resume Text Validator
 *
 * Analyzes extracted text to determine if it's well-structured enough
 * to be parsed with regex/simple extraction, or if AI is needed.
 *
 * This saves OpenAI API costs and speeds up processing for simple resumes.
 */

class ResumeTextValidator {
  constructor() {
    // Patterns to detect well-structured resume sections
    this.patterns = {
      email: /[\w\.-]+@[\w\.-]+\.\w+/,
      phone: /(\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}/,
      linkedin: /linkedin\.com\/in\/[\w-]+/i,
      website: /https?:\/\/[\w\.-]+\.\w+/,

      // Common section headers
      sections: {
        experience: /(work\s+experience|professional\s+experience|employment|experience)/i,
        education: /(education|academic|degree)/i,
        skills: /(skills|technical\s+skills|competencies|technologies)/i,
        projects: /(projects|portfolio)/i,
        certifications: /(certifications?|licenses?)/i,
        summary: /(summary|objective|profile|about)/i
      },

      // Date patterns (for experience/education)
      dates: /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b|\b\d{4}\s*-\s*\d{4}\b|\bpresent\b/i,

      // Bullet points or list items
      bullets: /^[\s]*[-•*●○]\s+/m,

      // Common job titles
      jobTitles: /(engineer|developer|manager|analyst|designer|consultant|specialist|director|coordinator|administrator|intern|associate)/i
    };
  }

  /**
   * Validates if the extracted text is well-structured
   * Returns quality score and recommendations
   */
  validate(text) {
    const analysis = {
      score: 0,
      maxScore: 100,
      isWellStructured: false,
      hasBasicInfo: false,
      hasSections: false,
      hasDates: false,
      hasStructure: false,
      useSimpleParser: false,
      details: {}
    };

    if (!text || text.length < 100) {
      analysis.details.error = 'Text too short';
      return analysis;
    }

    // Check 1: Basic contact information (30 points)
    const hasEmail = this.patterns.email.test(text);
    const hasPhone = this.patterns.phone.test(text);

    if (hasEmail) analysis.score += 15;
    if (hasPhone) analysis.score += 15;
    analysis.hasBasicInfo = hasEmail || hasPhone;
    analysis.details.contactInfo = { hasEmail, hasPhone };

    // Check 2: Section headers (30 points)
    const sectionsFound = {};
    let sectionCount = 0;

    for (const [section, pattern] of Object.entries(this.patterns.sections)) {
      if (pattern.test(text)) {
        sectionsFound[section] = true;
        sectionCount++;
      }
    }

    analysis.score += Math.min(sectionCount * 10, 30);
    analysis.hasSections = sectionCount >= 2;
    analysis.details.sections = sectionsFound;
    analysis.details.sectionCount = sectionCount;

    // Check 3: Dates present (20 points)
    const dateMatches = text.match(new RegExp(this.patterns.dates, 'gi'));
    const hasMultipleDates = dateMatches && dateMatches.length >= 2;

    if (hasMultipleDates) analysis.score += 20;
    else if (dateMatches && dateMatches.length >= 1) analysis.score += 10;

    analysis.hasDates = hasMultipleDates;
    analysis.details.dateCount = dateMatches ? dateMatches.length : 0;

    // Check 4: Structure indicators (20 points)
    const hasBullets = this.patterns.bullets.test(text);
    const hasJobTitles = this.patterns.jobTitles.test(text);
    const hasLineBreaks = text.split('\n').length > 10;

    if (hasBullets) analysis.score += 8;
    if (hasJobTitles) analysis.score += 8;
    if (hasLineBreaks) analysis.score += 4;

    analysis.hasStructure = hasBullets || hasJobTitles;
    analysis.details.structure = { hasBullets, hasJobTitles, hasLineBreaks };

    // Final decision
    analysis.isWellStructured = analysis.score >= 60;
    analysis.useSimpleParser = analysis.score >= 70;

    return analysis;
  }

  /**
   * Extract basic information using regex (fast, no AI needed)
   * Only use when validation score is high
   */
  extractBasicInfo(text) {
    const info = {
      email: null,
      phone: null,
      linkedin: null,
      website: null,
      name: null
    };

    // Extract email
    const emailMatch = text.match(this.patterns.email);
    if (emailMatch) info.email = emailMatch[0];

    // Extract phone
    const phoneMatch = text.match(this.patterns.phone);
    if (phoneMatch) info.phone = phoneMatch[0].replace(/[^\d+]/g, '');

    // Extract LinkedIn
    const linkedinMatch = text.match(this.patterns.linkedin);
    if (linkedinMatch) info.linkedin = 'https://' + linkedinMatch[0];

    // Extract website (excluding LinkedIn)
    const websiteMatch = text.match(this.patterns.website);
    if (websiteMatch) {
      const url = websiteMatch[0];
      if (!url.includes('linkedin.com')) {
        info.website = url;
      }
    }

    // Try to extract name (usually first line or near top)
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      // Name is usually 2-4 words, capitalized, no numbers
      if (line.length > 5 && line.length < 50 &&
          /^[A-Z][a-zA-Z\s'-]+$/.test(line) &&
          line.split(/\s+/).length >= 2 && line.split(/\s+/).length <= 4 &&
          !this.patterns.email.test(line) && !this.patterns.phone.test(line)) {
        info.name = line;
        break;
      }
    }

    return info;
  }

  /**
   * Extract sections using simple text parsing
   */
  extractSections(text) {
    const sections = {
      experience: [],
      education: [],
      skills: [],
      projects: []
    };

    // Split text by common section headers
    const lines = text.split('\n');
    let currentSection = null;
    let currentContent = [];

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Check if line is a section header
      if (this.patterns.sections.experience.test(trimmedLine)) {
        if (currentSection) sections[currentSection] = currentContent.join('\n');
        currentSection = 'experience';
        currentContent = [];
      } else if (this.patterns.sections.education.test(trimmedLine)) {
        if (currentSection) sections[currentSection] = currentContent.join('\n');
        currentSection = 'education';
        currentContent = [];
      } else if (this.patterns.sections.skills.test(trimmedLine)) {
        if (currentSection) sections[currentSection] = currentContent.join('\n');
        currentSection = 'skills';
        currentContent = [];
      } else if (this.patterns.sections.projects.test(trimmedLine)) {
        if (currentSection) sections[currentSection] = currentContent.join('\n');
        currentSection = 'projects';
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(trimmedLine);
      }
    }

    // Save last section
    if (currentSection) {
      sections[currentSection] = currentContent.join('\n');
    }

    return sections;
  }

  /**
   * Parse skills from skills section
   */
  parseSkills(skillsText) {
    if (!skillsText) return [];

    // Handle both string and array inputs
    let textToProcess;
    if (Array.isArray(skillsText)) {
      textToProcess = skillsText.join('\n');
    } else if (typeof skillsText === 'string') {
      textToProcess = skillsText;
    } else {
      return [];
    }

    // Common skill separators: commas, bullets, newlines
    const skills = textToProcess
      .split(/[,•\n\-]/)
      .map(s => s.trim())
      .filter(s => s.length > 1 && s.length < 50)
      .filter(s => !/^(skills?|technical|competencies|technologies):?$/i.test(s));

    return [...new Set(skills)]; // Remove duplicates
  }

  /**
   * Quick quality check without full validation
   */
  quickCheck(text) {
    const hasEmail = this.patterns.email.test(text);
    const hasSections = this.patterns.sections.experience.test(text) ||
                       this.patterns.sections.education.test(text);
    const hasDates = this.patterns.dates.test(text);

    return {
      isProbablyGood: hasEmail && hasSections && hasDates,
      hasMinimumStructure: hasEmail || hasSections
    };
  }
}

export default ResumeTextValidator;
