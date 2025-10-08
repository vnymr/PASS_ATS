#!/usr/bin/env node

/**
 * Infrastructure Load Testing Suite
 * Tests system capacity, scalability, and performance limits
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const os = require('os');

// Configuration
const CONFIG = {
  API_URL: process.env.API_URL || 'http://localhost:3000',
  MAX_CONCURRENT: parseInt(process.env.MAX_CONCURRENT) || 100,
  TEST_DURATION: parseInt(process.env.TEST_DURATION) || 60, // seconds
  RAMP_UP_TIME: parseInt(process.env.RAMP_UP_TIME) || 10, // seconds
  SAMPLE_PDF: path.join(__dirname, '../test-files/sample_resume.pdf'),
  SAMPLE_JOB: {
    title: 'Senior Software Engineer',
    company: 'Tech Corp',
    description: 'We are looking for a Senior Software Engineer with expertise in Node.js, React, and cloud technologies. You will be responsible for building scalable web applications, mentoring junior developers, and contributing to architectural decisions.',
    requirements: 'Node.js, React, AWS, Docker, Kubernetes, PostgreSQL, Redis, TypeScript, GraphQL, REST APIs',
    location: 'San Francisco, CA'
  }
};

// Test Metrics Storage
class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        errors: {}
      },
      latency: {
        min: Infinity,
        max: 0,
        sum: 0,
        count: 0,
        percentiles: [],
        raw: []
      },
      throughput: {
        requestsPerSecond: [],
        bytesPerSecond: []
      },
      concurrent: {
        active: 0,
        peak: 0
      },
      jobs: {
        submitted: 0,
        completed: 0,
        failed: 0,
        processing_times: []
      },
      system: {
        cpu: [],
        memory: [],
        timestamps: []
      },
      errors: {
        timeouts: 0,
        connection_errors: 0,
        http_errors: {},
        application_errors: {}
      }
    };
    this.startTime = Date.now();
  }

  recordRequest(duration, success, error = null, bytesTransferred = 0) {
    this.metrics.requests.total++;
    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
      if (error) {
        const errorType = error.code || error.message || 'unknown';
        this.metrics.requests.errors[errorType] = (this.metrics.requests.errors[errorType] || 0) + 1;
      }
    }

    // Update latency metrics
    this.metrics.latency.raw.push(duration);
    this.metrics.latency.min = Math.min(this.metrics.latency.min, duration);
    this.metrics.latency.max = Math.max(this.metrics.latency.max, duration);
    this.metrics.latency.sum += duration;
    this.metrics.latency.count++;

    // Update throughput
    const elapsed = (Date.now() - this.startTime) / 1000;
    if (elapsed > 0) {
      const currentRPS = this.metrics.requests.total / elapsed;
      this.metrics.throughput.requestsPerSecond.push(currentRPS);
      if (bytesTransferred > 0) {
        this.metrics.throughput.bytesPerSecond.push(bytesTransferred / elapsed);
      }
    }
  }

  updateConcurrent(delta) {
    this.metrics.concurrent.active += delta;
    this.metrics.concurrent.peak = Math.max(this.metrics.concurrent.peak, this.metrics.concurrent.active);
  }

  recordJob(jobId, processingTime, success) {
    this.metrics.jobs.submitted++;
    if (success) {
      this.metrics.jobs.completed++;
      this.metrics.jobs.processing_times.push(processingTime);
    } else {
      this.metrics.jobs.failed++;
    }
  }

  recordSystemMetrics() {
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();

    this.metrics.system.cpu.push({
      user: cpuUsage.user / 1000000, // Convert to seconds
      system: cpuUsage.system / 1000000
    });

    this.metrics.system.memory.push({
      rss: memUsage.rss / 1024 / 1024, // Convert to MB
      heapUsed: memUsage.heapUsed / 1024 / 1024,
      heapTotal: memUsage.heapTotal / 1024 / 1024,
      external: memUsage.external / 1024 / 1024
    });

    this.metrics.system.timestamps.push(Date.now());
  }

  calculatePercentiles() {
    const sorted = [...this.metrics.latency.raw].sort((a, b) => a - b);
    const len = sorted.length;

    if (len === 0) return;

    this.metrics.latency.percentiles = {
      p50: sorted[Math.floor(len * 0.5)],
      p75: sorted[Math.floor(len * 0.75)],
      p90: sorted[Math.floor(len * 0.9)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)]
    };
  }

  getReport() {
    this.calculatePercentiles();

    const duration = (Date.now() - this.startTime) / 1000;
    const avgLatency = this.metrics.latency.count > 0
      ? this.metrics.latency.sum / this.metrics.latency.count
      : 0;

    return {
      summary: {
        duration: `${duration.toFixed(2)}s`,
        total_requests: this.metrics.requests.total,
        successful: this.metrics.requests.successful,
        failed: this.metrics.requests.failed,
        success_rate: `${((this.metrics.requests.successful / this.metrics.requests.total) * 100).toFixed(2)}%`,
        avg_rps: (this.metrics.requests.total / duration).toFixed(2),
        peak_concurrent: this.metrics.concurrent.peak
      },
      latency: {
        min: `${this.metrics.latency.min.toFixed(2)}ms`,
        max: `${this.metrics.latency.max.toFixed(2)}ms`,
        avg: `${avgLatency.toFixed(2)}ms`,
        percentiles: this.metrics.latency.percentiles
      },
      jobs: {
        submitted: this.metrics.jobs.submitted,
        completed: this.metrics.jobs.completed,
        failed: this.metrics.jobs.failed,
        avg_processing_time: this.metrics.jobs.processing_times.length > 0
          ? `${(this.metrics.jobs.processing_times.reduce((a, b) => a + b, 0) / this.metrics.jobs.processing_times.length).toFixed(2)}s`
          : 'N/A'
      },
      errors: this.metrics.requests.errors,
      system: {
        peak_memory: Math.max(...this.metrics.system.memory.map(m => m.rss)),
        avg_cpu: this.metrics.system.cpu.length > 0
          ? (this.metrics.system.cpu.reduce((a, b) => a + b.user + b.system, 0) / this.metrics.system.cpu.length).toFixed(2)
          : 0
      }
    };
  }
}

// Test User Simulation
class VirtualUser {
  constructor(id, token, metrics) {
    this.id = id;
    this.token = token;
    this.metrics = metrics;
    this.active = true;
    this.requestCount = 0;
  }

  async makeRequest(endpoint, options = {}) {
    const startTime = performance.now();
    this.metrics.updateConcurrent(1);

    try {
      const response = await this.httpRequest(endpoint, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${this.token}`
        }
      });

      const duration = performance.now() - startTime;
      this.metrics.recordRequest(duration, response.statusCode < 400, null, response.data ? response.data.length : 0);

      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.metrics.recordRequest(duration, false, error);
      throw error;
    } finally {
      this.metrics.updateConcurrent(-1);
      this.requestCount++;
    }
  }

  httpRequest(endpoint, options) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, CONFIG.API_URL);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.request(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: 30000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  // Simulate realistic user journey
  async runUserJourney() {
    try {
      // 1. Upload resume
      const uploadStart = performance.now();
      const uploadResponse = await this.uploadResume();
      const uploadTime = performance.now() - uploadStart;

      // 2. Generate tailored resume
      const jobStart = performance.now();
      const jobResponse = await this.generateResume();
      const jobId = JSON.parse(jobResponse.data).jobId;

      // 3. Poll for completion
      const completionTime = await this.pollJobCompletion(jobId);
      const totalJobTime = (performance.now() - jobStart) / 1000;

      this.metrics.recordJob(jobId, totalJobTime, true);

      // 4. Download PDF
      await this.downloadPDF(jobId);

      return {
        success: true,
        uploadTime,
        processingTime: totalJobTime,
        jobId
      };
    } catch (error) {
      console.error(`User ${this.id} journey failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async uploadResume() {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36);
    const resumeData = fs.readFileSync(CONFIG.SAMPLE_PDF);

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="resume"; filename="resume.pdf"\r\n`),
      Buffer.from('Content-Type: application/pdf\r\n\r\n'),
      resumeData,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    return this.makeRequest('/api/upload/resume', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      },
      body
    });
  }

  async generateResume() {
    return this.makeRequest('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        job: CONFIG.SAMPLE_JOB,
        urgency: 'normal',
        optimization_level: 'balanced'
      })
    });
  }

  async pollJobCompletion(jobId, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await this.makeRequest(`/api/job/${jobId}/status`);
      const data = JSON.parse(response.data);

      if (data.status === 'COMPLETED') {
        return true;
      } else if (data.status === 'FAILED') {
        throw new Error('Job failed');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Job timeout');
  }

  async downloadPDF(jobId) {
    return this.makeRequest(`/api/resumes/${jobId}`);
  }
}

// Load Test Orchestrator
class LoadTestOrchestrator {
  constructor() {
    this.metrics = new MetricsCollector();
    this.users = [];
    this.tokens = [];
    this.running = false;
  }

  async setup() {
    console.log('🔧 Setting up test environment...\n');

    // Create test users and get tokens
    console.log(`Creating ${CONFIG.MAX_CONCURRENT} test users...`);
    for (let i = 0; i < CONFIG.MAX_CONCURRENT; i++) {
      try {
        const token = await this.createTestUser(i);
        this.tokens.push(token);

        if (i % 10 === 0) {
          process.stdout.write(`\rCreated ${i + 1}/${CONFIG.MAX_CONCURRENT} users`);
        }
      } catch (error) {
        console.error(`Failed to create user ${i}:`, error.message);
      }
    }
    console.log(`\n✅ Created ${this.tokens.length} test users\n`);

    // Create sample PDF if not exists
    if (!fs.existsSync(CONFIG.SAMPLE_PDF)) {
      console.log('Creating sample PDF...');
      await this.createSamplePDF();
    }
  }

  async createTestUser(index) {
    const response = await this.makeRequest('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `loadtest_${index}_${Date.now()}@test.com`,
        password: 'LoadTest123!'
      })
    });

    const data = JSON.parse(response.data);
    return data.token;
  }

  makeRequest(endpoint, options) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, CONFIG.API_URL);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, data }));
      });

      req.on('error', reject);
      if (options.body) req.write(options.body);
      req.end();
    });
  }

  async createSamplePDF() {
    const dir = path.dirname(CONFIG.SAMPLE_PDF);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create a simple PDF (mock for testing)
    const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 200 >>
stream
BT
/F1 12 Tf
72 720 Td
(John Doe - Senior Software Engineer) Tj
0 -20 Td
(Experience: 10+ years in full-stack development) Tj
0 -20 Td
(Skills: Node.js, React, Python, AWS, Docker) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000274 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
523
%%EOF`;

    fs.writeFileSync(CONFIG.SAMPLE_PDF, content);
  }

  async runLoadTest() {
    console.log('🚀 Starting load test...\n');
    console.log(`Configuration:`);
    console.log(`  - Target concurrent users: ${CONFIG.MAX_CONCURRENT}`);
    console.log(`  - Test duration: ${CONFIG.TEST_DURATION}s`);
    console.log(`  - Ramp up time: ${CONFIG.RAMP_UP_TIME}s`);
    console.log(`  - API URL: ${CONFIG.API_URL}\n`);

    this.running = true;
    const testStart = Date.now();
    const testEndTime = testStart + (CONFIG.TEST_DURATION * 1000);

    // Start system monitoring
    const monitorInterval = setInterval(() => {
      this.metrics.recordSystemMetrics();
    }, 1000);

    // Gradually ramp up users
    const usersPerSecond = CONFIG.MAX_CONCURRENT / CONFIG.RAMP_UP_TIME;
    let currentUsers = 0;

    const rampUpInterval = setInterval(async () => {
      const usersToAdd = Math.min(
        Math.ceil(usersPerSecond),
        CONFIG.MAX_CONCURRENT - currentUsers
      );

      for (let i = 0; i < usersToAdd && currentUsers < CONFIG.MAX_CONCURRENT; i++) {
        if (this.tokens[currentUsers]) {
          const user = new VirtualUser(currentUsers, this.tokens[currentUsers], this.metrics);
          this.users.push(user);

          // Start user journey
          this.runUserJourneyLoop(user, testEndTime);
          currentUsers++;
        }
      }

      console.log(`\rActive users: ${currentUsers}/${CONFIG.MAX_CONCURRENT}`);

      if (currentUsers >= CONFIG.MAX_CONCURRENT) {
        clearInterval(rampUpInterval);
        console.log('\n✅ All users ramped up\n');
      }
    }, 1000);

    // Wait for test duration
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        const elapsed = (Date.now() - testStart) / 1000;
        const progress = (elapsed / CONFIG.TEST_DURATION) * 100;

        process.stdout.write(`\rProgress: ${progress.toFixed(1)}% | Active: ${this.metrics.concurrent.active} | Requests: ${this.metrics.requests.total}`);

        if (Date.now() >= testEndTime) {
          clearInterval(checkInterval);
          clearInterval(monitorInterval);
          this.running = false;
          resolve();
        }
      }, 1000);
    });

    console.log('\n\n⏸️  Stopping test...\n');

    // Wait for remaining requests to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  async runUserJourneyLoop(user, endTime) {
    while (this.running && Date.now() < endTime) {
      try {
        await user.runUserJourney();

        // Random delay between journeys (1-5 seconds)
        await new Promise(resolve =>
          setTimeout(resolve, 1000 + Math.random() * 4000)
        );
      } catch (error) {
        // User journey failed, continue with next iteration
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  generateReport() {
    const report = this.metrics.getReport();

    console.log('\n' + '='.repeat(80));
    console.log(' '.repeat(20) + '📊 LOAD TEST REPORT');
    console.log('='.repeat(80) + '\n');

    console.log('📈 PERFORMANCE SUMMARY');
    console.log('─'.repeat(40));
    console.log(`Duration: ${report.summary.duration}`);
    console.log(`Total Requests: ${report.summary.total_requests}`);
    console.log(`Successful: ${report.summary.successful}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Success Rate: ${report.summary.success_rate}`);
    console.log(`Average RPS: ${report.summary.avg_rps}`);
    console.log(`Peak Concurrent: ${report.summary.peak_concurrent}`);

    console.log('\n⏱️  LATENCY METRICS');
    console.log('─'.repeat(40));
    console.log(`Min: ${report.latency.min}`);
    console.log(`Max: ${report.latency.max}`);
    console.log(`Avg: ${report.latency.avg}`);
    if (report.latency.percentiles) {
      console.log(`P50: ${report.latency.percentiles.p50?.toFixed(2)}ms`);
      console.log(`P75: ${report.latency.percentiles.p75?.toFixed(2)}ms`);
      console.log(`P90: ${report.latency.percentiles.p90?.toFixed(2)}ms`);
      console.log(`P95: ${report.latency.percentiles.p95?.toFixed(2)}ms`);
      console.log(`P99: ${report.latency.percentiles.p99?.toFixed(2)}ms`);
    }

    console.log('\n📄 JOB PROCESSING');
    console.log('─'.repeat(40));
    console.log(`Jobs Submitted: ${report.jobs.submitted}`);
    console.log(`Jobs Completed: ${report.jobs.completed}`);
    console.log(`Jobs Failed: ${report.jobs.failed}`);
    console.log(`Avg Processing Time: ${report.jobs.avg_processing_time}`);

    if (Object.keys(report.errors).length > 0) {
      console.log('\n❌ ERRORS');
      console.log('─'.repeat(40));
      for (const [error, count] of Object.entries(report.errors)) {
        console.log(`${error}: ${count}`);
      }
    }

    console.log('\n💻 SYSTEM RESOURCES');
    console.log('─'.repeat(40));
    console.log(`Peak Memory: ${report.system.peak_memory?.toFixed(2)} MB`);
    console.log(`Avg CPU Time: ${report.system.avg_cpu}s`);

    // Capacity Analysis
    console.log('\n🎯 CAPACITY ANALYSIS');
    console.log('─'.repeat(40));

    const successRate = report.summary.successful / report.summary.total_requests;
    const avgRPS = parseFloat(report.summary.avg_rps);

    if (successRate >= 0.99) {
      console.log(`✅ System handled ${CONFIG.MAX_CONCURRENT} concurrent users successfully`);
      console.log(`   Estimated capacity: ${(avgRPS * 60).toFixed(0)} requests/minute`);

      // Worker recommendations
      const jobsPerMinute = (report.jobs.completed / (parseFloat(report.summary.duration) / 60));
      const recommendedWorkers = Math.ceil(jobsPerMinute / 10); // Assume 10 jobs/min per worker

      console.log(`\n📦 WORKER SCALING RECOMMENDATIONS`);
      console.log(`─`.repeat(40));
      console.log(`Current load: ${jobsPerMinute.toFixed(1)} jobs/minute`);
      console.log(`Recommended workers: ${recommendedWorkers}`);
      console.log(`Per worker: ~${(jobsPerMinute / recommendedWorkers).toFixed(1)} jobs/minute`);
    } else {
      console.log(`⚠️  System showed stress at ${CONFIG.MAX_CONCURRENT} concurrent users`);
      console.log(`   Success rate dropped to ${report.summary.success_rate}`);
      console.log(`   Consider scaling infrastructure or optimizing application`);
    }

    // Save detailed report
    const detailedReport = {
      ...report,
      configuration: CONFIG,
      timestamp: new Date().toISOString(),
      raw_metrics: this.metrics.metrics
    };

    const reportPath = path.join(__dirname, `../load-test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
    console.log(`\n📁 Detailed report saved to: ${reportPath}`);

    console.log('\n' + '='.repeat(80) + '\n');
  }
}

// Main execution
async function main() {
  const orchestrator = new LoadTestOrchestrator();

  try {
    await orchestrator.setup();
    await orchestrator.runLoadTest();
    orchestrator.generateReport();
  } catch (error) {
    console.error('❌ Load test failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { LoadTestOrchestrator, MetricsCollector, VirtualUser };