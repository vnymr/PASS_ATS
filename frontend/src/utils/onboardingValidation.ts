// Comprehensive validation utilities for onboarding data flow

import { 
  ParsedResumeData, 
  OnboardingValidationResult, 
  OnboardingValidationError,
  Experience,
  Project,
  Education,
  Certification
} from '../types/onboarding';

export class OnboardingValidator {
  private static readonly MIN_SKILLS = 3;
  private static readonly MIN_EXPERIENCES = 1;
  private static readonly MIN_SUMMARY_LENGTH = 50;
  private static readonly MAX_SUMMARY_LENGTH = 500;
  private static readonly REQUIRED_FIELDS = ['name', 'email', 'summary'];

  static validateParsedData(data: ParsedResumeData): OnboardingValidationResult {
    const errors: OnboardingValidationError[] = [];
    let qualityScore = 100;

    // Validate required fields
    for (const field of this.REQUIRED_FIELDS) {
      if (!data[field as keyof ParsedResumeData] || 
          (typeof data[field as keyof ParsedResumeData] === 'string' && 
           (data[field as keyof ParsedResumeData] as string).trim().length === 0)) {
        errors.push({
          field,
          message: `${field.charAt(0).toUpperCase() + field.slice(1)} is required`,
          severity: 'error'
        });
        qualityScore -= 20;
      }
    }

    // Validate email format
    if (data.email && !this.isValidEmail(data.email)) {
      errors.push({
        field: 'email',
        message: 'Please enter a valid email address',
        severity: 'error'
      });
      qualityScore -= 15;
    }

    // Validate phone format
    if (data.phone && !this.isValidPhone(data.phone)) {
      errors.push({
        field: 'phone',
        message: 'Please enter a valid phone number',
        severity: 'warning'
      });
      qualityScore -= 5;
    }

    // Validate summary length
    if (data.summary) {
      if (data.summary.length < this.MIN_SUMMARY_LENGTH) {
        errors.push({
          field: 'summary',
          message: `Summary should be at least ${this.MIN_SUMMARY_LENGTH} characters`,
          severity: 'warning'
        });
        qualityScore -= 10;
      } else if (data.summary.length > this.MAX_SUMMARY_LENGTH) {
        errors.push({
          field: 'summary',
          message: `Summary should be no more than ${this.MAX_SUMMARY_LENGTH} characters`,
          severity: 'warning'
        });
        qualityScore -= 5;
      }
    }

    // Validate skills
    if (!data.skills || data.skills.length < this.MIN_SKILLS) {
      errors.push({
        field: 'skills',
        message: `Please add at least ${this.MIN_SKILLS} skills`,
        severity: 'warning'
      });
      qualityScore -= 15;
    }

    // Validate experiences
    if (!data.experiences || data.experiences.length < this.MIN_EXPERIENCES) {
      errors.push({
        field: 'experiences',
        message: `Please add at least ${this.MIN_EXPERIENCES} work experience`,
        severity: 'warning'
      });
      qualityScore -= 20;
    } else {
      // Validate individual experiences
      data.experiences.forEach((exp, index) => {
        const expErrors = this.validateExperience(exp, index);
        errors.push(...expErrors);
        if (expErrors.length > 0) qualityScore -= 5;
      });
    }

    // Validate projects
    if (data.projects) {
      data.projects.forEach((project, index) => {
        const projectErrors = this.validateProject(project, index);
        errors.push(...projectErrors);
        if (projectErrors.length > 0) qualityScore -= 3;
      });
    }

    // Validate education
    if (data.education) {
      data.education.forEach((edu, index) => {
        const eduErrors = this.validateEducation(edu, index);
        errors.push(...eduErrors);
        if (eduErrors.length > 0) qualityScore -= 3;
      });
    }

    // Generate suggestions
    const suggestions = this.generateSuggestions(data, errors);

    return {
      isValid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      qualityScore: Math.max(0, qualityScore),
      suggestions
    };
  }

  private static validateExperience(exp: Experience, index: number): OnboardingValidationError[] {
    const errors: OnboardingValidationError[] = [];

    if (!exp.company?.trim()) {
      errors.push({
        field: `experiences[${index}].company`,
        message: 'Company name is required',
        severity: 'error'
      });
    }

    if (!exp.role?.trim()) {
      errors.push({
        field: `experiences[${index}].role`,
        message: 'Job title is required',
        severity: 'error'
      });
    }

    if (!exp.dates?.trim()) {
      errors.push({
        field: `experiences[${index}].dates`,
        message: 'Employment dates are required',
        severity: 'warning'
      });
    }

    if (!exp.bullets || exp.bullets.length === 0) {
      errors.push({
        field: `experiences[${index}].bullets`,
        message: 'Add at least one achievement or responsibility',
        severity: 'warning'
      });
    }

    return errors;
  }

  private static validateProject(project: Project, index: number): OnboardingValidationError[] {
    const errors: OnboardingValidationError[] = [];

    if (!project.name?.trim()) {
      errors.push({
        field: `projects[${index}].name`,
        message: 'Project name is required',
        severity: 'error'
      });
    }

    if (!project.summary?.trim()) {
      errors.push({
        field: `projects[${index}].summary`,
        message: 'Project description is required',
        severity: 'warning'
      });
    }

    return errors;
  }

