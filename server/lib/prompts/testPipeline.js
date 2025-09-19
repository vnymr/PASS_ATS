import { jdDigestPrompt } from './jdDigestPrompt.js';
import { candidateDigestPrompt } from './candidateDigestPrompt.js';
import { planPrompt } from './planPrompt.js';
import { masterPrompt } from './masterPrompt.js';

// Realistic sample data
const SAMPLE_JOB_DESCRIPTION = `
Senior Product Owner - Digital Banking Platform

About the Role:
We're seeking an experienced Senior Product Owner to lead our digital banking transformation initiative at FinTech Solutions, a rapidly growing fintech startup backed by major venture capital firms. This role will be pivotal in shaping the future of our consumer banking products serving over 5 million users globally.

Key Responsibilities:
• Define and communicate product vision and roadmap for our mobile banking platform
• Collaborate with engineering, design, and business stakeholders to deliver innovative features
• Manage and prioritize product backlog based on business value and customer impact
• Lead agile ceremonies including sprint planning, reviews, and retrospectives
• Conduct user research and analyze data to inform product decisions
• Work closely with compliance and security teams to ensure regulatory requirements
• Define success metrics and track KPIs to measure product performance
• Mentor junior product team members and foster a culture of innovation

Requirements:
• 5+ years of product ownership experience in fintech or digital banking
• Strong understanding of Agile/Scrum methodologies and tools (JIRA, Confluence)
• Experience with mobile app development and API-first architectures
• Excellent stakeholder management and communication skills
• Data-driven decision making with proficiency in analytics tools (Mixpanel, Amplitude)
• Knowledge of banking regulations and compliance requirements
• Bachelor's degree in Business, Computer Science, or related field; MBA preferred
• Experience with payment systems, KYC/AML processes is a plus

We offer competitive compensation, equity, comprehensive benefits, and the opportunity to shape the future of banking. Join our mission to make financial services accessible to everyone.
`;

const SAMPLE_RESUME_TEXT = `
Sarah Johnson
New York, NY | sarah.johnson@email.com | (212) 555-0123
linkedin.com/in/sarahjohnson | github.com/sjohnson

PROFESSIONAL SUMMARY
Experienced product manager with 6+ years driving digital product innovation in financial services and e-commerce. Passionate about creating user-centric solutions that deliver business value.

EXPERIENCE

Product Manager | E-Commerce Solutions Inc. | New York, NY | Mar 2021 - Present
• Led product development for mobile shopping app serving 3M+ monthly active users
• Increased user engagement by 35% through implementation of personalized recommendation engine
• Managed product roadmap and backlog for team of 12 engineers and 3 designers
• Conducted A/B testing and data analysis to optimize conversion funnel, improving checkout completion by 28%
• Collaborated with marketing and sales teams to launch 5 new product features
• Implemented agile methodologies resulting in 40% faster feature delivery

Senior Business Analyst | Digital Finance Corp | New York, NY | Jun 2019 - Feb 2021
• Analyzed business requirements for digital payment platform processing $2B annually
• Created detailed user stories and acceptance criteria for development teams
• Facilitated stakeholder workshops to gather requirements and define MVP features
• Developed data dashboards using SQL and Tableau to track product metrics
• Worked with compliance team to ensure PCI DSS and regulatory requirements

Business Analyst | TechStart Solutions | New York, NY | Jul 2017 - May 2019
• Supported product team in launching customer portal for B2B SaaS platform
• Conducted user interviews and usability testing with 50+ customers
• Created wireframes and process flows using Figma and Lucidchart
• Analyzed customer feedback and usage data to identify improvement opportunities
• Assisted in sprint planning and backlog grooming sessions

EDUCATION
MBA, Information Systems | NYU Stern School of Business | 2021
B.S. Business Administration | Cornell University | 2017

SKILLS
Product Management: Roadmapping, User Stories, A/B Testing, Product Analytics, Agile/Scrum
Technical: JIRA, Confluence, SQL, Tableau, Mixpanel, Google Analytics, Figma, Basic Python
Business: Stakeholder Management, Data Analysis, Financial Modeling, Competitive Analysis

CERTIFICATIONS
Certified Scrum Product Owner (CSPO) | 2020
Google Analytics Certified | 2019
`;

