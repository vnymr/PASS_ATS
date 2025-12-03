/**
 * Comprehensive test suite for job metadata extraction
 * Tests all functions before production deployment
 */

import { extractJobMetadata } from '../lib/job-metadata-extractor.js';

// Sample job descriptions for testing
const testCases = [
  {
    name: 'Sales Role (Brex)',
    title: 'Expansion Account Executive, Enterprise',
    description: `
      As an Expansion Account Executive, you'll own a portfolio of high-value accounts
      within Brex's Enterprise and Upper Mid-Market segments. Your role will be pivotal
      in fostering business expansion and ensuring sustained client success.

      Requirements:
      • 3+ years of B2B closing experience in SaaS, payments, or financial technology
      • Proven success managing enterprise-level accounts with complex deal cycles
      • Track record of driving net revenue growth through upsell, cross-sell
      • Proficiency with sales tools such as Salesforce, Outreach, and Gong

      Compensation: The expected OTE range is $146,400 - $183,000

      Benefits: Health insurance, 401(k), equity/stock options, remote work flexibility
    `,
    expectedSkills: ['Salesforce', 'B2B Sales', 'Enterprise', 'SaaS', 'Outreach', 'Gong'],
    expectedExperience: '3+ years'
  },
  {
    name: 'Engineering Role',
    title: 'Senior Software Engineer',
    description: `
      We're looking for a Senior Software Engineer to join our team.

      Requirements:
      - 5+ years of professional software development experience
      - Strong proficiency in JavaScript/TypeScript and React
      - Experience with Node.js and PostgreSQL
      - Familiarity with AWS, Docker, and Kubernetes
      - Bachelor's degree in Computer Science or related field

      Benefits:
      - Competitive salary $150k-$200k
      - Health, dental, vision insurance
      - 401(k) with company match
      - Unlimited PTO
      - Remote work options
    `,
    expectedSkills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS', 'Docker', 'Kubernetes'],
    expectedExperience: '5+ years'
  },
  {
    name: 'Entry Level Role',
    title: 'Junior Data Analyst',
    description: `
      Looking for an entry-level Data Analyst to join our analytics team.

      Requirements:
      - Bachelor's degree in Statistics, Mathematics, or related field
      - 0-2 years of experience in data analysis
      - Proficiency in SQL and Excel
      - Knowledge of Python or R is a plus
      - Strong analytical and communication skills

      We offer health insurance, learning budget, and mentorship program.
    `,
    expectedSkills: ['SQL', 'Excel', 'Python', 'Data Analysis'],
    expectedExperience: '0-2 years'
  },
  {
    name: 'Design Role',
    title: 'Product Designer',
    description: `
      We're seeking a mid-level Product Designer.

      Requirements:
      - 3-5 years of product design experience
      - Expert in Figma, Sketch, and Adobe Creative Suite
      - Strong portfolio demonstrating UX/UI skills
      - Experience with design systems
      - Bachelor's degree in Design or equivalent

      Perks: Remote-first, health insurance, equity, professional development budget
    `,
    expectedSkills: ['Figma', 'Sketch', 'Adobe Creative Suite', 'UX/UI', 'Design Systems'],
    expectedExperience: '3-5 years'
  },
  {
    name: 'No Clear Experience (should extract from context)',
    title: 'Marketing Manager',
    description: `
      Lead our marketing team and drive growth initiatives.

      We're looking for someone with a proven track record in B2B marketing,
      preferably with several years managing teams and campaigns. Experience
      with HubSpot, Google Analytics, and marketing automation is essential.

      Benefits include competitive salary, health coverage, and stock options.
    `,
    expectedSkills: ['B2B Marketing', 'HubSpot', 'Google Analytics', 'Marketing Automation', 'Leadership'],
    expectedExperience: null // Should still try to extract something
  }
];

