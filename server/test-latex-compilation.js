import templateRegistry from './lib/templates/registry/index.js';
import { compileLaTeXToPDF } from './lib/pipeline/runPipeline.js';

async function testLaTeXCompilation() {
  try {
    console.log('Testing LaTeX compilation...');
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
    console.log('Testing compilation...');
    
    const result = await compileLaTeXToPDF(testDoc, 'test-compilation');
    
    if (result.success) {
      console.log('✅ LaTeX compilation successful!');
      console.log('PDF size:', result.metadata.size, 'bytes');
      console.log('Pages:', result.metadata.pages);
    } else {
      console.log('❌ LaTeX compilation failed:', result.error);
    }
    
  } catch (error) {
    console.error('Error testing LaTeX compilation:', error);
  }
}

testLaTeXCompilation();