// Simple LaTeX template for testing
const TEST_PREAMBLE = `\\documentclass[a4paper,11pt]{article}
\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{fontawesome5}
\\usepackage[hidelinks]{hyperref}
\\usepackage{enumitem}

\\addtolength{\\oddsidemargin}{-0.8in}
\\addtolength{\\textwidth}{1.6in}
\\addtolength{\\topmargin}{-0.9in}
\\addtolength{\\textheight}{1.8in}

\\titleformat{\\section}{
  \\vspace{-3pt}\\scshape\\raggedright\\large\\bfseries
}{}{0em}{}[\\titlerule \\vspace{-3pt}]

\\newcommand{\\resumeItem}[1]{\\item\\small{#1 \\vspace{-0.5pt}}}
\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-1pt}\\item
  \\textbf{#1} \\hfill \\textbf{\\small #2} \\\\
  \\textit{\\small#3} \\hfill \\textit{\\small #4} \\\\
  \\vspace{-3pt}
}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}[itemsep=0pt]}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-2pt}}`;

const TEST_WIREFRAME = `% Header
\\begin{center}
{\\Huge \\scshape [NAME]} \\\\ \\vspace{1pt}
\\small [LOCATION] ~ \\faPhone\\ [PHONE] ~
\\href{mailto:[EMAIL]}{\\faEnvelope\\ \\underline{[EMAIL]}} ~
\\href{[LINKEDIN]}{\\faLinkedin\\ \\underline{[LINKEDIN]}}
\\vspace{-5pt}
\\end{center}

% Summary
\\section{Summary}
[SUMMARY]

% Experience
\\section{Experience}
\\begin{itemize}[leftmargin=0.0in, label={}]
[EXPERIENCES]
\\end{itemize}

% Skills
\\section{Skills}
\\small{[SKILLS]}

% Education
\\section{Education}
\\begin{itemize}[leftmargin=0.0in, label={}]
[EDUCATION]
\\end{itemize}`;

// Utility functions
function validateStage1(result) {
  const required = ['roleFamily', 'seniority', 'industry', 'companySize', 'companyThemes', 'keywords', 'responsibilities'];
  const missing = required.filter(field => !result[field]);
  if (missing.length > 0) {
    throw new Error(`Stage 1 validation failed. Missing fields: ${missing.join(', ')}`);
  }
  return true;
}

function validateStage2(result) {
  const required = ['experiences', 'skills', 'education', 'guardrails'];
  const missing = required.filter(field => !result[field]);
  if (missing.length > 0) {
    throw new Error(`Stage 2 validation failed. Missing fields: ${missing.join(', ')}`);
  }
  return true;
}

function validateStage3(result) {
  const required = ['targetScore', 'templateHint', 'domainAdapter', 'keywordPlacement', 'bulletPlan', 'caps'];
  const missing = required.filter(field => !result[field]);
  if (missing.length > 0) {
    throw new Error(`Stage 3 validation failed. Missing fields: ${missing.join(', ')}`);
  }
  return true;
}

function validateStage4(result) {
  if (!result || typeof result !== 'string') {
    throw new Error('Stage 4 validation failed. Expected LaTeX string output.');
  }
  if (!result.includes('\\documentclass') || !result.includes('\\begin{document}')) {
    throw new Error('Stage 4 validation failed. Invalid LaTeX structure.');
  }
  return true;
}