  private static validateEducation(edu: Education, index: number): OnboardingValidationError[] {
    const errors: OnboardingValidationError[] = [];

    if (!edu.institution?.trim()) {
      errors.push({
        field: `education[${index}].institution`,
        message: 'Institution name is required',
        severity: 'error'
      });
    }

    if (!edu.degree?.trim()) {
      errors.push({
        field: `education[${index}].degree`,
        message: 'Degree is required',
        severity: 'error'
      });
    }

    return errors;
  }

  private static generateSuggestions(data: ParsedResumeData, errors: OnboardingValidationError[]): string[] {
    const suggestions: string[] = [];

    if (!data.linkedin) {
      suggestions.push('Add your LinkedIn profile to increase professional visibility');
    }

    if (!data.website) {
      suggestions.push('Include your portfolio or personal website if available');
    }

    if (!data.certifications || data.certifications.length === 0) {
      suggestions.push('Add relevant certifications to strengthen your profile');
    }

    if (data.skills && data.skills.length < 10) {
      suggestions.push('Consider adding more technical skills to improve job matching');
    }

    if (data.experiences && data.experiences.length < 3) {
      suggestions.push('Include internships, volunteer work, or freelance projects if you have limited work experience');
    }

    if (data.summary && data.summary.length < 100) {
      suggestions.push('Expand your professional summary to better highlight your value proposition');
    }

    return suggestions;
  }

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private static isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  static sanitizeData(data: any): ParsedResumeData {
    const sanitized: ParsedResumeData = {
      resumeText: data.resumeText || '',
      isComplete: false,
      extractedAt: new Date().toISOString()
    };

    // Sanitize string fields
    const stringFields: (keyof ParsedResumeData)[] = ['name', 'email', 'phone', 'location', 'linkedin', 'website', 'summary'];
    stringFields.forEach(field => {
      if (data[field] && typeof data[field] === 'string') {
        (sanitized as any)[field] = (data[field] as string).trim().replace(/\u0000/g, '');
      }
    });

    // Sanitize arrays
    if (Array.isArray(data.skills)) {
      sanitized.skills = data.skills
        .filter((skill: any) => skill && typeof skill === 'string')
        .map((skill: string) => skill.trim())
        .filter((skill: string) => skill.length > 0);
    }

    if (Array.isArray(data.experiences)) {
      sanitized.experiences = data.experiences
        .filter((exp: any) => exp && typeof exp === 'object')
        .map((exp: any) => ({
          company: exp.company?.trim() || '',
          role: exp.role?.trim() || '',
          location: exp.location?.trim() || '',
          dates: exp.dates?.trim() || '',
          bullets: Array.isArray(exp.bullets) ? exp.bullets.filter((b: any) => b && typeof b === 'string').map((b: string) => b.trim()) : [],
          isCurrent: Boolean(exp.isCurrent)
        }))
        .filter((exp: any) => exp.company && exp.role);
    }

    if (Array.isArray(data.projects)) {
      sanitized.projects = data.projects
        .filter((project: any) => project && typeof project === 'object')
        .map((project: any) => ({
          name: project.name?.trim() || '',
          summary: project.summary?.trim() || '',
          bullets: Array.isArray(project.bullets) ? project.bullets.filter((b: any) => b && typeof b === 'string').map((b: string) => b.trim()) : [],
          technologies: Array.isArray(project.technologies) ? project.technologies.filter((t: any) => t && typeof t === 'string').map((t: string) => t.trim()) : [],
          url: project.url?.trim() || ''
        }))
        .filter((project: any) => project.name);
    }

    if (Array.isArray(data.education)) {
      sanitized.education = data.education
        .filter((edu: any) => edu && typeof edu === 'object')
        .map((edu: any) => ({
          institution: edu.institution?.trim() || '',
          degree: edu.degree?.trim() || '',
          location: edu.location?.trim() || '',
          dates: edu.dates?.trim() || '',
          gpa: edu.gpa?.trim() || ''
        }))
        .filter((edu: any) => edu.institution && edu.degree);
    }

    if (Array.isArray(data.certifications)) {
      sanitized.certifications = data.certifications
        .filter((cert: any) => cert && typeof cert === 'object')
        .map((cert: any) => ({
          name: cert.name?.trim() || '',
          issuer: cert.issuer?.trim() || '',
          date: cert.date?.trim() || '',
          url: cert.url?.trim() || ''
        }))
        .filter((cert: any) => cert.name && cert.issuer);
    }

    return sanitized;
  }

  static calculateQualityScore(data: ParsedResumeData): number {
    let score = 0;
    const maxScore = 100;

    // Basic information (30 points)
    if (data.name) score += 5;
    if (data.email) score += 5;
    if (data.phone) score += 5;
    if (data.location) score += 5;
    if (data.linkedin) score += 5;
    if (data.website) score += 5;

    // Professional summary (20 points)
    if (data.summary) {
      if (data.summary.length >= 100) score += 20;
      else if (data.summary.length >= 50) score += 15;
      else score += 10;
    }

    // Skills (15 points)
    if (data.skills && data.skills.length > 0) {
      score += Math.min(15, data.skills.length * 2);
    }

    // Experience (25 points)
    if (data.experiences && data.experiences.length > 0) {
      score += Math.min(25, data.experiences.length * 8);
    }

    // Projects (5 points)
    if (data.projects && data.projects.length > 0) {
      score += Math.min(5, data.projects.length * 2);
    }

    // Education (5 points)
    if (data.education && data.education.length > 0) {
      score += Math.min(5, data.education.length * 3);
    }

    return Math.min(maxScore, score);
  }
}


