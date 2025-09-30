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
    // Include full path for tectonic on Mac (homebrew installation)
    const compilers = [
      { cmd: '/opt/homebrew/bin/tectonic', args: '--outdir . --keep-logs resume.tex', name: 'tectonic (homebrew)' },
      { cmd: 'tectonic', args: '--outdir . --keep-logs resume.tex', name: 'tectonic' },
      { cmd: 'pdflatex', args: '-interaction=nonstopmode -output-directory=. resume.tex', name: 'pdflatex' },
      { cmd: 'xelatex', args: '-interaction=nonstopmode -output-directory=. resume.tex', name: 'xelatex' }
    ];

    let compiled = false;
    let lastError = null;

    for (const compiler of compilers) {
      try {
        // Check if compiler exists (skip 'which' check for absolute paths)
        if (!compiler.cmd.startsWith('/')) {
          await execAsync(`which ${compiler.cmd}`);
        }

        // Run compilation (twice for references)
        const result = await execAsync(`cd ${tempDir} && ${compiler.cmd} ${compiler.args}`);

        // Some compilers need a second pass for references
        if (compiler.cmd !== 'tectonic') {
          await execAsync(`cd ${tempDir} && ${compiler.cmd} ${compiler.args}`);
        }

        compiled = true;
        console.log(`✅ Successfully compiled PDF with ${compiler.name || compiler.cmd}`);
        break;
      } catch (error) {
        lastError = error;
        // Log tectonic errors for debugging
        if (compiler.cmd === '/opt/homebrew/bin/tectonic' || compiler.name === 'tectonic') {
          console.log(`⚠️ Tectonic compilation failed: ${error.message.substring(0, 300)}`);
          // Show stderr if available (contains LaTeX errors)
          if (error.stderr && error.stderr.length > 0) {
            console.log(`📋 Stderr output:`, error.stderr.substring(0, 500));
          }
          if (error.stdout && error.stdout.length > 0) {
            console.log(`📋 Stdout output:`, error.stdout.substring(0, 500));
          }
        } else if (!compiled) {
          console.log(`⚠️ ${compiler.name || compiler.cmd} not available, trying next...`);
        }
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
    // Only log critical errors, not expected fallbacks
    if (!error.message.includes('not available')) {
      console.error('LaTeX compilation error:', error.message);
    }

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