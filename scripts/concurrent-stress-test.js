#!/usr/bin/env node

/**
 * Concurrent Stress Testing
 * Simulates extreme load conditions to find breaking points
 */

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

const CONFIG = {
  API_URL: process.env.API_URL || 'http://localhost:3000',
  WORKERS: parseInt(process.env.WORKERS) || os.cpus().length,
  REQUESTS_PER_WORKER: parseInt(process.env.REQUESTS_PER_WORKER) || 1000,
  CONCURRENT_PER_WORKER: parseInt(process.env.CONCURRENT_PER_WORKER) || 10,
  TEST_SCENARIOS: ['auth', 'upload', 'generate', 'status', 'download', 'mixed']
};

// Stress Test Scenarios
class StressScenarios {
  constructor(apiUrl, token) {
    this.apiUrl = apiUrl;
    this.token = token;
    this.results = [];
  }

  async runScenario(scenario, iterations = 100) {
    const scenarios = {
      auth: () => this.authStress(),
      upload: () => this.uploadStress(),
      generate: () => this.generateStress(),
      status: () => this.statusStress(),
      download: () => this.downloadStress(),
      mixed: () => this.mixedStress()
    };

    const runner = scenarios[scenario];
    if (!runner) throw new Error(`Unknown scenario: ${scenario}`);

    const results = {
      scenario,
      iterations,
      successful: 0,
      failed: 0,
      errors: {},
      latencies: [],
      startTime: Date.now()
    };

    // Run iterations concurrently
    const promises = [];
    for (let i = 0; i < iterations; i++) {
      promises.push(this.executeWithMetrics(runner.bind(this), results));

      // Control concurrency
      if (promises.length >= CONFIG.CONCURRENT_PER_WORKER) {
        await Promise.race(promises).then(() => {
          promises.splice(promises.findIndex(p => p === Promise.resolve()), 1);
        });
      }
    }

    // Wait for remaining
    await Promise.all(promises);

    results.endTime = Date.now();
    results.duration = (results.endTime - results.startTime) / 1000;
    results.rps = iterations / results.duration;

    return results;
  }

  async executeWithMetrics(fn, results) {
    const start = performance.now();
    try {
      await fn();
      results.successful++;
      const latency = performance.now() - start;
      results.latencies.push(latency);
    } catch (error) {
      results.failed++;
      const errorType = error.code || error.message || 'unknown';
      results.errors[errorType] = (results.errors[errorType] || 0) + 1;
    }
  }

  // Scenario: Authentication bombardment
  async authStress() {
    const email = `stress_${Date.now()}_${Math.random()}@test.com`;

    // Register
    await this.makeRequest('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Test123!' })
    });

    // Login
    await this.makeRequest('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Test123!' })
    });
  }

  // Scenario: Upload stress (large payloads)
  async uploadStress() {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36);

    // Create fake PDF data (1MB)
    const pdfSize = 1024 * 1024; // 1MB
    const pdfData = Buffer.alloc(pdfSize);
    pdfData.write('%PDF-1.4\n', 0);

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="resume"; filename="stress.pdf"\r\n`),
      Buffer.from('Content-Type: application/pdf\r\n\r\n'),
      pdfData,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    await this.makeRequest('/api/upload/resume', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Authorization': `Bearer ${this.token}`
      },
      body
    });
  }

  // Scenario: Generate resume stress (CPU intensive)
  async generateStress() {
    const response = await this.makeRequest('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        job: {
          title: `Stress Test Position ${Date.now()}`,
          company: 'Stress Corp',
          description: 'A'.repeat(5000), // Large description
          requirements: 'B'.repeat(1000),
          location: 'Stress City'
        },
        urgency: 'urgent'
      })
    });

    return JSON.parse(response.data).jobId;
  }

  // Scenario: Status polling stress
  async statusStress() {
    // Use a fake job ID for polling
    const jobId = 'stress_' + Math.random().toString(36);

    for (let i = 0; i < 10; i++) {
      try {
        await this.makeRequest(`/api/job/${jobId}/status`, {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
      } catch (e) {
        // Expected to fail with 404
      }
    }
  }

  // Scenario: Download stress (bandwidth)
  async downloadStress() {
    const jobId = 'stress_' + Math.random().toString(36);

    try {
      await this.makeRequest(`/api/resumes/${jobId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
    } catch (e) {
      // Expected to fail
    }
  }

  // Scenario: Mixed realistic workload
  async mixedStress() {
    const rand = Math.random();

    if (rand < 0.2) {
      await this.authStress();
    } else if (rand < 0.4) {
      await this.uploadStress();
    } else if (rand < 0.6) {
      await this.generateStress();
    } else if (rand < 0.8) {
      await this.statusStress();
    } else {
      await this.downloadStress();
    }
  }

  makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.apiUrl);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.request(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
          } else {
            resolve({ statusCode: res.statusCode, data });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }
}

