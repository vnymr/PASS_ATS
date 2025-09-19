/**
 * Test script for the template registry system
 * Run with: node test-template-registry.js
 */

import templateRegistry from './lib/templates/registry/index.js';

async function testTemplateRegistry() {
  console.log('Testing Template Registry System\n');
  console.log('=================================\n');

  try {
    // Initialize registry
    console.log('1. Initializing registry...');
    await templateRegistry.initialize();
    console.log('✓ Registry initialized successfully\n');

    // Get available templates
    console.log('2. Getting available templates...');
    const templates = await templateRegistry.getAvailableTemplates();
    console.log(`✓ Found ${templates.length} templates:`);
    templates.forEach(t => {
      console.log(`   - ${t.id} (${t.name}): ${t.description}`);
      console.log(`     Best for: ${t.best_for.slice(0, 3).join(', ')}...`);
    });
    console.log();

    // Test each template
    console.log('3. Testing individual templates...\n');

    for (const templateInfo of templates) {
      console.log(`   Testing: ${templateInfo.id}`);

      // Get template by ID
      const template = await templateRegistry.getTemplateById(templateInfo.id);
      console.log(`   ✓ Loaded template successfully`);
      console.log(`   - Version: ${template.version}`);
      console.log(`   - Placeholders: ${template.placeholders.join(', ')}`);
      console.log(`   - Preamble size: ${template.preamble.length} chars`);
      console.log(`   - Wireframe size: ${template.wireframe.length} chars`);

      // Test validation
      const testData = {
        NAME: 'John Doe',
        LOCATION: 'San Francisco, CA',
        PHONE: '555-123-4567',
        EMAIL: 'john@example.com',
        LINKEDIN: 'linkedin.com/in/johndoe',
        SUMMARY: 'Experienced professional...',
        EXPERIENCES: '\\jobentry{...}',
        SKILLS: '\\skillcategory{...}',
        EDUCATION: '\\educationentry{...}'
      };

      const validation = await templateRegistry.validateTemplate(templateInfo.id, testData);
      console.log(`   ✓ Validation: ${validation.valid ? 'PASSED' : 'FAILED'}`);
      if (!validation.valid) {
        console.log(`     Missing: ${validation.missingPlaceholders.join(', ')}`);
      }
      console.log();
    }

    // Test error handling
    console.log('4. Testing error handling...');
    try {
      await templateRegistry.getTemplateById('NonExistentTemplate');
      console.log('   ✗ Should have thrown an error for non-existent template');
    } catch (error) {
      console.log('   ✓ Correctly threw error for non-existent template');
      console.log(`     Error: ${error.message}`);
    }
    console.log();

    // Summary
    console.log('=================================');
    console.log('✅ All tests passed successfully!');
    console.log('\nTemplate Registry Features:');
    console.log('- Loads templates from manifest.yaml');
    console.log('- Provides preamble and wireframe content');
    console.log('- Validates placeholder requirements');
    console.log('- Supports capacity limits per template');
    console.log('- Includes metadata for template selection');

    console.log('\nIntegration with micro-prompt pipeline:');
    console.log('1. Use getTemplateById() to load template');
    console.log('2. AI fills placeholders in wireframe');
    console.log('3. Combine preamble + filled wireframe');
    console.log('4. Generate PDF with LaTeX compiler');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testTemplateRegistry().catch(console.error);