import templateRegistry from './lib/templates/registry/index.js';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testCustomCommands() {
  try {
    console.log('Testing custom commands LaTeX compilation...');
    await templateRegistry.initialize();
    const template = await templateRegistry.getTemplateById('Eng-Technical-1col');
    
    // Test each custom command individually
    const testDoc = template.preamble + '\n\\begin{document}\n' +
      '\\section{Test Section}\n' +
      'Testing custom commands:\n\n' +
      '1. Testing \\tech{JavaScript} command\n' +
      '2. Testing \\resumeheader{John Doe}{New York, NY}{555-123-4567}{john@example.com}{linkedin.com/in/johndoe}\n' +
      '3. Testing \\jobentry{Software Engineer}{Test Company}{2020-2024}{Dallas, TX}\n' +
      '4. Testing \\techskillcategory{Languages}{JavaScript, Python}\n' +
      '5. Testing \\educationentry{BS Computer Science}{Test University}{2020}{GPA: 3.8}\n' +
      '\\end{document}';
    
    console.log('Test document created, length:', testDoc.length);
    
    // Create temp directory
    const tempDir = path.join(process.cwd(), 'temp', 'test-custom-commands');
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
    console.error('Error testing custom commands LaTeX:', error);
  }
}

testCustomCommands();
