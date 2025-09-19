import templateRegistry from './lib/templates/registry/index.js';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testPreambleOnly() {
  try {
    console.log('Testing preamble-only LaTeX compilation...');
    await templateRegistry.initialize();
    const template = await templateRegistry.getTemplateById('Eng-Technical-1col');
    
    // Create a test document with just the preamble and a simple document
    const testDoc = template.preamble + '\n\\begin{document}\n' +
      '\\section{Test Section}\n' +
      'This is a test.\n' +
      '\\subsection{Test Subsection}\n' +
      'This is a subsection.\n' +
      '\\end{document}';
    
    console.log('Test document created, length:', testDoc.length);
    
    // Create temp directory
    const tempDir = path.join(process.cwd(), 'temp', 'test-preamble-only');
    await fs.mkdir(tempDir, { recursive: true });
    
    const texFile = path.join(tempDir, 'resume.tex');
    const pdfFile = path.join(tempDir, 'resume.pdf');
    
    // Write test file
    await fs.writeFile(texFile, testDoc);
    console.log('LaTeX file written to:', texFile);
    
    // Try compilation with tectonic
    console.log('Testing with tectonic...');
    try {
      const { stdout, stderr } = await execAsync(
        `cd "${tempDir}" && tectonic --chatter minimal --keep-logs resume.tex`,
        { timeout: 30000 }
      );
      
      const pdfExists = await fs.access(pdfFile).then(() => true).catch(() => false);
      
      if (pdfExists) {
        const stats = await fs.stat(pdfFile);
        console.log('✅ tectonic compilation successful!');
        console.log('PDF size:', stats.size, 'bytes');
      } else {
        console.log('❌ tectonic compilation failed - no PDF generated');
        console.log('stdout:', stdout);
        console.log('stderr:', stderr);
      }
    } catch (tectonicError) {
      console.log('❌ tectonic failed:', tectonicError.message);
      if (tectonicError.stderr) {
        console.log('Error details:', tectonicError.stderr);
      }
    }
    
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log('Cleanup completed');
    
  } catch (error) {
    console.error('Error testing preamble-only LaTeX:', error);
  }
}

testPreambleOnly();