// Worker process
async function runWorker(workerId) {
  console.log(`[Worker ${workerId}] Starting stress tests...`);

  // Get auth token
  let token;
  try {
    const response = await makeRequest(`${CONFIG.API_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `worker_${workerId}_${Date.now()}@stress.com`,
        password: 'Stress123!'
      })
    });
    token = JSON.parse(response.data).token;
  } catch (error) {
    console.error(`[Worker ${workerId}] Failed to get token:`, error.message);
    process.exit(1);
  }

  const tester = new StressScenarios(CONFIG.API_URL, token);
  const results = {};

  // Run each scenario
  for (const scenario of CONFIG.TEST_SCENARIOS) {
    console.log(`[Worker ${workerId}] Running ${scenario} scenario...`);
    results[scenario] = await tester.runScenario(
      scenario,
      CONFIG.REQUESTS_PER_WORKER
    );
  }

  // Send results to master
  process.send({ type: 'results', workerId, results });
}

// Helper function for HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const req = client.request(parsedUrl, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Master process
async function runMaster() {
  console.log('🔥 CONCURRENT STRESS TEST');
  console.log('=' .repeat(60));
  console.log(`Workers: ${CONFIG.WORKERS}`);
  console.log(`Requests per worker: ${CONFIG.REQUESTS_PER_WORKER}`);
  console.log(`Concurrent per worker: ${CONFIG.CONCURRENT_PER_WORKER}`);
  console.log(`Total requests: ${CONFIG.WORKERS * CONFIG.REQUESTS_PER_WORKER * CONFIG.TEST_SCENARIOS.length}`);
  console.log('=' .repeat(60) + '\n');

  const workerResults = [];
  let workersCompleted = 0;

  // Fork workers
  for (let i = 0; i < CONFIG.WORKERS; i++) {
    const worker = cluster.fork({ WORKER_ID: i });

    worker.on('message', (msg) => {
      if (msg.type === 'results') {
        workerResults.push(msg.results);
        workersCompleted++;

        if (workersCompleted === CONFIG.WORKERS) {
          generateReport(workerResults);
          process.exit(0);
        }
      }
    });

    worker.on('error', (error) => {
      console.error(`Worker ${i} error:`, error);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker ${i} exited with code ${code}`);
      }
    });
  }
}

