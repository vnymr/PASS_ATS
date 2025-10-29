/**
 * Test suite for skill matching algorithm
 */

import { calculateSkillMatch, getMatchCategory, extractUserSkills } from './skillMatcher';

// Test cases
const testCases = [
  {
    name: 'Perfect Match',
    userSkills: ['JavaScript', 'React', 'Node.js', 'PostgreSQL', 'AWS'],
    jobSkills: ['JavaScript', 'React', 'Node.js', 'PostgreSQL', 'AWS'],
    expectedPercentage: 100
  },
  {
    name: 'Partial Match (60%)',
    userSkills: ['JavaScript', 'React', 'Vue'],
    jobSkills: ['JavaScript', 'React', 'Angular', 'TypeScript', 'Node.js'],
    expectedMin: 35,
    expectedMax: 45
  },
  {
    name: 'No Match',
    userSkills: ['Python', 'Django', 'Flask'],
    jobSkills: ['Java', 'Spring', 'Hibernate'],
    expectedPercentage: 0
  },
  {
    name: 'Abbreviation Match (JS = JavaScript)',
    userSkills: ['JS', 'Node'],
    jobSkills: ['JavaScript', 'Node.js'],
    expectedMin: 50, // Should match at least partially
    expectedMax: 100
  },
  {
    name: 'Case Insensitive Match',
    userSkills: ['javascript', 'REACT', 'TypeScript'],
    jobSkills: ['JavaScript', 'React', 'typescript'],
    expectedPercentage: 100
  },
  {
    name: 'Partial String Match',
    userSkills: ['PostgreSQL', 'MongoDB'],
    jobSkills: ['Postgres', 'Mongo', 'Redis'],
    expectedMin: 60, // Should match PostgreSQL/Postgres and MongoDB/Mongo
    expectedMax: 100
  },
  {
    name: 'Sales Skills',
    userSkills: ['Salesforce', 'B2B Sales', 'Enterprise', 'Cold Calling'],
    jobSkills: ['Salesforce', 'B2B Sales', 'SaaS', 'Enterprise', 'Account Management'],
    expectedMin: 55,
    expectedMax: 65
  },
  {
    name: 'Mixed Technical & Soft Skills',
    userSkills: ['React', 'Leadership', 'Communication', 'Problem Solving'],
    jobSkills: ['React', 'Vue', 'Leadership', 'Team Management', 'Communication'],
    expectedMin: 55,
    expectedMax: 65
  }
];

// Test extractUserSkills
const sampleProfile = {
  skills: ['JavaScript', 'React', 'Node.js'],
  experience: [
    {
      technologies: ['PostgreSQL', 'Redis'],
      keywords: ['AWS', 'Docker']
    }
  ],
  projects: [
    {
      technologies: ['TypeScript', 'Next.js']
    }
  ]
};

function runTests() {
  console.log('🧪 Skill Matching Algorithm - Test Suite\n');
  console.log('='.repeat(80));

  let passCount = 0;
  let failCount = 0;

  // Test skill matching
  testCases.forEach(testCase => {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log('-'.repeat(80));

    const result = calculateSkillMatch(testCase.userSkills, testCase.jobSkills);

    console.log(`User Skills: ${testCase.userSkills.join(', ')}`);
    console.log(`Job Skills: ${testCase.jobSkills.join(', ')}`);
    console.log(`\nResult:`);
    console.log(`  Match Percentage: ${result.matchPercentage}%`);
    console.log(`  Matched Skills (${result.matchedSkills.length}): ${result.matchedSkills.join(', ')}`);
    console.log(`  Missing Skills (${result.missingSkills.length}): ${result.missingSkills.join(', ')}`);

    const category = getMatchCategory(result.matchPercentage);
    console.log(`  Category: ${category.label}`);

    // Validation
    let passed = false;
    if ('expectedPercentage' in testCase) {
      passed = result.matchPercentage === testCase.expectedPercentage;
      console.log(`\n${passed ? '✅' : '❌'} Expected ${testCase.expectedPercentage}%, Got ${result.matchPercentage}%`);
    } else {
      const min = testCase.expectedMin!;
      const max = testCase.expectedMax!;
      passed = result.matchPercentage >= min && result.matchPercentage <= max;
      console.log(`\n${passed ? '✅' : '❌'} Expected ${min}-${max}%, Got ${result.matchPercentage}%`);
    }

    if (passed) {
      passCount++;
    } else {
      failCount++;
    }
  });

  // Test extractUserSkills
  console.log(`\n\n📋 Test: Extract User Skills from Profile`);
  console.log('-'.repeat(80));

  const extractedSkills = extractUserSkills(sampleProfile);
  console.log(`Profile:`, JSON.stringify(sampleProfile, null, 2));
  console.log(`\nExtracted Skills (${extractedSkills.length}): ${extractedSkills.join(', ')}`);

  const expectedSkills = ['JavaScript', 'React', 'Node.js', 'PostgreSQL', 'Redis', 'AWS', 'Docker', 'TypeScript', 'Next.js'];
  const allFound = expectedSkills.every(skill => extractedSkills.includes(skill));

  if (allFound) {
    console.log(`\n✅ All expected skills found`);
    passCount++;
  } else {
    const missing = expectedSkills.filter(s => !extractedSkills.includes(s));
    console.log(`\n❌ Missing skills: ${missing.join(', ')}`);
    failCount++;
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nTotal Tests: ${testCases.length + 1}`);
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Success Rate: ${((passCount / (testCases.length + 1)) * 100).toFixed(0)}%`);

  if (failCount === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Skill matching is working correctly.');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED. Review the algorithm.');
  }

  return failCount === 0;
}

// Run if called directly (Node.js environment)
if (typeof window === 'undefined') {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

export { runTests };
