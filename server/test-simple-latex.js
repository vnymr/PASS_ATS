import templateRegistry from './lib/templates/registry/index.js';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testSimpleLaTeXCompilation() {
  try {
    console.log('Testing simple LaTeX compilation...');
    await templateRegistry.initialize();
    const template = await templateRegistry.getTemplateById('Eng-Technical-1col');
    
    // Create a simple test document
    const testDoc = template.preamble + '\n\\begin{document}\n' +
      '\\resumeheader{Test User}{Dallas, TX}{555-123-4567}{test@example.com}{linkedin.com/in/test}\n' +
      '\\section{Professional Summary}\n' +
      'Test summary for compilation testing.\n' +
      '\\section{Professional Experience}\n' +
      '\\subsection{Software Engineer}{Test Company}{2020-2024}{Dallas, TX}\n' +
      '\\begin{itemize}\n' +
      '\\item Test achievement with metrics (50% improvement)\n' +
      '\\end{itemize}\n' +
      '\\section{Technical Skills}\n' +
      '\\techskillcategory{Languages}{JavaScript, Python}\n' +
      '\\section{Education}\n' +
      '\\educationentry{BS Computer Science}{Test University}{2020}{GPA: 3.8}\n' +
      '\\end{document}';
    
    console.log('Test document created, length:', testDoc.length);
    
    // Create temp directory
    const tempDir = path.join(process.cwd(), 'temp', 'test-latex-compilation');
    await fs.mkdir(tempDir, { recursive: true });
    
    const texFile = path.join(tempDir, 'resume.tex');
    const pdfFile = path.join(tempDir, 'resume.pdf');
    
    // Write test file
    await fs.writeFile(texFile, testDoc);
    console.log('LaTeX file written to:', texFile);
    
    // Try compilation with pdflatex
    console.log('Testing with pdflatex...');
    try {
      const { stdout, stderr } = await execAsync(
        `cd "${tempDir}" && pdflatex -interaction=nonstopmode resume.tex`,
        { timeout: 30000 }
      );
      
      const pdfExists = await fs.access(pdfFile).then(() => true).catch(() => false);
      
      if (pdfExists) {
        const stats = await fs.stat(pdfFile);
        console.log('✅ pdflatex compilation successful!');
        console.log('PDF size:', stats.size, 'bytes');
      } else {
        console.log('❌ pdflatex compilation failed - no PDF generated');
        console.log('stdout:', stdout);
        console.log('stderr:', stderr);
      }
    } catch (pdflatexError) {
      console.log('❌ pdflatex failed:', pdflatexError.message);
    }
    
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
    }
    
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log('Cleanup completed');
    
  } catch (error) {
    console.error('Error testing LaTeX compilation:', error);
  }
}

testSimpleLaTeXCompilation();
