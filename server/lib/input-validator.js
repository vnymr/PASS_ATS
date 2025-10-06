/**
 * Input Validation Module
 * Provides security validation for all user inputs
 */

import validator from 'validator';

/**
 * Validation rules
 */
const VALIDATION_RULES = {
  jobDescription: {
    minLength: 50,
    maxLength: 10000, // 10KB limit
    allowedChars: /^[\w\s\-.,;:!?()\[\]{}'"\/\n\r@#$%&*+=<>]*$/
  },
  resumeText: {
    maxLength: 50000, // 50KB limit
  },
  email: {
    maxLength: 255
  },
  name: {
    minLength: 1,
    maxLength: 100,
    allowedChars: /^[\w\s\-.']*$/
  },
  phone: {
    maxLength: 20,
    allowedChars: /^[\d\s\-+()]*$/
  },
  url: {
    maxLength: 500
  },
  additionalInfo: {
    maxLength: 20000 // 20KB limit
  }
};

/**
 * Sanitize string by removing null bytes and trimming
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\u0000/g, '').trim();
}

/**
 * Validate job description
 */
export function validateJobDescription(jobDescription) {
  const errors = [];

  if (!jobDescription || typeof jobDescription !== 'string') {
    errors.push('Job description is required');
    return { valid: false, errors };
  }

  const sanitized = sanitizeString(jobDescription);
  const rules = VALIDATION_RULES.jobDescription;

  if (sanitized.length < rules.minLength) {
    errors.push(`Job description must be at least ${rules.minLength} characters`);
  }

  if (sanitized.length > rules.maxLength) {
    errors.push(`Job description must not exceed ${rules.maxLength} characters (${Math.ceil(rules.maxLength/1000)}KB)`);
  }

  // Check for suspicious patterns (prompt injection attempts)
  const suspiciousPatterns = [
    /ignore\s+previous\s+instructions/i,
    /system\s*:/i,
    /\[INST\]/i,
    /\[\/INST\]/i,
    /<\|im_start\|>/i,
    /<\|im_end\|>/i,
    /you\s+are\s+now/i,
    /forget\s+everything/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(sanitized)) {
      errors.push('Job description contains suspicious content');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * Validate resume text
 */
export function validateResumeText(resumeText) {
  const errors = [];

  if (!resumeText || typeof resumeText !== 'string') {
    return { valid: true, errors: [], sanitized: '' }; // Optional field
  }

  const sanitized = sanitizeString(resumeText);
  const rules = VALIDATION_RULES.resumeText;

  if (sanitized.length > rules.maxLength) {
    errors.push(`Resume text must not exceed ${rules.maxLength} characters (${Math.ceil(rules.maxLength/1000)}KB)`);
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * Validate email
 */
export function validateEmail(email) {
  const errors = [];

  if (!email || typeof email !== 'string') {
    return { valid: false, errors: ['Email is required'], sanitized: '' };
  }

  const sanitized = sanitizeString(email);
  const rules = VALIDATION_RULES.email;

  if (sanitized.length > rules.maxLength) {
    errors.push(`Email must not exceed ${rules.maxLength} characters`);
  }

  if (!validator.isEmail(sanitized)) {
    errors.push('Invalid email format');
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: validator.normalizeEmail(sanitized)
  };
}

/**
 * Validate name
 */
export function validateName(name, fieldName = 'Name') {
  const errors = [];

  if (!name || typeof name !== 'string') {
    return { valid: false, errors: [`${fieldName} is required`], sanitized: '' };
  }

  const sanitized = sanitizeString(name);
  const rules = VALIDATION_RULES.name;

  if (sanitized.length < rules.minLength) {
    errors.push(`${fieldName} is required`);
  }

  if (sanitized.length > rules.maxLength) {
    errors.push(`${fieldName} must not exceed ${rules.maxLength} characters`);
  }

  if (!rules.allowedChars.test(sanitized)) {
    errors.push(`${fieldName} contains invalid characters`);
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * Validate phone number
 */
export function validatePhone(phone) {
  const errors = [];

  if (!phone || typeof phone !== 'string') {
    return { valid: true, errors: [], sanitized: '' }; // Optional field
  }

  const sanitized = sanitizeString(phone);
  const rules = VALIDATION_RULES.phone;

  if (sanitized.length > rules.maxLength) {
    errors.push(`Phone must not exceed ${rules.maxLength} characters`);
  }

  if (!rules.allowedChars.test(sanitized)) {
    errors.push('Phone contains invalid characters');
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * Validate URL
 */
export function validateUrl(url, fieldName = 'URL') {
  const errors = [];

  if (!url || typeof url !== 'string') {
    return { valid: true, errors: [], sanitized: '' }; // Optional field
  }

  const sanitized = sanitizeString(url);
  const rules = VALIDATION_RULES.url;

  if (sanitized.length > rules.maxLength) {
    errors.push(`${fieldName} must not exceed ${rules.maxLength} characters`);
  }

  if (!validator.isURL(sanitized, { require_protocol: false })) {
    errors.push(`Invalid ${fieldName.toLowerCase()} format`);
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * Validate additional info
 */
export function validateAdditionalInfo(additionalInfo) {
  const errors = [];

  if (!additionalInfo || typeof additionalInfo !== 'string') {
    return { valid: true, errors: [], sanitized: '' }; // Optional field
  }

  const sanitized = sanitizeString(additionalInfo);
  const rules = VALIDATION_RULES.additionalInfo;

  if (sanitized.length > rules.maxLength) {
    errors.push(`Additional information must not exceed ${rules.maxLength} characters (${Math.ceil(rules.maxLength/1000)}KB)`);
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * Validate password strength
 */
export function validatePassword(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { valid: false, errors };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize profile data object
 */
export function sanitizeProfileData(profileData) {
  if (!profileData || typeof profileData !== 'object') {
    return {};
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(profileData)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'object' ? sanitizeProfileData(item) :
        typeof item === 'string' ? sanitizeString(item) : item
      );
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeProfileData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