// Generate consolidated report
function generateReport(allResults) {
  console.log('\n' + '='.repeat(80));
  console.log(' '.repeat(25) + '📊 STRESS TEST RESULTS');
  console.log('='.repeat(80) + '\n');

  const aggregated = {};

  // Aggregate results by scenario
  for (const scenario of CONFIG.TEST_SCENARIOS) {
    aggregated[scenario] = {
      totalRequests: 0,
      successful: 0,
      failed: 0,
      errors: {},
      latencies: [],
      minLatency: Infinity,
      maxLatency: 0,
      totalDuration: 0
    };

    for (const workerResults of allResults) {
      const scenarioResult = workerResults[scenario];
      if (scenarioResult) {
        aggregated[scenario].totalRequests += scenarioResult.iterations;
        aggregated[scenario].successful += scenarioResult.successful;
        aggregated[scenario].failed += scenarioResult.failed;
        aggregated[scenario].totalDuration += scenarioResult.duration;
        aggregated[scenario].latencies.push(...scenarioResult.latencies);

        // Merge errors
        for (const [error, count] of Object.entries(scenarioResult.errors)) {
          aggregated[scenario].errors[error] =
            (aggregated[scenario].errors[error] || 0) + count;
        }
      }
    }

    // Calculate metrics
    const agg = aggregated[scenario];
    if (agg.latencies.length > 0) {
      agg.minLatency = Math.min(...agg.latencies);
      agg.maxLatency = Math.max(...agg.latencies);
      agg.avgLatency = agg.latencies.reduce((a, b) => a + b) / agg.latencies.length;

      // Calculate percentiles
      const sorted = [...agg.latencies].sort((a, b) => a - b);
      agg.p50 = sorted[Math.floor(sorted.length * 0.5)];
      agg.p95 = sorted[Math.floor(sorted.length * 0.95)];
      agg.p99 = sorted[Math.floor(sorted.length * 0.99)];
    }

    // Calculate throughput
    agg.avgRPS = agg.totalRequests / agg.totalDuration;
    agg.successRate = (agg.successful / agg.totalRequests * 100).toFixed(2) + '%';
  }

  // Display results
  for (const [scenario, metrics] of Object.entries(aggregated)) {
    console.log(`📌 SCENARIO: ${scenario.toUpperCase()}`);
    console.log('─'.repeat(60));
    console.log(`Total Requests: ${metrics.totalRequests}`);
    console.log(`Successful: ${metrics.successful}`);
    console.log(`Failed: ${metrics.failed}`);
    console.log(`Success Rate: ${metrics.successRate}`);
    console.log(`Average RPS: ${metrics.avgRPS.toFixed(2)}`);

    if (metrics.latencies.length > 0) {
      console.log(`\nLatency (ms):`);
      console.log(`  Min: ${metrics.minLatency.toFixed(2)}`);
      console.log(`  Avg: ${metrics.avgLatency.toFixed(2)}`);
      console.log(`  Max: ${metrics.maxLatency.toFixed(2)}`);
      console.log(`  P50: ${metrics.p50.toFixed(2)}`);
      console.log(`  P95: ${metrics.p95.toFixed(2)}`);
      console.log(`  P99: ${metrics.p99.toFixed(2)}`);
    }

    if (Object.keys(metrics.errors).length > 0) {
      console.log(`\nErrors:`);
      for (const [error, count] of Object.entries(metrics.errors)) {
        console.log(`  ${error}: ${count}`);
      }
    }
    console.log();
  }

  // Overall summary
  console.log('📊 OVERALL SUMMARY');
  console.log('─'.repeat(60));

  let totalRequests = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;
  let totalDuration = 0;

  for (const metrics of Object.values(aggregated)) {
    totalRequests += metrics.totalRequests;
    totalSuccessful += metrics.successful;
    totalFailed += metrics.failed;
    totalDuration += metrics.totalDuration;
  }

  const overallSuccessRate = (totalSuccessful / totalRequests * 100).toFixed(2);
  const overallRPS = totalRequests / (totalDuration / CONFIG.WORKERS);

  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Total Successful: ${totalSuccessful}`);
  console.log(`Total Failed: ${totalFailed}`);
  console.log(`Overall Success Rate: ${overallSuccessRate}%`);
  console.log(`Overall RPS: ${overallRPS.toFixed(2)}`);

  // Capacity estimation
  console.log('\n🎯 CAPACITY ESTIMATION');
  console.log('─'.repeat(60));

  if (parseFloat(overallSuccessRate) >= 95) {
    console.log(`✅ System handled ${CONFIG.WORKERS * CONFIG.CONCURRENT_PER_WORKER} concurrent connections`);
    console.log(`   Sustained ${overallRPS.toFixed(0)} requests/second`);
    console.log(`   Estimated hourly capacity: ${(overallRPS * 3600).toFixed(0)} requests`);
  } else if (parseFloat(overallSuccessRate) >= 80) {
    console.log(`⚠️  System showed moderate stress`);
    console.log(`   Success rate: ${overallSuccessRate}%`);
    console.log(`   Consider optimizing before scaling`);
  } else {
    console.log(`❌ System under severe stress`);
    console.log(`   Success rate: ${overallSuccessRate}%`);
    console.log(`   Immediate optimization or scaling required`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

// Main execution
if (cluster.isMaster) {
  runMaster();
} else {
  const workerId = process.env.WORKER_ID;
  runWorker(workerId).catch(error => {
    console.error(`[Worker ${workerId}] Fatal error:`, error);
    process.exit(1);
  });
}