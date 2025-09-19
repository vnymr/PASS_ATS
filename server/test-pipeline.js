#!/usr/bin/env node

/**
 * Test script for the complete pipeline integration
 */

import { runPipeline, testPipeline, getMetrics } from './lib/pipeline/runPipeline.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

async function main() {
  console.log('\n========================================');
  console.log('  PIPELINE INTEGRATION TEST');
  console.log('========================================\n');

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    process.exit(1);
  }

  console.log('✅ OpenAI API key found');
  console.log('🚀 Starting pipeline test...\n');

  try {
    // Run the built-in test
    const result = await testPipeline();

    if (result.success) {
      console.log('\n✅ Pipeline test completed successfully!');
      console.log('\n📊 Metrics:');
      const metrics = getMetrics();
      console.log(JSON.stringify(metrics, null, 2));
    } else {
      console.log('\n❌ Pipeline test failed');
      console.log('Error:', result.error);
    }

    // Test specific templates
    console.log('\n========================================');
    console.log('  TESTING INDIVIDUAL TEMPLATES');
    console.log('========================================\n');

    const templates = [
      'General-Readable-1col',
      'PO-Compact-1col',
      'Eng-Technical-1col'
    ];

    const testJobDescription = `Senior Software Engineer

We are looking for a Senior Software Engineer to join our team.

Requirements:
- 5+ years of experience with JavaScript, Node.js, React
- Experience with cloud platforms (AWS/GCP)
- Strong problem-solving skills
- Bachelor's degree in Computer Science or related field

Responsibilities:
- Design and develop scalable applications
- Lead technical initiatives
- Mentor junior developers
- Collaborate with product team`;

    const testResumeText = `John Doe
john.doe@email.com | (555) 123-4567 | San Francisco, CA

Senior Software Engineer with 7 years of experience

EXPERIENCE:

Senior Software Engineer | TechCorp | 2020-Present
- Led development of microservices architecture serving 1M+ users
- Reduced API latency by 40% through optimization
- Mentored team of 5 junior developers

Software Engineer | StartupXYZ | 2017-2020
- Built React frontend for SaaS platform
- Implemented CI/CD pipeline reducing deployment time by 60%
- Developed RESTful APIs using Node.js and Express

SKILLS:
JavaScript, TypeScript, React, Node.js, AWS, Docker, PostgreSQL

EDUCATION:
B.S. Computer Science | University of California | 2017`;

    for (const templateId of templates) {
      console.log(`\n🔧 Testing template: ${templateId}`);

      try {
        const startTime = Date.now();
        const result = await runPipeline({
          jobDescription: testJobDescription,
          resumeText: testResumeText,
          templateId,
          aiMode: 'gpt-4o-mini',
          useCache: false, // Don't use cache for testing
          fallbackToCurrent: false // Don't fallback for testing
        });

        const duration = Date.now() - startTime;

        if (result.success) {
          console.log(`  ✅ Success (${duration}ms)`);
          console.log(`  📄 PDF size: ${result.artifacts?.pdfMetadata?.size} bytes`);
        } else {
          console.log(`  ❌ Failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
      }
    }

    console.log('\n========================================');
    console.log('  TEST COMPLETE');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);