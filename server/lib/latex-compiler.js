/**
 * Simple LaTeX to PDF compiler
 */

import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import util from 'util';

const execAsync = util.promisify(exec);

/**
 * Compile LaTeX code to PDF
 * @param {string} latexCode - The LaTeX source code
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function compileLatex(latexCode) {
  // Create temporary directory
  const tempId = crypto.randomBytes(16).toString('hex');
  const tempDir = path.join('/tmp', `latex-${tempId}`);

  try {
    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });

    // Write LaTeX file
    const texFile = path.join(tempDir, 'resume.tex');
    await fs.writeFile(texFile, latexCode);

    // Try to compile with different engines in order of preference
    const compilers = [
      { cmd: 'tectonic', args: '--outdir . --keep-logs resume.tex' },
      { cmd: 'pdflatex', args: '-interaction=nonstopmode -output-directory=. resume.tex' },
      { cmd: 'xelatex', args: '-interaction=nonstopmode -output-directory=. resume.tex' }
    ];

    let compiled = false;
    let lastError = null;

    for (const compiler of compilers) {
      try {
        // Check if compiler exists
        await execAsync(`which ${compiler.cmd}`);

        // Run compilation (twice for references)
        await execAsync(`cd ${tempDir} && ${compiler.cmd} ${compiler.args}`);

        // Some compilers need a second pass for references
        if (compiler.cmd !== 'tectonic') {
          await execAsync(`cd ${tempDir} && ${compiler.cmd} ${compiler.args}`);
        }

        compiled = true;
        console.log(`Successfully compiled with ${compiler.cmd}`);
        break;
      } catch (error) {
        lastError = error;
        console.log(`${compiler.cmd} not available or failed, trying next...`);
        continue;
      }
    }

    if (!compiled) {
      throw new Error(`LaTeX compilation failed. Last error: ${lastError?.message}`);
    }

    // Read the PDF
    const pdfFile = path.join(tempDir, 'resume.pdf');
    const pdfBuffer = await fs.readFile(pdfFile);

    return pdfBuffer;

  } catch (error) {
    console.error('LaTeX compilation error:', error);

    // Try to read log file for better error message
    try {
      const logFile = path.join(tempDir, 'resume.log');
      const logContent = await fs.readFile(logFile, 'utf8');
      const errorMatch = logContent.match(/^! (.+)$/m);
      if (errorMatch) {
        throw new Error(`LaTeX error: ${errorMatch[1]}`);
      }
    } catch (logError) {
      // Ignore log reading errors
    }

    throw new Error(`LaTeX compilation failed: ${error.message}`);
  } finally {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('Failed to clean up temp directory:', cleanupError);
    }
  }
}

/**
 * Validate LaTeX code before compilation
 * @param {string} latexCode - The LaTeX source code
 * @returns {boolean} - True if valid
 */
function validateLatex(latexCode) {
  // Basic validation
  if (!latexCode.includes('\\documentclass')) {
    throw new Error('Missing \\documentclass');
  }
  if (!latexCode.includes('\\begin{document}')) {
    throw new Error('Missing \\begin{document}');
  }
  if (!latexCode.includes('\\end{document}')) {
    throw new Error('Missing \\end{document}');
  }

  // Check for balanced braces (basic check)
  const openBraces = (latexCode.match(/{/g) || []).length;
  const closeBraces = (latexCode.match(/}/g) || []).length;

  if (openBraces !== closeBraces) {
    console.warn(`Warning: Unbalanced braces (open: ${openBraces}, close: ${closeBraces})`);
  }

  return true;
}

/**
 * Get available LaTeX compilers
 * @returns {Promise<Array>} - List of available compilers
 */
async function getAvailableCompilers() {
  const compilers = ['tectonic', 'pdflatex', 'xelatex', 'lualatex'];
  const available = [];

  for (const compiler of compilers) {
    try {
      await execAsync(`which ${compiler}`);
      available.push(compiler);
    } catch {
      // Compiler not available
    }
  }

  return available;
}

export {
  compileLatex,
  validateLatex,
  getAvailableCompilers
};