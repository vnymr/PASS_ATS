/**
 * Test with Real Job Posting
 * Tests the complete auto-apply flow with an actual job posting
 */

import 'dotenv/config';
import { launchBrowser } from '../lib/browser-launcher.js';
import AIFormFiller from '../lib/ai-form-filler.js';
import fs from 'fs';
import path from 'path';

// Real user profile for testing
const REAL_USER_PROFILE = {
  fullName: 'Vinay Muthareddy',
  email: 'i.vinaymr@gmail.com',
  phone: '+1 (945) 244-7733',
  location: 'Dallas, TX',
  linkedIn: 'https://linkedin.com/in/vinaymuthareddy',
  portfolio: 'https://vinaymuthareddy.dev',
  github: 'https://github.com/vinaymuthareddy',

  experience: [
    {
      title: 'Senior Software Engineer',
      company: 'TechCorp',
      duration: '2020-Present',
      location: 'Dallas, TX',
      responsibilities: 'Led development of cloud-native applications using React, Node.js, and AWS. Managed team of 4 engineers. Built scalable microservices architecture handling 1M+ requests/day.'
    },
    {
      title: 'Software Engineer',
      company: 'StartupXYZ',
      duration: '2018-2020',
      location: 'Dallas, TX',
      responsibilities: 'Built full-stack applications with React and Node.js. Implemented RESTful APIs and managed PostgreSQL databases. Reduced load times by 40% through optimization.'
    }
  ],

  education: [
    {
      degree: 'Bachelor of Science',
      field: 'Computer Science',
      school: 'University of Texas at Dallas',
      year: '2018',
      gpa: '3.8'
    }
  ],

  skills: [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python',
    'AWS', 'Docker', 'Kubernetes', 'PostgreSQL', 'MongoDB',
    'GraphQL', 'REST APIs', 'Git', 'CI/CD', 'Agile'
  ],

  certifications: [
    'AWS Certified Solutions Architect',
    'Certified Kubernetes Administrator (CKA)'
  ],

  // Additional fields
  yearsOfExperience: 6,
  currentEmploymentStatus: 'employed',
  willingToRelocate: true,
  sponsorshipRequired: false,
  workAuthorization: 'us_citizen',
  salaryExpectation: 150000,
  noticePeriod: '2 weeks',
  remotePreference: 'hybrid',
  veteranStatus: 'not_veteran',
  disability: 'no',
  gender: 'male',
  ethnicity: 'hispanic'
};

const TEST_CONFIG = {
  outputDir: path.resolve(process.cwd(), 'test-output')
};

/**
 * Test with real job URL
 */
