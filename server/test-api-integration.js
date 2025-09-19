#!/usr/bin/env node

/**
 * Test the integrated /api/generate endpoint with the new pipeline
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Test credentials (unique for each test run)
const TEST_USER = {
  email: `test-${Date.now()}@example.com`,
  password: 'testpassword123'
};

// Test data
const TEST_JOB = {
  resumeText: `John Doe
john.doe@email.com | (555) 123-4567 | San Francisco, CA

Software Engineer with 5+ years of experience

EXPERIENCE:
Senior Software Engineer | TechCorp | 2020-Present
- Led development of microservices serving 100K+ users
- Reduced API latency by 40% through optimization
- Mentored team of 3 junior developers

Software Engineer | StartupXYZ | 2018-2020
- Built React frontend for SaaS platform
- Developed 15+ RESTful APIs using Node.js
- Improved database performance by 50%

SKILLS:
JavaScript, TypeScript, React, Node.js, AWS, Docker

EDUCATION:
B.S. Computer Science | UC Berkeley | 2018`,

  jobDescription: `Senior Software Engineer

We are looking for a Senior Software Engineer to join our team.

Requirements:
- 5+ years experience with JavaScript, React, Node.js
- Experience with cloud platforms (AWS)
- Strong problem-solving skills
- Bachelor's degree in Computer Science

Responsibilities:
- Design and develop scalable applications
- Lead technical initiatives
- Mentor junior developers
- Collaborate with product team`,

  company: 'TechCorp Inc',
  role: 'Senior Software Engineer',
  aiMode: 'gpt-4o-mini'
};

async function registerOrLogin() {
  console.log('🔐 Attempting to login/register test user...');

  // Try login first
  try {
    const loginResponse = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER)
    });

    if (loginResponse.ok) {
      const data = await loginResponse.json();
      console.log('✅ Logged in successfully');
      return data.token;
    }
  } catch (error) {
    console.log('Login failed, trying registration...');
  }

  // Try registration
  const registerResponse = await fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER)
  });

  if (!registerResponse.ok) {
    const error = await registerResponse.text();

    // If user exists, try to login again
    if (error.includes('already exists')) {
      const loginRetry = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(TEST_USER)
      });

      if (loginRetry.ok) {
        const data = await loginRetry.json();
        console.log('✅ User exists - logged in successfully');
        return data.token;
      }
    }

    throw new Error(`Registration failed: ${error}`);
  }

  const data = await registerResponse.json();
  console.log('✅ Registered and logged in successfully');
  return data.token;
}

async function testGenerateEndpoint(token) {
  console.log('\n📋 Testing /api/generate endpoint with new pipeline...');
  console.log('   Company:', TEST_JOB.company);
  console.log('   Role:', TEST_JOB.role);
  console.log('   AI Mode:', TEST_JOB.aiMode);

  const startTime = Date.now();

  const response = await fetch(`${API_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(TEST_JOB)
  });

  const duration = Date.now() - startTime;

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API error: ${error.error || response.statusText}`);
  }

  const result = await response.json();

  console.log('\n✅ API Response received in', duration, 'ms');
  console.log('\n📊 Response Details:');
  console.log('   Job ID:', result.jobId);
  console.log('   Success:', result.success);
  console.log('   Message:', result.message);
  console.log('   Download URL:', result.downloadUrl);
  console.log('   Template Used:', result.templateUsed || 'N/A');
  console.log('   Generation Type:', result.generationType || 'N/A');
  console.log('   Processing Time:', result.processingTime || 'N/A', 'ms');

  // Log pipeline details if available
  if (result.pipelineLog) {
    console.log('\n📝 Pipeline Log:');
    result.pipelineLog.forEach(entry => {
      console.log(`   - ${entry.stage}: ${entry.duration || 'N/A'}ms`);
    });
  }

  if (result.metrics) {
    console.log('\n📈 Pipeline Metrics:');
    console.log('   Stage Timings:', result.metrics.stageTimings);
    console.log('   Cache Hit:', result.metrics.cacheHit);
  }

  return result;
}

async function checkJobStatus(token, jobId) {
  console.log('\n🔍 Checking job status...');

  const response = await fetch(`${API_BASE_URL}/api/job/${jobId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get job status: ${response.statusText}`);
  }

  const job = await response.json();
  console.log('   Status:', job.status);
  console.log('   Has PDF:', !!job.artifacts?.find(a => a.type === 'PDF_OUTPUT'));
  console.log('   Has LaTeX:', !!job.artifacts?.find(a => a.type === 'LATEX_SOURCE'));

  return job;
}

async function main() {
  console.log('\n========================================');
  console.log('  API INTEGRATION TEST');
  console.log('========================================\n');
  console.log('API URL:', API_BASE_URL);

  try {
    // Step 1: Authenticate
    const token = await registerOrLogin();

    // Step 2: Test generate endpoint
    const generateResult = await testGenerateEndpoint(token);

    // Step 3: Check job status
    if (generateResult.jobId) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit
      await checkJobStatus(token, generateResult.jobId);
    }

    console.log('\n========================================');
    console.log('  ✅ ALL TESTS PASSED');
    console.log('========================================');
    console.log('\nThe new pipeline is successfully integrated with the API!');
    console.log('The frontend should work without any changes.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) {
      console.log('⚠️  Server health check failed, but continuing...');
    }
  } catch (error) {
    console.error('❌ Server is not running at', API_BASE_URL);
    console.error('Please start the server first with: npm run dev');
    process.exit(1);
  }
}

// Run tests
checkServer().then(() => main()).catch(console.error);