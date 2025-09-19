#!/usr/bin/env node

/**
 * Test all 3 templates with the pipeline
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables FIRST
dotenv.config({ path: join(__dirname, '.env') });

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found');
  process.exit(1);
}

// Now import after env is loaded
const { runPipeline, getMetrics, clearCache } = await import('./lib/pipeline/runPipeline.js');

const templates = [
  { id: 'General-Readable-1col', name: 'General Professional', jd: 'Marketing Manager' },
  { id: 'PO-Compact-1col', name: 'Business Compact', jd: 'Product Owner' },
  { id: 'Eng-Technical-1col', name: 'Technical Professional', jd: 'Senior Software Engineer' }
];

const testResumeText = `John Doe
john.doe@email.com | (555) 123-4567 | San Francisco, CA | linkedin.com/in/johndoe

Senior Software Engineer with 7 years of experience in full-stack development

PROFESSIONAL EXPERIENCE:

Senior Software Engineer | TechCorp Inc. | San Francisco, CA | 2020-Present
- Led development of microservices architecture serving 1M+ daily active users
- Reduced API response time by 40% through optimization and caching strategies
- Mentored team of 5 junior developers, improving team velocity by 25%
- Architected real-time data processing pipeline handling 10TB daily
- Implemented CI/CD pipeline reducing deployment time from 2 hours to 15 minutes

Software Engineer | StartupXYZ | San Francisco, CA | 2017-2020
- Built React-based SaaS platform from scratch, scaling to 50K users
- Developed 20+ RESTful APIs using Node.js and Express
- Optimized database queries reducing load time by 60%
- Integrated third-party payment systems processing $2M monthly
- Led migration from monolithic to microservices architecture

Junior Developer | WebCo | San Francisco, CA | 2016-2017
- Developed responsive web applications using HTML5, CSS3, JavaScript
- Collaborated with design team to implement pixel-perfect UI components
- Fixed 100+ bugs improving application stability by 30%
- Participated in code reviews and agile ceremonies

TECHNICAL SKILLS:
Programming: JavaScript, TypeScript, Python, Java, Go
Frontend: React, Vue.js, Angular, HTML5, CSS3, Redux, Webpack
Backend: Node.js, Express, Django, Spring Boot, GraphQL
Databases: PostgreSQL, MongoDB, Redis, MySQL, DynamoDB
Cloud/DevOps: AWS, GCP, Docker, Kubernetes, Jenkins, GitLab CI
Tools: Git, JIRA, Confluence, Datadog, New Relic

EDUCATION:
B.S. Computer Science | University of California, Berkeley | 2016
Relevant Coursework: Data Structures, Algorithms, Software Engineering, Database Systems

CERTIFICATIONS:
AWS Certified Solutions Architect - Associate (2021)
Google Cloud Professional Developer (2022)`;

async function testTemplate(templateId, templateName, jobTitle) {
  console.log(`\n🔧 Testing: ${templateName} (${templateId})`);
  console.log(`   Job Title: ${jobTitle}`);

  const jobDescription = `${jobTitle}

We are seeking an experienced ${jobTitle} to join our growing team.

Requirements:
- 5+ years of relevant experience
- Strong leadership and communication skills
- Proven track record of success
- Bachelor's degree or equivalent experience
- Experience with modern tools and methodologies

Responsibilities:
- Lead strategic initiatives
- Collaborate with cross-functional teams
- Drive continuous improvement
- Mentor team members
- Deliver high-quality results`;

  try {
    const startTime = Date.now();

    const result = await runPipeline({
      jobDescription,
      resumeText: testResumeText,
      templateId, // Force specific template
      aiMode: 'gpt-4o-mini',
      useCache: false, // Don't cache for testing
      fallbackToCurrent: false
    });

    const duration = Date.now() - startTime;

    if (result.success) {
      console.log(`   ✅ SUCCESS (${duration}ms)`);
      console.log(`   📄 PDF Size: ${result.artifacts?.pdfMetadata?.size || 0} bytes`);
      console.log(`   📋 Template Used: ${result.artifacts?.templateUsed}`);

      if (result.artifacts?.metrics?.stageTimings) {
        const timings = result.artifacts.metrics.stageTimings;
        console.log(`   ⏱️  Stage Timings:`);
        console.log(`      - JD Digest: ${timings.jdDigest || 0}ms`);
        console.log(`      - Candidate: ${timings.candidateDigest || 0}ms`);
        console.log(`      - Plan: ${timings.plan || 0}ms`);
        console.log(`      - LaTeX Gen: ${timings.masterPrompt || 0}ms`);
        console.log(`      - Compile: ${timings.latexCompilation || 0}ms`);
      }

      return true;
    } else {
      console.log(`   ❌ FAILED: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('\n========================================');
  console.log('  TESTING ALL PIPELINE TEMPLATES');
  console.log('========================================');

  console.log('\n📝 Test Configuration:');
  console.log('- Resume: Senior Software Engineer profile');
  console.log('- AI Mode: gpt-4o-mini');
  console.log('- Cache: Disabled for testing');
  console.log('- Fallback: Disabled for testing');

  // Clear cache before testing
  console.log('\n🗑️  Clearing cache...');
  await clearCache();

  let successCount = 0;
  const results = [];

  for (const template of templates) {
    const success = await testTemplate(template.id, template.name, template.jd);
    results.push({ ...template, success });
    if (success) successCount++;
  }

  // Summary
  console.log('\n========================================');
  console.log('  TEST SUMMARY');
  console.log('========================================');

  console.log(`\n📊 Results: ${successCount}/${templates.length} templates passed`);

  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    console.log(`   ${icon} ${r.name}: ${r.success ? 'PASSED' : 'FAILED'}`);
  });

  // Show final metrics
  const metrics = getMetrics();
  console.log('\n📈 Overall Metrics:');
  console.log(`   - Cache Hits: ${metrics.cacheHits}`);
  console.log(`   - Cache Misses: ${metrics.cacheMisses}`);
  console.log(`   - Fallback Usage: ${metrics.fallbackUsage}`);
  console.log(`   - Template Selections:`, metrics.templateSelections);

  if (successCount === templates.length) {
    console.log('\n🎉 All templates passed! Pipeline is working correctly.');
  } else {
    console.log('\n⚠️  Some templates failed. Review the errors above.');
  }
}

main().catch(console.error);