async function runTests() {
  console.log('🧪 Starting Comprehensive Test Suite\n');
  console.log('=' .repeat(80));

  let passCount = 0;
  let failCount = 0;
  const results = [];

  for (const testCase of testCases) {
    console.log(`\n📋 Test Case: ${testCase.name}`);
    console.log('-'.repeat(80));
    console.log(`Title: ${testCase.title}`);

    try {
      // Run extraction
      const startTime = Date.now();
      const metadata = await extractJobMetadata(
        testCase.title,
        testCase.description,
        ''
      );
      const duration = Date.now() - startTime;

      console.log(`\n✅ Extraction completed in ${duration}ms`);
      console.log('\nExtracted Data:');
      console.log(`  Experience: ${metadata.extractedExperience || 'None'}`);
      console.log(`  Job Level: ${metadata.extractedJobLevel || 'None'}`);
      console.log(`  Skills (${metadata.extractedSkills.length}): ${metadata.extractedSkills.join(', ')}`);
      console.log(`  Keywords (${metadata.extractedKeywords.length}): ${metadata.extractedKeywords.join(', ')}`);
      console.log(`  Benefits (${metadata.extractedBenefits.length}): ${metadata.extractedBenefits.join(', ')}`);
      console.log(`  Confidence: ${(metadata.extractionConfidence * 100).toFixed(0)}%`);

      // Validation
      const validations = [];

      // Check experience extraction
      if (testCase.expectedExperience) {
        const experienceMatch = metadata.extractedExperience?.includes(testCase.expectedExperience.split('+')[0]);
        validations.push({
          name: 'Experience Match',
          pass: experienceMatch,
          expected: testCase.expectedExperience,
          actual: metadata.extractedExperience
        });
      }

      // Check skill extraction (at least some expected skills should be found)
      const foundSkills = testCase.expectedSkills.filter(expected =>
        metadata.extractedSkills.some(actual =>
          actual.toLowerCase().includes(expected.toLowerCase()) ||
          expected.toLowerCase().includes(actual.toLowerCase())
        )
      );
      const skillMatchRate = foundSkills.length / testCase.expectedSkills.length;
      validations.push({
        name: 'Skill Extraction',
        pass: skillMatchRate >= 0.5, // At least 50% of expected skills found
        expected: `${testCase.expectedSkills.length} skills`,
        actual: `${foundSkills.length} matched (${(skillMatchRate * 100).toFixed(0)}%)`
      });

      // Check that we got some data
      validations.push({
        name: 'Non-empty Results',
        pass: metadata.extractedSkills.length > 0,
        expected: 'Some skills extracted',
        actual: `${metadata.extractedSkills.length} skills`
      });

      // Check confidence
      validations.push({
        name: 'High Confidence',
        pass: metadata.extractionConfidence >= 0.5,
        expected: 'Confidence >= 50%',
        actual: `${(metadata.extractionConfidence * 100).toFixed(0)}%`
      });

      console.log('\n📊 Validation Results:');
      validations.forEach(v => {
        const icon = v.pass ? '✅' : '❌';
        console.log(`  ${icon} ${v.name}: Expected "${v.expected}", Got "${v.actual}"`);
      });

      const allPassed = validations.every(v => v.pass);
      if (allPassed) {
        passCount++;
        console.log('\n🎉 Test PASSED');
      } else {
        failCount++;
        console.log('\n⚠️  Test FAILED');
      }

      results.push({
        testCase: testCase.name,
        passed: allPassed,
        duration,
        metadata,
        validations
      });

    } catch (error) {
      console.error(`\n❌ ERROR: ${error.message}`);
      failCount++;
      results.push({
        testCase: testCase.name,
        passed: false,
        error: error.message
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nTotal Tests: ${testCases.length}`);
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Success Rate: ${((passCount / testCases.length) * 100).toFixed(0)}%`);

  const avgDuration = results
    .filter(r => r.duration)
    .reduce((sum, r) => sum + r.duration, 0) / passCount;
  console.log(`\n⏱️  Average Extraction Time: ${avgDuration.toFixed(0)}ms`);

  if (failCount === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Safe to deploy to production.');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED. Review failures before deploying.');
  }

  return { passCount, failCount, results };
}

// Run tests
console.log('🚀 Job Metadata Extraction - Test Suite');
console.log('Testing extraction quality before production deployment\n');

runTests()
  .then(({ passCount, failCount }) => {
    process.exit(failCount > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('\n💥 Test suite crashed:', error);
    process.exit(1);
  });
