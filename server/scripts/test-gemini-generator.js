#!/usr/bin/env node
/**
 * Test script for the AI Resume Generator (Gemini-based)
 */

import dotenv from 'dotenv';
dotenv.config();

import AIResumeGenerator from '../lib/ai-resume-generator.js';

// Sample profile data
const testProfile = {
  name: "Jane Smith",
  email: "jane.smith@email.com",
  phone: "(555) 123-4567",
  location: "San Francisco, CA",
  summary: "Senior software engineer with 6 years of experience building scalable web applications",
  experiences: [
    {
      role: "Senior Software Engineer",
      company: "TechCorp Inc",
      dates: "2021 - Present",
      bullets: [
        "Led development of microservices architecture serving 10M+ users",
        "Built real-time data pipeline processing 1M events/day",
        "Mentored team of 5 junior developers"
      ]
    },
    {
      role: "Software Engineer",
      company: "StartupXYZ",
      dates: "2018 - 2021",
      bullets: [
        "Developed React frontend for B2B SaaS platform",
        "Implemented REST APIs using Node.js and Express",
        "Reduced page load time by 40% through performance optimization"
      ]
    }
  ],
  skills: ["JavaScript", "TypeScript", "React", "Node.js", "Python", "PostgreSQL", "AWS", "Docker", "Kubernetes"],
  education: [
    {
      degree: "BS Computer Science",
      institution: "University of California, Berkeley",
      year: "2018"
    }
  ]
};

const testJobDescription = `
Senior Software Engineer at Google

We're looking for a Senior Software Engineer to join our Cloud Platform team.

Requirements:
- 5+ years of software development experience
- Strong proficiency in Python, Java, or Go
- Experience with distributed systems and microservices
- Knowledge of cloud platforms (GCP, AWS, or Azure)
- Experience with Kubernetes and containerization
- Strong problem-solving and communication skills

Nice to have:
- Experience with machine learning infrastructure
- Open source contributions
- Leadership experience

About Google:
We're a company focused on organizing the world's information. Our values include:
- Focus on the user
- Move fast
- Collaboration
`;

async function main() {
  console.log('=== AI Resume Generator Test (Gemini 2.5 Flash) ===\n');

  // Check for API key
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY is not set');
    process.exit(1);
  }
  console.log('✅ GEMINI_API_KEY is configured\n');

  // Initialize generator
  console.log('1. Initializing AI Resume Generator...');
  let generator;
  try {
    generator = new AIResumeGenerator();
    console.log('✅ Generator initialized\n');
  } catch (error) {
    console.error('❌ Failed to initialize generator:', error.message);
    process.exit(1);
  }

  // Test LaTeX generation only
  console.log('2. Testing LaTeX generation (no PDF)...');
  try {
    const startTime = Date.now();
    const { latex, metadata } = await generator.generateResume(testProfile, testJobDescription, {
      enableSearch: true
    });
    const elapsed = Date.now() - startTime;

    console.log(`✅ LaTeX generated successfully in ${elapsed}ms`);
    console.log(`   - Model: ${metadata.model}`);
    console.log(`   - Company detected: ${metadata.company || 'N/A'}`);
    console.log(`   - Used company research: ${metadata.usedCompanyResearch}`);
    console.log(`   - LaTeX length: ${latex.length} chars`);

    // Validate LaTeX structure
    const hasDocClass = latex.includes('\\documentclass');
    const hasBegin = latex.includes('\\begin{document}');
    const hasEnd = latex.includes('\\end{document}');
    console.log(`   - Has \\documentclass: ${hasDocClass}`);
    console.log(`   - Has \\begin{document}: ${hasBegin}`);
    console.log(`   - Has \\end{document}: ${hasEnd}`);

    if (!hasDocClass || !hasBegin || !hasEnd) {
      console.error('❌ Invalid LaTeX structure!');
      process.exit(1);
    }

    // Show a snippet
    console.log('\n   First 300 chars of LaTeX:');
    console.log('   ' + latex.substring(0, 300).replace(/\n/g, '\n   '));

  } catch (error) {
    console.error('❌ LaTeX generation failed:', error.message);
    process.exit(1);
  }

  // Test full pipeline with PDF compilation
  console.log('\n3. Testing full pipeline (LaTeX + PDF)...');
  try {
    const startTime = Date.now();
    const { latex, pdf, metadata } = await generator.generateAndCompile(testProfile, testJobDescription, {
      enableSearch: false  // Disable search for faster test
    });
    const elapsed = Date.now() - startTime;

    console.log(`✅ Full pipeline completed in ${elapsed}ms`);
    console.log(`   - PDF size: ${pdf.length} bytes (${(pdf.length / 1024).toFixed(1)} KB)`);
    console.log(`   - Generation time: ${metadata.generationTime}ms`);
    console.log(`   - Approach: ${metadata.approach}`);

  } catch (error) {
    console.error('❌ Full pipeline failed:', error.message);
    console.log('   (This might fail if LaTeX compiler is not installed)');
  }

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
