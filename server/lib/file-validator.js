/**
 * File Upload Security Validator
 * Validates files using magic numbers (file signatures) to prevent MIME type spoofing
 */

/**
 * File type magic numbers (first bytes of files)
 */
const FILE_SIGNATURES = {
  pdf: {
    signature: Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
    offset: 0,
    mimeType: 'application/pdf'
  },
  docx: {
    // DOCX files are ZIP archives starting with PK
    signature: Buffer.from([0x50, 0x4B, 0x03, 0x04]), // PK..
    offset: 0,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  },
  doc: {
    // Old DOC files start with D0 CF 11 E0 (Microsoft Office document)
    signature: Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]),
    offset: 0,
    mimeType: 'application/msword'
  },
  txt: {
    // Text files don't have a specific signature, validated by content check
    signature: null,
    mimeType: 'text/plain'
  }
};

/**
 * Validate file using magic number
 * @param {Buffer} buffer - File buffer
 * @param {string} declaredMimeType - MIME type from upload
 * @returns {Object} - Validation result
 */
export function validateFileSignature(buffer, declaredMimeType) {
  const errors = [];

  if (!buffer || buffer.length === 0) {
    errors.push('File is empty');
    return { valid: false, errors, detectedType: null };
  }

  // Check file size (5MB max)
  const maxSize = 5 * 1024 * 1024;
  if (buffer.length > maxSize) {
    errors.push(`File too large (max ${maxSize / 1024 / 1024}MB)`);
    return { valid: false, errors, detectedType: null };
  }

  // For text files, validate content
  if (declaredMimeType === 'text/plain') {
    // Check if buffer contains valid UTF-8 text
    try {
      const text = buffer.toString('utf-8');

      // Check for null bytes (binary data)
      if (text.includes('\0')) {
        errors.push('Text file contains binary data');
        return { valid: false, errors, detectedType: null };
      }

      // Check if mostly printable ASCII or valid UTF-8
      const printableChars = text.split('').filter(c => {
        const code = c.charCodeAt(0);
        return (code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13 || code > 127;
      }).length;

      const printableRatio = printableChars / text.length;
      if (printableRatio < 0.95) {
        errors.push('Text file contains too much non-printable data');
        return { valid: false, errors, detectedType: null };
      }

      return { valid: true, errors: [], detectedType: 'text/plain' };
    } catch (e) {
      errors.push('Invalid UTF-8 encoding');
      return { valid: false, errors, detectedType: null };
    }
  }

  // Check magic numbers for binary files
  let detectedType = null;

  // Check PDF
  if (buffer.slice(0, 4).equals(FILE_SIGNATURES.pdf.signature)) {
    detectedType = FILE_SIGNATURES.pdf.mimeType;
  }
  // Check DOCX (ZIP archive)
  else if (buffer.slice(0, 4).equals(FILE_SIGNATURES.docx.signature)) {
    // DOCX files contain word/ directory in the ZIP
    // Check for word/ signature around byte 30-100
    const contentCheck = buffer.slice(30, 100).toString('utf-8', 0, 70);
    if (contentCheck.includes('word/') || contentCheck.includes('Content_Types')) {
      detectedType = FILE_SIGNATURES.docx.mimeType;
    }
  }
  // Check DOC (old format)
  else if (buffer.slice(0, 8).equals(FILE_SIGNATURES.doc.signature)) {
    detectedType = FILE_SIGNATURES.doc.mimeType;
  }

  // Validate detected type matches declared type
  if (!detectedType) {
    errors.push('Unrecognized file type');
    return { valid: false, errors, detectedType: null };
  }

  // Allow some flexibility in MIME type matching
  const declaredBase = declaredMimeType.split(';')[0].trim();
  if (detectedType !== declaredBase) {
    errors.push(`File type mismatch: declared ${declaredBase}, detected ${detectedType}`);
    return { valid: false, errors, detectedType };
  }

  return { valid: true, errors: [], detectedType };
}

/**
 * Validate filename for security
 * @param {string} filename
 * @returns {Object} - Validation result
 */
export function validateFilename(filename) {
  const errors = [];

  if (!filename || typeof filename !== 'string') {
    errors.push('Invalid filename');
    return { valid: false, errors };
  }

  // Remove any path components
  const basename = filename.replace(/^.*[\\\/]/, '');

  // Check for null bytes
  if (basename.includes('\0')) {
    errors.push('Filename contains null bytes');
  }

  // Check length
  if (basename.length > 255) {
    errors.push('Filename too long (max 255 characters)');
  }

  // Check for dangerous characters
  const dangerousChars = /[<>:"|?*\x00-\x1F]/;
  if (dangerousChars.test(basename)) {
    errors.push('Filename contains invalid characters');
  }

  // Check for double extensions (potential attack)
  const extensions = basename.split('.').slice(1);
  if (extensions.length > 2) {
    errors.push('Multiple file extensions not allowed');
  }

  // Validate extension
  const allowedExtensions = ['pdf', 'txt', 'doc', 'docx'];
  const ext = extensions[extensions.length - 1]?.toLowerCase();
  if (!ext || !allowedExtensions.includes(ext)) {
    errors.push(`File extension must be one of: ${allowedExtensions.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: basename
  };
}

/**
 * Complete file validation (signature + filename + size)
 * @param {Object} file - Multer file object
 * @returns {Object} - Validation result
 */
export function validateUploadedFile(file) {
  const errors = [];

  if (!file) {
    errors.push('No file provided');
    return { valid: false, errors };
  }

  // Validate filename
  const filenameValidation = validateFilename(file.originalname);
  if (!filenameValidation.valid) {
    errors.push(...filenameValidation.errors);
  }

  // Validate file signature
  const signatureValidation = validateFileSignature(file.buffer, file.mimetype);
  if (!signatureValidation.valid) {
    errors.push(...signatureValidation.errors);
  }

  return {
    valid: errors.length === 0,
    errors,
    detectedType: signatureValidation.detectedType,
    sanitizedFilename: filenameValidation.sanitized
  };
}