// Main pipeline test
export async function runFullPipelineTest() {
  console.log('=' .repeat(80));
  console.log('MICRO-PROMPT PIPELINE TEST');
  console.log('=' .repeat(80));
  console.log();

  const startTime = Date.now();
  const results = {};

  try {
    // Stage 1: JD Analysis
    console.log('STAGE 1: Job Description Analysis');
    console.log('-'.repeat(40));
    const stage1Start = Date.now();

    results.jdDigest = await jdDigestPrompt(SAMPLE_JOB_DESCRIPTION);
    validateStage1(results.jdDigest);

    console.log('✓ JD Analysis Complete');
    console.log(`  Role: ${results.jdDigest.roleFamily} (${results.jdDigest.seniority})`);
    console.log(`  Industry: ${results.jdDigest.industry} (${results.jdDigest.companySize})`);
    console.log(`  Keywords: ${results.jdDigest.keywords.length} extracted`);
    console.log(`  Themes: ${results.jdDigest.companyThemes.join(', ')}`);
    console.log(`  Time: ${Date.now() - stage1Start}ms`);
    console.log();

    // Stage 2: Candidate Analysis
    console.log('STAGE 2: Candidate Resume Analysis');
    console.log('-'.repeat(40));
    const stage2Start = Date.now();

    results.candidateDigest = await candidateDigestPrompt(SAMPLE_RESUME_TEXT);
    validateStage2(results.candidateDigest);

    console.log('✓ Candidate Analysis Complete');
    console.log(`  Name: ${results.candidateDigest.name}`);
    console.log(`  Experiences: ${results.candidateDigest.experiences.length} positions`);
    console.log(`  Skills: ${results.candidateDigest.skills.length} skills identified`);
    console.log(`  Education: ${results.candidateDigest.education.length} degrees`);
    console.log(`  Guardrails: Don't claim [${results.candidateDigest.guardrails.doNotClaim.slice(0, 3).join(', ')}...]`);
    console.log(`  Time: ${Date.now() - stage2Start}ms`);
    console.log();

    // Stage 3: Generation Planning
    console.log('STAGE 3: Generation Planning');
    console.log('-'.repeat(40));
    const stage3Start = Date.now();

    results.plan = await planPrompt(results.jdDigest, results.candidateDigest);
    validateStage3(results.plan);

    console.log('✓ Generation Plan Complete');
    console.log(`  Target Score: ${results.plan.targetScore}`);
    console.log(`  Template: ${results.plan.templateHint}`);
    console.log(`  Domain: ${results.plan.domainAdapter}`);
    console.log(`  Keyword Mappings: ${Object.keys(results.plan.keywordPlacement).length}`);
    console.log(`  Bullet Scaffolds: ${results.plan.bulletPlan.length}`);
    console.log(`  Caps: ${results.plan.caps.bulletsPerRole} bullets/role, ${results.plan.caps.bulletMaxWords} words/bullet`);
    console.log(`  Time: ${Date.now() - stage3Start}ms`);
    console.log();

    // Stage 4: LaTeX Generation
    console.log('STAGE 4: Master LaTeX Generation');
    console.log('-'.repeat(40));
    const stage4Start = Date.now();

    results.latex = await masterPrompt({
      jdDigest: results.jdDigest,
      candidateDigest: results.candidateDigest,
      plan: results.plan,
      preamble: TEST_PREAMBLE,
      wireframe: TEST_WIREFRAME
    });
    validateStage4(results.latex);

    console.log('✓ LaTeX Generation Complete');
    console.log(`  Document Length: ${results.latex.length} characters`);
    console.log(`  Time: ${Date.now() - stage4Start}ms`);
    console.log();

    // Display sample output
    console.log('GENERATED LATEX (First 500 characters):');
    console.log('-'.repeat(40));
    console.log(results.latex.substring(0, 500) + '...');
    console.log();

    // Pipeline summary
    const totalTime = Date.now() - startTime;
    console.log('=' .repeat(80));
    console.log('PIPELINE SUMMARY');
    console.log('=' .repeat(80));
    console.log(`✓ All 4 stages completed successfully`);
    console.log(`✓ Total execution time: ${totalTime}ms`);
    console.log(`✓ Average time per stage: ${Math.round(totalTime / 4)}ms`);
    console.log();

    // Detailed results
    console.log('DETAILED RESULTS:');
    console.log('-'.repeat(40));
    console.log('Stage 1 - JD Keywords (first 10):');
    console.log(`  ${results.jdDigest.keywords.slice(0, 10).join(', ')}`);
    console.log();
    console.log('Stage 2 - Candidate Top Skills (first 10):');
    console.log(`  ${results.candidateDigest.skills.slice(0, 10).join(', ')}`);
    console.log();
    console.log('Stage 3 - Keyword Placement Strategy:');
    Object.entries(results.plan.keywordPlacement).slice(0, 5).forEach(([keyword, section]) => {
      console.log(`  ${keyword} → ${section}`);
    });
    console.log();
    console.log('Stage 3 - Bullet Scaffolds:');
    results.plan.bulletPlan.slice(0, 3).forEach((bullet, i) => {
      console.log(`  ${i + 1}. ${bullet.bulletScaffold}`);
    });
    console.log();

    console.log('=' .repeat(80));
    console.log('TEST COMPLETE - Pipeline working correctly!');
    console.log('=' .repeat(80));

    return results;

  } catch (error) {
    console.error();
    console.error('❌ PIPELINE TEST FAILED');
    console.error('-'.repeat(40));
    console.error(`Error: ${error.message}`);
    console.error(`Stage reached: ${Object.keys(results).length} of 4`);
    console.error(`Time elapsed: ${Date.now() - startTime}ms`);
    console.error();
    console.error('Partial results:', JSON.stringify(results, null, 2).substring(0, 500));
    throw error;
  }
}

