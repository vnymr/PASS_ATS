import templateRegistry from './lib/templates/registry/index.js';

async function testTemplate() {
  try {
    console.log('Testing template loading...');
    await templateRegistry.initialize();
    const template = await templateRegistry.getTemplateById('Eng-Technical-1col');
    
    console.log('Template loaded successfully:', template.id);
    console.log('Template structure:', Object.keys(template));
    console.log('Preamble exists:', !!template.preamble);
    console.log('Wireframe exists:', !!template.wireframe);
    
    if (template.preamble) {
      console.log('Preamble contains hyperref fix:', template.preamble.includes('colorlinks=false'));
      console.log('Preamble length:', template.preamble.length);
    }
    
    if (template.wireframe) {
      console.log('Wireframe length:', template.wireframe.length);
    }
    
  } catch (error) {
    console.error('Error testing template:', error);
  }
}

testTemplate();