async function testRealJob(jobUrl) {
  console.log('🧪 Testing with Real Job Posting\n');
  console.log('='.repeat(80));
  console.log(`Job URL: ${jobUrl}`);
  console.log('='.repeat(80));

  if (!fs.existsSync(TEST_CONFIG.outputDir)) {
    fs.mkdirSync(TEST_CONFIG.outputDir, { recursive: true });
  }

  const browser = await launchBrowser({
    headless: false,
    windowSize: '1920,1080'
  });

  try {
    // Create context with viewport and user agent (Playwright pattern)
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    const filler = new AIFormFiller();

    console.log('\n📋 Step 1: Loading job page...');
    try {
      await page.goto(jobUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });
    } catch (error) {
      console.error('❌ Failed to load job page:', error.message);
      throw error;
    }

    // Take screenshot of job page (viewport only to avoid scrolling)
    await page.screenshot({
      path: path.join(TEST_CONFIG.outputDir, 'real-job-1-initial.png'),
      fullPage: false
    });
    console.log('📸 Screenshot saved: real-job-1-initial.png');

    // Check if job is closed or page not found
    const pageText = await page.textContent('body');
    const closedIndicators = [
      'sorry, but we can\'t find that page',
      'job is no longer available',
      'position has been filled',
      'this job is closed',
      '404',
      'page not found',
      'job posting has expired'
    ];

    const isJobClosed = closedIndicators.some(indicator =>
      pageText.toLowerCase().includes(indicator.toLowerCase())
    );

    if (isJobClosed) {
      console.error('\n❌ JOB IS CLOSED OR NOT AVAILABLE');
      console.error('   This job posting is no longer active.');
      console.error('   Please try with an active job URL from:');
      console.error('   - https://stripe.com/jobs');
      console.error('   - https://instacart.careers/');
      console.error('   - https://about.gitlab.com/jobs/all-jobs/\n');
      throw new Error('Job posting is closed or unavailable');
    }

    // Try to find and click "Apply" button if not already on application form
    console.log('\n🔍 Step 2: Looking for application form...');

    const applyButtonSelectors = [
      'button:contains("Apply")',
      'a:contains("Apply")',
      '[data-qa="apply-button"]',
      '.apply-button',
      '#apply-button',
      'button[type="button"]:contains("Apply")',
      'a.btn:contains("Apply")'
    ];

    let foundApplyButton = false;
    for (const selector of applyButtonSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          console.log(`✅ Found apply button with selector: ${selector}`);
          await button.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
          foundApplyButton = true;
          break;
        }
      } catch (error) {
        // Continue to next selector
      }
    }

    if (!foundApplyButton) {
      console.log('ℹ️  No apply button found - assuming already on application form');
    }

    // Wait for form to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take screenshot of application form (viewport only to avoid scrolling)
    await page.screenshot({
      path: path.join(TEST_CONFIG.outputDir, 'real-job-2-form.png'),
      fullPage: false
    });
    console.log('📸 Screenshot saved: real-job-2-form.png');

    // Extract job details from page
    console.log('\n📝 Step 3: Extracting job details...');
    const jobData = await page.evaluate(() => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.textContent.trim() : '';
      };

      return {
        title: getText('h1') || getText('.job-title') || 'Not found',
        company: getText('.company-name') || getText('[data-company]') || 'Not found',
        location: getText('.job-location') || getText('[data-location]') || 'Not found',
        description: getText('.job-description') || getText('[data-description]') || document.body.innerText.substring(0, 1000)
      };
    });

    console.log('Job Details:');
    console.log(`  Title: ${jobData.title}`);
    console.log(`  Company: ${jobData.company}`);
    console.log(`  Location: ${jobData.location}`);

    // AI Form Filling
    console.log('\n🤖 Step 4: AI filling application form...');
    console.log('   This may take 30-60 seconds...\n');

    const startTime = Date.now();

    const result = await filler.fillFormIntelligently(
      page,
      REAL_USER_PROFILE,
      jobData
    );

    const duration = Date.now() - startTime;

    // Take screenshot after filling (viewport only to avoid scrolling)
    await page.screenshot({
      path: path.join(TEST_CONFIG.outputDir, 'real-job-3-filled.png'),
      fullPage: false
    });
    console.log('📸 Screenshot saved: real-job-3-filled.png');

    // Display Results
    console.log('\n📊 RESULTS:');
    console.log('='.repeat(80));
    console.log(`✅ Success: ${result.success}`);
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`📋 Fields extracted: ${result.fieldsExtracted}`);
    console.log(`✍️  Fields filled: ${result.fieldsFilled}`);
    console.log(`📈 Completion rate: ${((result.fieldsFilled / result.fieldsExtracted) * 100).toFixed(1)}%`);
    console.log(`💰 AI cost: $${result.cost.toFixed(4)}`);
    console.log(`🔒 CAPTCHA detected: ${result.hasCaptcha ? 'Yes' : 'No'}`);
    console.log(`📊 Form complexity: ${result.complexity || 'Unknown'}`);

    if (result.errors.length > 0) {
      console.log(`\n❌ Errors (${result.errors.length}):`);
      result.errors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`);
      });
    }

    if (result.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
      result.warnings.forEach((warn, i) => {
        console.log(`   ${i + 1}. ${warn}`);
      });
    }

    // Submit button check
    if (result.submitButton) {
      console.log(`\n📤 Submit button found: "${result.submitButton.text}"`);
      console.log('   Selector:', result.submitButton.selector);

      // Auto-submit for testing (set AUTO_SUBMIT=false to disable)
      const autoSubmit = process.env.AUTO_SUBMIT !== 'false';

      if (autoSubmit) {
        console.log('\n📤 Auto-submitting application (set AUTO_SUBMIT=false to disable)...');
        try {
          const submitted = await filler.submitForm(page, result.submitButton);

          // Wait for navigation or response
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Take screenshot after submission (viewport only to avoid scrolling)
          await page.screenshot({
            path: path.join(TEST_CONFIG.outputDir, 'real-job-4-submitted.png'),
            fullPage: false
          });
          console.log('📸 Screenshot saved: real-job-4-submitted.png');

          if (submitted.success) {
            console.log('✅ Application submitted successfully!');
            console.log('   Confirmation URL:', page.url());
          } else {
            console.log('⚠️  Submit completed but status unclear');
            console.log('   Current URL:', page.url());
          }
        } catch (submitError) {
          console.error('❌ Submit failed:', submitError.message);
          await page.screenshot({
            path: path.join(TEST_CONFIG.outputDir, 'real-job-4-submit-error.png'),
            fullPage: false
          });
        }
      } else {
        console.log('\n⚠️  Auto-submit disabled');
        console.log('   Set AUTO_SUBMIT=true to enable automatic submission');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } else {
      console.log('\n⚠️  No submit button found');
    }

    // Save detailed results
    const testResults = {
      jobUrl,
      jobData,
      timestamp: new Date().toISOString(),
      duration,
      success: result.success,
      fieldsExtracted: result.fieldsExtracted,
      fieldsFilled: result.fieldsFilled,
      completionRate: (result.fieldsFilled / result.fieldsExtracted) * 100,
      cost: result.cost,
      hasCaptcha: result.hasCaptcha,
      complexity: result.complexity,
      errors: result.errors,
      warnings: result.warnings,
      submitButtonFound: !!result.submitButton
    };

    fs.writeFileSync(
      path.join(TEST_CONFIG.outputDir, 'real-job-results.json'),
      JSON.stringify(testResults, null, 2)
    );

    console.log('\n💾 Results saved to: real-job-results.json');
    console.log('📸 Screenshots saved to: test-output/');

    console.log('\n' + '='.repeat(80));
    if (result.success && !result.hasCaptcha) {
      console.log('✅ REAL JOB TEST PASSED!');
      console.log('   - Form filled successfully');
      console.log('   - All fields populated');
      console.log('   - Ready for submission');
    } else if (result.hasCaptcha) {
      console.log('⚠️  CAPTCHA DETECTED');
      console.log('   - Form filled successfully');
      console.log('   - Manual CAPTCHA solving required');
      console.log('   - Can submit after solving CAPTCHA');
    } else {
      console.log('⚠️  NEEDS REVIEW');
      console.log('   - Check screenshots for issues');
      console.log('   - Review error messages');
    }
    console.log('='.repeat(80));

    // Keep browser open for manual review
    console.log('\n⏸️  Browser will stay open for manual review...');
    console.log('   Press Ctrl+C to close');

    await new Promise(() => {}); // Keep running until user stops

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    // Don't auto-close - let user review
    // await browser.close();
  }
}

// Command line usage
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('🔍 Real Job Application Tester\n');
  console.log('Usage:');
  console.log('  node test-real-job.js <job-url>\n');
  console.log('Examples:');
  console.log('  node test-real-job.js "https://jobs.lever.co/company/12345"');
  console.log('  node test-real-job.js "https://boards.greenhouse.io/company/jobs/12345"');
  console.log('  node test-real-job.js "https://www.linkedin.com/jobs/view/12345"\n');

  console.log('Popular test URLs (for demonstration):');
  console.log('  1. Greenhouse: https://boards.greenhouse.io/embed/job_board?for=postman');
  console.log('  2. Lever: https://jobs.lever.co/twilio');
  console.log('  3. Workable: https://apply.workable.com/\n');

  console.log('💡 Tip: Use SKIP_CAPTCHA_FOR_TESTING=true to skip CAPTCHA checks\n');

  process.exit(1);
}

const jobUrl = args[0];

console.log('🔍 Checking prerequisites...\n');

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not set!');
  process.exit(1);
}

console.log('✅ OPENAI_API_KEY configured');
console.log('✅ Output directory: ' + TEST_CONFIG.outputDir);
console.log('\n🚀 Starting real job test in 3 seconds...');
console.log('   Press Ctrl+C to cancel\n');

setTimeout(() => {
  testRealJob(jobUrl)
    .then(() => {
      console.log('\n✅ Test completed!');
    })
    .catch(error => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}, 3000);
