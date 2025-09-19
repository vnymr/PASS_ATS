import { jdDigestPrompt } from './lib/prompts/jdDigestPrompt.js';
import { generateResumeWithJdDigest } from './lib/resume-generator.js';

async function testJdDigest() {
  console.log('🧪 Testing JD Digest Prompt System\n');
  
  const sampleJD = `
    Senior Software Engineer - Full Stack

    We're looking for an experienced full-stack engineer to join our growing team.

    Requirements:
    - 5+ years of experience with React, Node.js, and TypeScript
    - Strong understanding of AWS services (EC2, S3, Lambda)
    - Experience with PostgreSQL and Redis
    - Familiarity with CI/CD pipelines and Docker
    - Excellent communication skills

    Responsibilities:
    - Design and implement scalable web applications
    - Collaborate with product managers and designers
    - Mentor junior developers
    - Participate in code reviews
    - Optimize application performance
    - Write technical documentation

    Our company values innovation, collaboration, and continuous learning.
    We're building next-generation fintech solutions for small businesses.
  `;

  const sampleResume = `
    John Doe
    Software Engineer
    New York, NY | (555) 123-4567 | john.doe@email.com

    EXPERIENCE:
    - Led team of 5 developers for 3 years
    - Improved application performance by 30%
    - Built scalable web applications using React and Node.js
    - Mentored 3 junior developers
    - Participated in code reviews and technical planning

    SKILLS:
    - React, Node.js, JavaScript, TypeScript
    - AWS (EC2, S3), PostgreSQL, Redis
    - Docker, CI/CD, Git
    - Team leadership, mentoring

    EDUCATION:
    - BS Computer Science, NYU (2016)
  `;

  try {
    // Test 1: JD Digest Analysis
    console.log('📊 Step 1: Analyzing Job Description...');
    const jdDigest = await jdDigestPrompt(sampleJD);
    console.log('✅ JD Analysis Complete:');
    console.log(`   Role Family: ${jdDigest.roleFamily}`);
    console.log(`   Seniority: ${jdDigest.seniority}`);
    console.log(`   Industry: ${jdDigest.industry}`);
    console.log(`   Company Size: ${jdDigest.companySize}`);
    console.log(`   Keywords: ${jdDigest.keywords.slice(0, 5).join(', ')}...`);
    console.log(`   Responsibilities: ${jdDigest.responsibilities.length} items\n`);

    // Test 2: Resume Generation with JD Digest
    console.log('🎯 Step 2: Generating Resume with JD Digest...');
    const result = await generateResumeWithJdDigest({
      jobId: 'test-jd-digest',
      resumeText: sampleResume,
      jobDescription: sampleJD,
      aiMode: 'gpt-4',
      relevantContent: null
    });

    if (result.success) {
      console.log('✅ Resume Generated Successfully!');
      console.log(`   LaTeX Source Length: ${result.artifacts.latexSource.length} characters`);
      console.log(`   PDF Buffer Size: ${result.artifacts.pdfBuffer.length} bytes`);
      console.log(`   Generation Type: ${result.artifacts.generationType}`);
      console.log(`   JD Digest Used: ${result.artifacts.jdDigest.roleFamily} in ${result.artifacts.jdDigest.industry}`);
    } else {
      console.log('❌ Resume Generation Failed:');
      console.log(`   Error: ${result.error}`);
    }

  } catch (error) {
    console.error('❌ Test Failed:', error.message);
  }
}

// Run the test
testJdDigest();
