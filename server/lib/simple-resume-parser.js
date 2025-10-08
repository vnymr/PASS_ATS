/**
 * Simple Resume Parser (No AI)
 *
 * Fast regex-based parser for well-structured resumes.
 * Used when ResumeTextValidator determines text is well-formatted.
 *
 * Benefits:
 * - 100x faster than AI parsing
 * - Zero API costs
 * - Works offline
 */

import ResumeTextValidator from './resume-text-validator.js';

class SimpleResumeParser {
  constructor() {
    this.validator = new ResumeTextValidator();
  }

  /**
   * Parse resume without AI
   * Returns same structure as AI parser for compatibility
   */
  parse(text) {
    const basicInfo = this.validator.extractBasicInfo(text);
    const sections = this.validator.extractSections(text);

    const result = {
      name: basicInfo.name,
      email: basicInfo.email,
      phone: basicInfo.phone,
      location: this.extractLocation(text),
      linkedin: basicInfo.linkedin,
      website: basicInfo.website,
      summary: this.extractSummary(text, sections),
      education: this.parseEducation(sections.education),
      experience: this.parseExperience(sections.experience),
      skills: this.validator.parseSkills(sections.skills),
      certifications: this.parseCertifications(text),
      projects: this.parseProjects(sections.projects),
      languages: this.parseLanguages(text),
      awards: this.parseAwards(text)
    };

    return result;
  }

  extractLocation(text) {
    // Common location patterns
    const patterns = [
      // City, State format
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})/,
      // City, Country
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z][a-z]+)/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }

    return null;
  }

  extractSummary(text, sections) {
    // Look for summary/objective section in first 500 chars
    const topSection = text.substring(0, 500);
    const summaryMatch = topSection.match(/(?:summary|objective|profile|about)[:\s]+([\s\S]+?)(?:\n\n|experience|education|skills)/i);

    if (summaryMatch) {
      return summaryMatch[1].trim().substring(0, 300);
    }

    return null;
  }

  parseEducation(educationText) {
    if (!educationText) return [];

    const education = [];
    const entries = educationText.split(/\n\n+/);

    for (const entry of entries) {
      const lines = entry.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length === 0) continue;

      const eduEntry = {
        degree: null,
        field: null,
        institution: null,
        graduationDate: null,
        gpa: null
      };

      // Extract institution (usually contains "University" or "College")
      const institutionLine = lines.find(l => /university|college|school|institute/i.test(l));
      if (institutionLine) eduEntry.institution = institutionLine;

      // Extract degree (BS, MS, PhD, Bachelor, Master)
      const degreeLine = lines.find(l => /\b(bs|ms|phd|bachelor|master|associate|b\.?s|m\.?s|b\.?a|m\.?a)\b/i.test(l));
      if (degreeLine) {
        eduEntry.degree = degreeLine;
        // Try to extract field (usually "in ...")
        const fieldMatch = degreeLine.match(/in\s+([A-Z][a-zA-Z\s&]+)/);
        if (fieldMatch) eduEntry.field = fieldMatch[1].trim();
      }

      // Extract date
      const dateMatch = entry.match(/\b(20\d{2}|19\d{2})\b/);
      if (dateMatch) eduEntry.graduationDate = dateMatch[0];

      // Extract GPA
      const gpaMatch = entry.match(/gpa[:\s]*([\d.]+)/i);
      if (gpaMatch) eduEntry.gpa = gpaMatch[1];

      if (eduEntry.institution || eduEntry.degree) {
        education.push(eduEntry);
      }
    }

    return education;
  }

  parseExperience(experienceText) {
    if (!experienceText) return [];

    const experience = [];
    const entries = experienceText.split(/\n\n+/);

    for (const entry of entries) {
      const lines = entry.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length < 2) continue;

      const expEntry = {
        title: null,
        company: null,
        location: null,
        startDate: null,
        endDate: null,
        description: null
      };

      // First line often contains title and company
      const firstLine = lines[0];

      // Extract dates (MMM YYYY - MMM YYYY or YYYY - YYYY)
      const datePattern = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\s*[-–—]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)?\s*\d{4}|present/i;
      const dateMatch = entry.match(datePattern);

      if (dateMatch) {
        const dates = dateMatch[0].split(/\s*[-–—]\s*/);
        expEntry.startDate = dates[0];
        expEntry.endDate = dates[1] || 'Present';
      }

      // Try to extract title (first line or line with job title keywords)
      const titleLine = lines.find(l => /engineer|developer|manager|analyst|designer|consultant|specialist|director|coordinator|administrator|intern|associate/i.test(l));
      if (titleLine) expEntry.title = titleLine;

      // Company name (often has "at" or comes after title)
      const companyMatch = entry.match(/(?:at|@)\s+([A-Z][a-zA-Z\s&.,]+?)(?:\n|,|\||$)/);
      if (companyMatch) expEntry.company = companyMatch[1].trim();

      // Description (bullet points or remaining text)
      const bullets = entry.match(/^[\s]*[-•*●○]\s+.+$/gm);
      if (bullets) {
        expEntry.description = bullets.map(b => b.replace(/^[\s]*[-•*●○]\s+/, '')).join(' ');
      } else {
        // Take remaining lines after title/company as description
        expEntry.description = lines.slice(2).join(' ');
      }

      if (expEntry.title || expEntry.company) {
        experience.push(expEntry);
      }
    }

    return experience;
  }

  parseCertifications(text) {
    const certSection = text.match(/certifications?:?\s*([\s\S]*?)(?:\n\n|skills|projects|education|$)/i);
    if (!certSection) return [];

    return certSection[1]
      .split(/\n/)
      .map(c => c.replace(/^[\s-•*●○]+/, '').trim())
      .filter(c => c.length > 3 && c.length < 100);
  }

  parseProjects(projectsText) {
    if (!projectsText) return [];

    const projects = [];
    const entries = projectsText.split(/\n\n+/);

    for (const entry of entries) {
      const lines = entry.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length === 0) continue;

      const project = {
        name: lines[0],
        description: lines.slice(1).join(' '),
        technologies: [],
        url: null
      };

      // Extract URL
      const urlMatch = entry.match(/https?:\/\/[\w\.-]+\.\w+[\w\/\.-]*/);
      if (urlMatch) project.url = urlMatch[0];

      // Extract technologies (words in parentheses or after "Technologies:")
      const techMatch = entry.match(/(?:technologies?|tech stack|built with)[:\s]*([\w\s,/]+)/i);
      if (techMatch) {
        project.technologies = techMatch[1].split(/[,\/]/).map(t => t.trim()).filter(t => t);
      }

      projects.push(project);
    }

    return projects;
  }

  parseLanguages(text) {
    const langSection = text.match(/languages?:?\s*([\s\S]*?)(?:\n\n|skills|certifications|$)/i);
    if (!langSection) return [];

    return langSection[1]
      .split(/[,\n]/)
      .map(l => l.replace(/^[\s-•*●○]+/, '').trim())
      .filter(l => l.length > 1 && l.length < 30);
  }

  parseAwards(text) {
    const awardSection = text.match(/(?:awards?|honors?|achievements?):?\s*([\s\S]*?)(?:\n\n|skills|projects|$)/i);
    if (!awardSection) return [];

    return awardSection[1]
      .split(/\n/)
      .map(a => a.replace(/^[\s-•*●○]+/, '').trim())
      .filter(a => a.length > 3 && a.length < 150);
  }
}

export default SimpleResumeParser;
