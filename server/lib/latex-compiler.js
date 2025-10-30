/**
 * Simple LaTeX to PDF compiler
 */

import logger, { compileLogger } from './logger.js';
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
      { cmd: 'tectonic', args: '--outdir . --keep-logs resume.tex', name: 'tectonic' },
      { cmd: '/opt/homebrew/bin/tectonic', args: '--outdir . --keep-logs resume.tex', name: 'tectonic (homebrew)' },
      { cmd: '/usr/local/bin/tectonic', args: '--outdir . --keep-logs resume.tex', name: 'tectonic (usr/local)' },
      { cmd: 'pdflatex', args: '-interaction=nonstopmode -output-directory=. resume.tex', name: 'pdflatex' },
      { cmd: 'xelatex', args: '-interaction=nonstopmode -output-directory=. resume.tex', name: 'xelatex' }
    ];

    let compiled = false;
    let lastError = null;

    for (const compiler of compilers) {
      try {
        // For absolute paths, check if file exists before trying
        if (compiler.cmd.startsWith('/')) {
          try {
            await execAsync(`test -f ${compiler.cmd}`);
          } catch {
            // Binary doesn't exist at this path, skip silently
            continue;
          }
        } else {
          // For relative paths, use 'which' to check availability
          try {
            await execAsync(`which ${compiler.cmd}`);
          } catch {
            // Command not in PATH, skip silently
            continue;
          }
        }

        // Run compilation (twice for references)
        const result = await execAsync(`cd ${tempDir} && ${compiler.cmd} ${compiler.args}`);

        // Some compilers need a second pass for references
        if (!compiler.name.includes('tectonic')) {
          await execAsync(`cd ${tempDir} && ${compiler.cmd} ${compiler.args}`);
        }

        compiled = true;
        logger.info(`✅ Successfully compiled PDF with ${compiler.name || compiler.cmd}`);
        break;
      } catch (error) {
        lastError = error;
        // Only log errors that aren't about missing binaries
        if (error.message && !error.message.includes('not found') && !error.message.includes('ENOENT')) {
          if (compiler.name.includes('tectonic')) {
            logger.info(`⚠️ ${compiler.name} compilation failed: ${error.message.substring(0, 200)}`);
            if (error.stderr && error.stderr.length > 0) {
              logger.info(`📋 Stderr: ${error.stderr.substring(0, 300)}`);
            }
          }
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
      logger.error('LaTeX compilation error:', error.message);
    }

    // Try to read log file for detailed error context
    try {
      const logFile = path.join(tempDir, 'resume.log');
      const logContent = await fs.readFile(logFile, 'utf8');

      // Extract detailed error information
      const errorLines = [];
      const lines = logContent.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Look for error markers
        if (line.startsWith('!') || line.includes('Error') || line.includes('error:')) {
          // Capture error line and 5 lines of context
          errorLines.push('=== ERROR CONTEXT ===');
          for (let j = Math.max(0, i - 2); j < Math.min(lines.length, i + 5); j++) {
            errorLines.push(lines[j]);
          }
          errorLines.push('=== END CONTEXT ===\n');
        }

        // Look for line number references (l.123 format)
        if (line.match(/^l\.\d+/)) {
          errorLines.push(`Line reference: ${line}`);
        }
      }

      if (errorLines.length > 0) {
        // Sanitize error messages to remove system paths
        const detailedError = errorLines.join('\n')
          .replace(/\/tmp\/latex-[a-f0-9]+/g, '[temp]')
          .replace(/\/Users\/[^/]+/g, '[user]')
          .replace(/\/home\/[^/]+/g, '[user]')
          .replace(/\/opt\/[^/\s]+/g, '[system]')
          .replace(/\/usr\/[^/\s]+/g, '[system]');

        // Extract actionable error info
        let actionableError = '';
        if (detailedError.includes('Undefined control sequence')) {
          actionableError = '\n💡 Fix: Remove or replace the undefined LaTeX command';
        } else if (detailedError.includes('Missing \\item')) {
          actionableError = '\n💡 Fix: Wrap content in \\begin{itemize}...\\end{itemize} or remove \\item';
        } else if (detailedError.includes('dvipsNames')) {
          actionableError = '\n💡 Fix: Change dvipsNames to dvipsnames (lowercase "names")';
        } else if (detailedError.includes('begin{') && detailedError.includes('ended by \\end{')) {
          actionableError = '\n💡 Fix: Close the environment properly (unmatched begin/end)';
        }

        throw new Error(`LaTeX compilation error with context:\n${detailedError.substring(0, 1000)}${actionableError}`);
      }

      // Fallback to simple error extraction
      const errorMatch = logContent.match(/^! (.+)$/m);
      if (errorMatch) {
        throw new Error(`LaTeX error: ${errorMatch[1]}`);
      }
    } catch (logError) {
      // If log parsing itself fails, continue with original error
      if (logError.message.includes('LaTeX compilation error')) {
        throw logError; // Re-throw our parsed error
      }
    }

    // Sanitize the original error message as well
    const sanitizedMessage = error.message
      .replace(/\/tmp\/latex-[a-f0-9]+/g, '[temp]')
      .replace(/\/Users\/[^/]+/g, '[user]')
      .replace(/\/home\/[^/]+/g, '[user]')
      .replace(/\/opt\/[^/\s]+/g, '[system]')
      .replace(/\/usr\/[^/\s]+/g, '[system]');
    throw new Error(`LaTeX compilation failed: ${sanitizedMessage}`);
  } finally {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      logger.warn('Failed to clean up temp directory:', cleanupError);
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
    logger.warn(`Warning: Unbalanced braces (open: ${openBraces}, close: ${closeBraces})`);
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