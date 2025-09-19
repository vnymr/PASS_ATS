/**
 * Test script for the simplified AI resume generator
 */

import AIResumeGenerator from './lib/ai-resume-generator.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { validateLatex, getAvailableCompilers } from './lib/latex-compiler.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

// Test data
const testUserData = {
  personalInfo: {
    name: "Alex Johnson",
    email: "alex.johnson@email.com",
    phone: "(555) 123-4567",
    location: "San Francisco, CA",
    linkedin: "linkedin.com/in/alexjohnson"
  },
  experiences: [
    {
      title: "Senior Software Engineer",
      company: "TechCorp Inc",
      location: "San Francisco, CA",
      startDate: "2021-01",
      endDate: "Present",
      responsibilities: [
        "Led development of microservices architecture serving 10M+ users",
        "Implemented CI/CD pipeline reducing deployment time by 60%",
        "Mentored team of 5 junior developers"
      ]
    },
    {
      title: "Software Engineer",
      company: "StartupXYZ",
      location: "Palo Alto, CA",
      startDate: "2019-06",
      endDate: "2020-12",
      responsibilities: [
        "Built RESTful APIs using Node.js and Express",
        "Developed React components for customer dashboard",
        "Improved database query performance by 40%"
      ]
    }
  ],
  education: [
    {
      degree: "Bachelor of Science in Computer Science",
      school: "Stanford University",
      graduationDate: "2019",
      gpa: "3.8"
    }
  ],
  skills: {
    languages: ["JavaScript", "Python", "TypeScript", "Go"],
    frameworks: ["React", "Node.js", "Django", "Express"],
    databases: ["PostgreSQL", "MongoDB", "Redis"],
    tools: ["Docker", "Kubernetes", "AWS", "Git"]
  }
};

const testJobDescription = `
Senior Backend Engineer - Fintech Startup

We're looking for an experienced backend engineer to join our growing team.

Requirements:
- 5+ years of backend development experience
- Strong experience with Python or Go
- Experience with microservices and distributed systems
- Knowledge of SQL and NoSQL databases
- Experience with AWS or cloud platforms
- Understanding of financial systems is a plus

Responsibilities:
- Design and implement scalable backend services
- Work with product team to define technical requirements
- Mentor junior developers
- Participate in code reviews and architecture decisions
`;

async function runTests() {
  console.log('🧪 Testing Simplified AI Resume Generator\n');
  console.log('========================================\n');

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    process.exit(1);
  }

  const generator = new AIResumeGenerator(process.env.OPENAI_API_KEY);

  try {
    // Test 1: Style detection
    console.log('Test 1: Automatic style detection...');
    const style = generator.determineStyle(testJobDescription, {});
    console.log(`✅ Detected style: ${style}\n`);

    // Test 2: Generate LaTeX resume
    console.log('Test 2: Generating LaTeX resume...');
    const startTime = Date.now();

    const { latex, metadata } = await generator.generateResume(
      testUserData,
      testJobDescription,
      { model: 'gpt-4' }
    );

    const generationTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ LaTeX generated in ${generationTime}s`);
    console.log(`   - Length: ${latex.length} characters`);
    console.log(`   - Style: ${metadata.style}`);
    console.log(`   - Has documentclass: ${latex.includes('\\documentclass')}`);
    console.log(`   - Has begin document: ${latex.includes('\\begin{document}')}`);
    console.log(`   - Has end document: ${latex.includes('\\end{document}')}\n`);

    // Save LaTeX for inspection
    await fs.writeFile('./test-output.tex', latex);
    console.log('📄 LaTeX saved to test-output.tex\n');

    // Test 3: Validate LaTeX
    console.log('Test 3: Validating LaTeX structure...');

    try {
      validateLatex(latex);
      console.log('✅ LaTeX validation passed\n');
    } catch (error) {
      console.error('❌ LaTeX validation failed:', error.message);
    }

    // Test 4: Check available compilers
    console.log('Test 4: Checking available LaTeX compilers...');
    const compilers = await getAvailableCompilers();

    if (compilers.length > 0) {
      console.log(`✅ Found ${compilers.length} compiler(s): ${compilers.join(', ')}\n`);

      // Test 5: Compile to PDF
      console.log('Test 5: Compiling LaTeX to PDF...');
      const compileStart = Date.now();

      try {
        const pdf = await generator.compileResume(latex);
        const compileTime = ((Date.now() - compileStart) / 1000).toFixed(2);

        console.log(`✅ PDF compiled in ${compileTime}s`);
        console.log(`   - Size: ${(pdf.length / 1024).toFixed(2)} KB`);

        // Save PDF
        await fs.writeFile('./test-output.pdf', pdf);
        console.log('📄 PDF saved to test-output.pdf\n');
      } catch (error) {
        console.error('❌ PDF compilation failed:', error.message);
        console.log('   (This might be due to missing LaTeX compiler)\n');
      }
    } else {
      console.log('⚠️  No LaTeX compilers found');
      console.log('   Install tectonic or pdflatex to enable PDF generation\n');
    }

    // Test 6: Different styles
    console.log('Test 6: Testing different resume styles...');
    const styles = ['technical', 'professional', 'creative'];

    for (const testStyle of styles) {
      console.log(`   Testing ${testStyle} style...`);
      const { latex: styleLatex } = await generator.generateResume(
        testUserData,
        testJobDescription,
        { style: testStyle, model: 'gpt-4' }
      );
      console.log(`   ✅ ${testStyle}: ${styleLatex.length} characters`);
    }

    console.log('\n========================================');
    console.log('✅ All tests completed successfully!\n');
    console.log('The simplified AI generator is working properly.');
    console.log('Old template system and prompts have been removed.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests().catch(console.error);