// Individual stage tests
export async function testIndividualStages() {
  console.log('Running individual stage tests...');
  console.log();

  try {
    // Test Stage 1 independently
    console.log('Testing Stage 1 (JD Digest):');
    const { testJdDigest } = await import('./jdDigestPrompt.js');
    await testJdDigest();
    console.log('✓ Stage 1 test passed');
    console.log();

    // Test Stage 2 independently
    console.log('Testing Stage 2 (Candidate Digest):');
    const { testCandidateDigest } = await import('./candidateDigestPrompt.js');
    await testCandidateDigest();
    console.log('✓ Stage 2 test passed');
    console.log();

    // Test Stage 3 independently
    console.log('Testing Stage 3 (Plan):');
    const { testPlanPrompt } = await import('./planPrompt.js');
    await testPlanPrompt();
    console.log('✓ Stage 3 test passed');
    console.log();

    // Test Stage 4 independently
    console.log('Testing Stage 4 (Master):');
    const { testMasterPrompt } = await import('./masterPrompt.js');
    await testMasterPrompt();
    console.log('✓ Stage 4 test passed');
    console.log();

    console.log('All individual stage tests passed!');
  } catch (error) {
    console.error('Individual stage test failed:', error.message);
    throw error;
  }
}

// Run all tests
export async function runAllTests() {
  console.log('COMPREHENSIVE MICRO-PROMPT SYSTEM TEST');
  console.log('=' .repeat(80));
  console.log();

  try {
    // Run individual tests first
    await testIndividualStages();
    console.log();
    console.log('=' .repeat(80));
    console.log();

    // Then run full pipeline
    await runFullPipelineTest();

    console.log();
    console.log('🎉 ALL TESTS PASSED! The micro-prompt pipeline is ready for integration.');
  } catch (error) {
    console.error('Test suite failed:', error.message);
    process.exit(1);
  }
}

// Allow running from command line
if (import.meta.url === `file://${process.argv[1]}`) {
  runFullPipelineTest().catch(console.error);
}