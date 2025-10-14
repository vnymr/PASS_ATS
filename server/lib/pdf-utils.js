/**
 * PDF Utilities for page counting and validation
 */

import pdfParse from 'pdf-parse';
import logger from './logger.js';

/**
 * Count the number of pages in a PDF buffer
 * @param {Buffer} pdfBuffer - PDF file as buffer
 * @returns {Promise<number>} Number of pages
 */
export async function countPdfPages(pdfBuffer) {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.numpages;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to count PDF pages');
    throw new Error(`PDF page counting failed: ${error.message}`);
  }
}

/**
 * Validate that PDF is exactly one page
 * @param {Buffer} pdfBuffer - PDF file as buffer
 * @returns {Promise<{isValid: boolean, pageCount: number, message: string}>}
 */
export async function validateSinglePage(pdfBuffer) {
  const pageCount = await countPdfPages(pdfBuffer);

  if (pageCount === 1) {
    return {
      isValid: true,
      pageCount: 1,
      message: '✅ Resume is exactly 1 page'
    };
  } else if (pageCount < 1) {
    return {
      isValid: false,
      pageCount: pageCount,
      message: `❌ Resume has no pages (${pageCount})`
    };
  } else {
    return {
      isValid: false,
      pageCount: pageCount,
      message: `⚠️ Resume exceeds 1 page: ${pageCount} pages detected`
    };
  }
}

/**
 * Extract text content from PDF for analysis
 * @param {Buffer} pdfBuffer - PDF file as buffer
 * @returns {Promise<string>} Extracted text
 */
export async function extractPdfText(pdfBuffer) {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to extract PDF text');
    return '';
  }
}

export default {
  countPdfPages,
  validateSinglePage,
  extractPdfText
};
