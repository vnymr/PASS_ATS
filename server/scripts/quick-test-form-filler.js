/**
 * Quick Test: AI Form Filler
 * Simple test to verify Puppeteer and AI form filling works
 */

import puppeteer from 'puppeteer';
import AIFormFiller from '../lib/ai-form-filler.js';

// Simple test configuration
const testProfile = {
  fullName: 'Jane Smith',
  email: 'jane.smith@example.com',
  phone: '+1-555-123-4567',
  location: 'New York, NY',
  linkedIn: 'https://linkedin.com/in/janesmith',
  portfolio: 'https://janesmith.dev',
  experience: [
    {
      title: 'Senior Engineer',
      company: 'Tech Co',
      duration: '2021-Present'
    }
  ],
  education: [
    {
      degree: 'BS Computer Science',
      field: 'Computer Science',
      school: 'MIT',
      year: 2020
    }
  ],
  skills: ['JavaScript', 'React', 'Node.js']
};

const testJob = {
  title: 'Full Stack Engineer',
  company: 'Amazing Company',
  description: 'We need a great engineer',
  location: 'Remote'
};

async function runQuickTest() {
  console.log('🚀 Quick Test: AI Form Filler\n');

  // Check API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not set!');
    console.error('   Set it with: export OPENAI_API_KEY=sk-...');
    process.exit(1);
  }

  console.log('✅ OpenAI API key found');
  console.log('🌐 Launching browser...\n');

  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    slowMo: 50,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    const filler = new AIFormFiller();

    console.log('📄 Navigating to test form (httpbin.org)...');
    await page.goto('https://httpbin.org/forms/post', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('✅ Page loaded\n');
    console.log('=' .repeat(60));
    console.log('STEP 1: Extracting Form Fields');
    console.log('=' .repeat(60));

    const extraction = await filler.extractor.extractComplete(page);
    console.log(`✅ Found ${extraction.fields.length} fields`);
    console.log(`   Complexity: ${extraction.complexity.complexity}`);
    console.log(`   CAPTCHA: ${extraction.hasCaptcha ? 'Yes ⚠️' : 'No ✅'}`);
    console.log(`   Submit button: ${extraction.submitButton ? '✅ Found' : '❌ Not found'}\n`);

    console.log('Field List:');
    extraction.fields.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.name} (${f.type}) ${f.required ? '[REQUIRED]' : ''}`);
      console.log(`     Label: "${f.label || 'N/A'}"`);
      if (f.options && f.options.length > 0) {
        console.log(`     Options: ${f.options.map(o => o.text).slice(0, 3).join(', ')}...`);
      }
    });

    console.log('\n' + '=' .repeat(60));
    console.log('STEP 2: Generating AI Responses');
    console.log('=' .repeat(60));

    const responses = await filler.intelligence.generateFieldResponses(
      extraction.fields,
      testProfile,
      testJob
    );

    console.log(`✅ Generated ${Object.keys(responses).length} responses\n`);
    Object.entries(responses).forEach(([name, value]) => {
      const displayValue = String(value).length > 60
        ? String(value).substring(0, 60) + '...'
        : value;
      console.log(`  ${name}: "${displayValue}"`);
    });

    console.log('\n' + '=' .repeat(60));
    console.log('STEP 3: Validating Responses');
    console.log('=' .repeat(60));

    const validation = filler.intelligence.validateResponses(responses, extraction.fields);
    console.log(`  Valid: ${validation.valid ? '✅' : '❌'}`);
    console.log(`  Errors: ${validation.errors.length}`);
    console.log(`  Warnings: ${validation.warnings.length}`);

    if (validation.errors.length > 0) {
      console.log('\n  Errors:');
      validation.errors.forEach(e => console.log(`    ❌ ${e.field}: ${e.message}`));
    }

    console.log('\n' + '=' .repeat(60));
    console.log('STEP 4: Filling Form');
    console.log('=' .repeat(60));

    const fillResult = await filler.fillFields(page, extraction.fields, responses);
    console.log(`  Filled: ${fillResult.filled}/${extraction.fields.length} fields`);
    console.log(`  Success rate: ${((fillResult.filled / extraction.fields.length) * 100).toFixed(1)}%`);

    if (fillResult.errors.length > 0) {
      console.log('\n  Errors:');
      fillResult.errors.forEach(e => console.log(`    ❌ ${e}`));
    }

    console.log('\n' + '=' .repeat(60));
    console.log('RESULTS');
    console.log('=' .repeat(60));

    const costSummary = filler.intelligence.getCostSummary();
    console.log(`  ✅ Form filled successfully!`);
    console.log(`  📊 Fields filled: ${fillResult.filled}/${extraction.fields.length}`);
    console.log(`  💰 Total cost: $${costSummary.totalCost.toFixed(4)}`);
    console.log(`  🔢 API calls: ${costSummary.totalRequests}`);
    console.log(`  📝 Tokens used: ${costSummary.totalTokens}`);

    console.log('\n⏸️  Keeping browser open for 10 seconds so you can see the filled form...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run the test
runQuickTest()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
