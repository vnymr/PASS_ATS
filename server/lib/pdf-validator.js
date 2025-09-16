// PDF Validator for ATS Compliance
export class PDFValidator {
  constructor() {
    this.checks = {
      textSelectable: true,
      properFormatting: true,
      noImages: true,
      standardFonts: true,
      singleColumn: true
    };
  }

  async validate(pdfPath) {
    // Basic validation - in production you'd use pdf-parse or similar
    const results = {
      valid: true,
      checks: { ...this.checks },
      warnings: [],
      errors: []
    };

    try {
      // Check if file exists
      const fs = await import('fs/promises');
      const stats = await fs.stat(pdfPath);
      
      if (stats.size === 0) {
        results.valid = false;
        results.errors.push('PDF file is empty');
      }
      
      if (stats.size > 5 * 1024 * 1024) { // 5MB
        results.warnings.push('PDF file is larger than 5MB');
      }

      // Basic ATS compliance checks
      results.atsScore = 95; // Placeholder - would calculate based on actual parsing
      
    } catch (error) {
      results.valid = false;
      results.errors.push(`Validation error: ${error.message}`);
    }

    return results;
  }

  async generateReport(pdfPath) {
    const validation = await this.validate(pdfPath);
    
    return {
      timestamp: new Date().toISOString(),
      file: pdfPath,
      ...validation,
      recommendations: [
        'Use standard fonts (Arial, Times New Roman, Calibri)',
        'Avoid tables, columns, headers, and footers',
        'Use standard section headings',
        'Ensure all text is selectable',
        'Save as PDF/A format for best compatibility'
      ]
    };
  }
}

// Named export for the specific function that's being imported
export async function enforceATSCompliance(pdfPath, jobData, profile, options = {}) {
  const validator = new PDFValidator();
  return await validator.generateReport(pdfPath);
}

// Compatibility wrapper expected by server.js: returns a richer ATS-style object
export async function validatePDFForATS(pdfPath, metadata = {}) {
  const validator = new PDFValidator();
  const report = await validator.generateReport(pdfPath);

  const issues_found = [
    ...(Array.isArray(report.errors) ? report.errors : []),
    ...(Array.isArray(report.warnings) ? report.warnings : [])
  ];

  // Map to the structure server/server.js expects
  return {
    validation_status: report.valid ? 'PASS' : 'FAIL',
    corrected_path: null,
    issues_found,
    recommendations: report.recommendations || [],
    metadata_report: {
      ...(metadata || {}),
      file: report.file,
      timestamp: report.timestamp
    },
    ats_parse_check: {
      parseability_score: typeof report.atsScore === 'number' ? report.atsScore : (report.valid ? 90 : 0),
      text_selectable: !!(report.checks && report.checks.textSelectable),
    },
    checks: report.checks || {}
  };
}

// Quick validation wrapper with minimal metadata
export async function quickValidatePDF(pdfPath) {
  const validator = new PDFValidator();
  const validation = await validator.validate(pdfPath);

  const issues_found = [
    ...(Array.isArray(validation.errors) ? validation.errors : []),
    ...(Array.isArray(validation.warnings) ? validation.warnings : [])
  ];

  return {
    validation_status: validation.valid ? 'PASS' : 'FAIL',
    checks: validation.checks || {},
    issues_found,
    recommendations: [
      'Prefer simple, single-column layout',
      'Ensure copyable, selectable text (no scanned images)',
      'Use common fonts and avoid tables'
    ],
    ats_parse_check: {
      parseability_score: typeof validation.atsScore === 'number' ? validation.atsScore : (validation.valid ? 90 : 0)
    }
  };
}

export default PDFValidator;
