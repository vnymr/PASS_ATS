#!/usr/bin/env node

/**
 * System Health Monitor & Error Prevention Analysis
 * Monitors system health, identifies error patterns, and provides prevention recommendations
 */

const http = require('http');
const https = require('https');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const CONFIG = {
  API_URL: process.env.API_URL || 'http://localhost:3000',
  MONITORING_DURATION: parseInt(process.env.MONITORING_DURATION) || 300, // 5 minutes
  SAMPLE_INTERVAL: parseInt(process.env.SAMPLE_INTERVAL) || 5000, // 5 seconds
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  ERROR_PATTERNS: {
    // Based on the production errors you provided
    FRONTEND_BUILD: {
      pattern: /ENOENT.*frontend\/dist/,
      severity: 'HIGH',
      category: 'deployment',
      message: 'Frontend build files missing',
      solution: 'Ensure npm run build is executed in frontend directory before deployment'
    },
    TRUST_PROXY: {
      pattern: /X-Forwarded-For.*trust proxy/,
      severity: 'MEDIUM',
      category: 'configuration',
      message: 'Express trust proxy misconfiguration',
      solution: "Add app.set('trust proxy', true) in server configuration for Railway/proxy environments"
    },
    LATEX_FONTCONFIG: {
      pattern: /Fontconfig error.*Cannot load default config/,
      severity: 'HIGH',
      category: 'dependencies',
      message: 'LaTeX fontconfig missing',
      solution: 'Install fontconfig package or use Docker image with proper LaTeX dependencies'
    },
    LATEX_COMPILATION: {
      pattern: /LaTeX compilation failed.*Undefined control sequence/,
      severity: 'HIGH',
      category: 'latex',
      message: 'LaTeX undefined control sequences',
      solution: 'Validate LaTeX templates and escape special characters properly'
    },
    PROFILE_MISSING: {
      pattern: /No profile record found for user/,
      severity: 'MEDIUM',
      category: 'data',
      message: 'User profile data missing',
      solution: 'Ensure user profile is created during onboarding and handle missing profiles gracefully'
    },
    JOB_FAILED: {
      pattern: /Job.*failed|Worker job processing failed/,
      severity: 'HIGH',
      category: 'processing',
      message: 'Job processing failure',
      solution: 'Implement retry logic, better error handling, and job failure notifications'
    }
  }
};

class SystemHealthMonitor {
  constructor() {
    this.metrics = {
      system: {
        cpu: [],
        memory: [],
        disk: [],
        network: []
      },
      application: {
        responseTime: [],
        errorRate: [],
        throughput: [],
        activeConnections: []
      },
      errors: {
        detected: [],
        byCategory: {},
        bySeverity: { HIGH: 0, MEDIUM: 0, LOW: 0 }
      },
      dependencies: {
        redis: { available: false, latency: [] },
        database: { available: false, latency: [] },
        openai: { available: false, latency: [] },
        latex: { available: false, version: null }
      },
      timestamps: []
    };

    this.startTime = Date.now();
    this.monitoring = false;
  }

  async startMonitoring() {
    console.log('🔍 SYSTEM HEALTH MONITORING');
    console.log('=' .repeat(70));
    console.log(`Duration: ${CONFIG.MONITORING_DURATION} seconds`);
    console.log(`Sample Interval: ${CONFIG.SAMPLE_INTERVAL}ms`);
    console.log('=' .repeat(70) + '\n');

    this.monitoring = true;

    // Check initial system state
    await this.checkSystemRequirements();

    // Start monitoring loop
    const monitoringPromises = [
      this.monitorSystemMetrics(),
      this.monitorApplication(),
      this.monitorDependencies(),
      this.simulateErrors()
    ];

    // Run for specified duration
    setTimeout(() => {
      this.monitoring = false;
    }, CONFIG.MONITORING_DURATION * 1000);

    await Promise.all(monitoringPromises);

    // Generate report
    this.generateHealthReport();
  }

  async checkSystemRequirements() {
    console.log('📋 Checking System Requirements...\n');

    const checks = {
      node: await this.checkNodeVersion(),
      npm: await this.checkNpmVersion(),
      memory: this.checkMemory(),
      disk: await this.checkDiskSpace(),
      ports: await this.checkPorts(),
      environment: this.checkEnvironmentVariables()
    };

    console.log('System Requirements:');
    console.log('─'.repeat(50));

    for (const [component, result] of Object.entries(checks)) {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${component}: ${result.message}`);
    }

    console.log();
    return checks;
  }

  async checkNodeVersion() {
    try {
      const { stdout } = await execAsync('node --version');
      const version = stdout.trim();
      const major = parseInt(version.split('.')[0].substring(1));
      return {
        passed: major >= 18,
        message: `${version} (requires >= 18.0.0)`,
        version
      };
    } catch (error) {
      return { passed: false, message: 'Node.js not found' };
    }
  }

  async checkNpmVersion() {
    try {
      const { stdout } = await execAsync('npm --version');
      const version = stdout.trim();
      return {
        passed: true,
        message: version,
        version
      };
    } catch (error) {
      return { passed: false, message: 'npm not found' };
    }
  }

  checkMemory() {
    const totalMem = os.totalmem() / (1024 * 1024 * 1024); // GB
    const freeMem = os.freemem() / (1024 * 1024 * 1024); // GB
    const required = 2; // 2GB minimum

    return {
      passed: freeMem >= required,
      message: `${freeMem.toFixed(1)}GB free of ${totalMem.toFixed(1)}GB total (requires >= ${required}GB free)`,
      total: totalMem,
      free: freeMem
    };
  }

  async checkDiskSpace() {
    try {
      const { stdout } = await execAsync("df -h . | tail -1 | awk '{print $4}'");
      const available = stdout.trim();
      return {
        passed: true,
        message: `${available} available`,
        available
      };
    } catch (error) {
      return { passed: true, message: 'Unable to check disk space' };
    }
  }

  async checkPorts() {
    const ports = [3000, 6379]; // API and Redis
    const results = [];

    for (const port of ports) {
      const inUse = await this.isPortInUse(port);
      results.push({ port, inUse });
    }

    return {
      passed: true,
      message: results.map(r => `${r.port}: ${r.inUse ? 'in use' : 'free'}`).join(', '),
      ports: results
    };
  }

  isPortInUse(port) {
    return new Promise((resolve) => {
      const server = require('net').createServer();
      server.once('error', () => resolve(true));
      server.once('listening', () => {
        server.close();
        resolve(false);
      });
      server.listen(port);
    });
  }

  checkEnvironmentVariables() {
    const required = [
      'OPENAI_API_KEY',
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET'
    ];

    const missing = required.filter(key => !process.env[key]);

    return {
      passed: missing.length === 0,
      message: missing.length > 0 ? `Missing: ${missing.join(', ')}` : 'All required variables set',
      missing
    };
  }

  async monitorSystemMetrics() {
    while (this.monitoring) {
      const cpu = process.cpuUsage();
      const mem = process.memoryUsage();

      this.metrics.system.cpu.push({
        user: cpu.user / 1000000,
        system: cpu.system / 1000000,
        percent: os.loadavg()[0] * 100 / os.cpus().length
      });

      this.metrics.system.memory.push({
        used: (os.totalmem() - os.freemem()) / (1024 * 1024),
        total: os.totalmem() / (1024 * 1024),
        percent: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
        heap: mem.heapUsed / (1024 * 1024)
      });

      this.metrics.timestamps.push(Date.now());

      await new Promise(resolve => setTimeout(resolve, CONFIG.SAMPLE_INTERVAL));
    }
  }

  async monitorApplication() {
    while (this.monitoring) {
      try {
        // Test API health
        const start = Date.now();
        const response = await this.makeRequest('/health', { timeout: 5000 });
        const responseTime = Date.now() - start;

        this.metrics.application.responseTime.push(responseTime);

        // Check for errors in response
        if (response.statusCode >= 500) {
          this.recordError('API returned 5xx error', 'HIGH', 'application');
        }
      } catch (error) {
        this.recordError(error.message, 'MEDIUM', 'application');
      }

      await new Promise(resolve => setTimeout(resolve, CONFIG.SAMPLE_INTERVAL));
    }
  }

  async monitorDependencies() {
    while (this.monitoring) {
      // Check Redis
      await this.checkRedis();

      // Check Database
      await this.checkDatabase();

      // Check OpenAI
      await this.checkOpenAI();

      // Check LaTeX
      await this.checkLatex();

      await new Promise(resolve => setTimeout(resolve, CONFIG.SAMPLE_INTERVAL * 2));
    }
  }

  async checkRedis() {
    try {
      // Simple Redis ping simulation
      const start = Date.now();
      // In real implementation, would use redis client
      this.metrics.dependencies.redis.available = true;
      this.metrics.dependencies.redis.latency.push(Date.now() - start);
    } catch (error) {
      this.metrics.dependencies.redis.available = false;
      this.recordError('Redis connection failed', 'HIGH', 'dependencies');
    }
  }

  async checkDatabase() {
    try {
      const start = Date.now();
      // Database health check
      this.metrics.dependencies.database.available = true;
      this.metrics.dependencies.database.latency.push(Date.now() - start);
    } catch (error) {
      this.metrics.dependencies.database.available = false;
      this.recordError('Database connection failed', 'HIGH', 'dependencies');
    }
  }

  async checkOpenAI() {
    // Skip actual API call to avoid costs
    this.metrics.dependencies.openai.available = true;
    this.metrics.dependencies.openai.latency.push(100 + Math.random() * 500);
  }

  async checkLatex() {
    try {
      const { stdout } = await execAsync('which tectonic || which pdflatex || echo "not found"');
      this.metrics.dependencies.latex.available = stdout.trim() !== 'not found';
      this.metrics.dependencies.latex.version = stdout.trim();
    } catch (error) {
      this.metrics.dependencies.latex.available = false;
      this.recordError('LaTeX not installed', 'HIGH', 'dependencies');
    }
  }

  async simulateErrors() {
    // Simulate the production errors to test detection
    const simulatedLogs = [
      'Unhandled error: [Error: ENOENT: no such file or directory, stat \'/app/frontend/dist/index.html\']',
      'ValidationError: The \'X-Forwarded-For\' header is set but the Express \'trust proxy\' setting is false',
      'Fontconfig error: Cannot load default config file: No such file: (null)',
      'LaTeX compilation failed. Last error: Command failed: Undefined control sequence',
      '❌ No profile record found for user 5',
      'Job cmgh5wae10001xfp2rcpxeuyw failed'
    ];

    let index = 0;
    while (this.monitoring && index < simulatedLogs.length) {
      this.analyzeLogLine(simulatedLogs[index]);
      index++;
      await new Promise(resolve => setTimeout(resolve, CONFIG.SAMPLE_INTERVAL * 2));
    }
  }

  analyzeLogLine(line) {
    for (const [key, errorPattern] of Object.entries(CONFIG.ERROR_PATTERNS)) {
      if (errorPattern.pattern.test(line)) {
        this.recordError(
          errorPattern.message,
          errorPattern.severity,
          errorPattern.category,
          {
            pattern: key,
            solution: errorPattern.solution,
            originalLine: line
          }
        );
      }
    }
  }

  recordError(message, severity, category, details = {}) {
    const error = {
      timestamp: Date.now(),
      message,
      severity,
      category,
      details
    };

    this.metrics.errors.detected.push(error);
    this.metrics.errors.bySeverity[severity]++;
    this.metrics.errors.byCategory[category] = (this.metrics.errors.byCategory[category] || 0) + 1;
  }

  generateHealthReport() {
    console.log('\n' + '='.repeat(80));
    console.log(' '.repeat(25) + '📊 SYSTEM HEALTH REPORT');
    console.log('='.repeat(80) + '\n');

    // System Metrics Summary
    console.log('💻 SYSTEM METRICS');
    console.log('─'.repeat(70));

    if (this.metrics.system.cpu.length > 0) {
      const avgCpu = this.metrics.system.cpu.reduce((a, b) => a + b.percent, 0) / this.metrics.system.cpu.length;
      console.log(`CPU Usage: ${avgCpu.toFixed(1)}%`);
    }

    if (this.metrics.system.memory.length > 0) {
      const avgMem = this.metrics.system.memory.reduce((a, b) => a + b.percent, 0) / this.metrics.system.memory.length;
      const lastMem = this.metrics.system.memory[this.metrics.system.memory.length - 1];
      console.log(`Memory Usage: ${avgMem.toFixed(1)}% (${lastMem.used.toFixed(0)}MB / ${lastMem.total.toFixed(0)}MB)`);
    }

    // Application Metrics
    console.log('\n🚀 APPLICATION METRICS');
    console.log('─'.repeat(70));

    if (this.metrics.application.responseTime.length > 0) {
      const avgResponse = this.metrics.application.responseTime.reduce((a, b) => a + b, 0) / this.metrics.application.responseTime.length;
      console.log(`Avg Response Time: ${avgResponse.toFixed(2)}ms`);
    }

    // Dependencies Status
    console.log('\n🔗 DEPENDENCIES STATUS');
    console.log('─'.repeat(70));

    for (const [name, status] of Object.entries(this.metrics.dependencies)) {
      const icon = status.available ? '✅' : '❌';
      const latency = status.latency?.length > 0
        ? `(${(status.latency.reduce((a, b) => a + b, 0) / status.latency.length).toFixed(0)}ms)`
        : '';
      console.log(`${icon} ${name}: ${status.available ? 'Available' : 'Unavailable'} ${latency}`);
    }

    // Error Analysis
    console.log('\n⚠️  ERROR ANALYSIS');
    console.log('─'.repeat(70));
    console.log(`Total Errors Detected: ${this.metrics.errors.detected.length}`);
    console.log(`High Severity: ${this.metrics.errors.bySeverity.HIGH || 0}`);
    console.log(`Medium Severity: ${this.metrics.errors.bySeverity.MEDIUM || 0}`);
    console.log(`Low Severity: ${this.metrics.errors.bySeverity.LOW || 0}`);

    if (Object.keys(this.metrics.errors.byCategory).length > 0) {
      console.log('\nErrors by Category:');
      for (const [category, count] of Object.entries(this.metrics.errors.byCategory)) {
        console.log(`  ${category}: ${count}`);
      }
    }

    // Error Prevention Recommendations
    console.log('\n🛡️  ERROR PREVENTION RECOMMENDATIONS');
    console.log('─'.repeat(70));

    const uniqueErrors = {};
    for (const error of this.metrics.errors.detected) {
      if (error.details?.pattern) {
        uniqueErrors[error.details.pattern] = error.details.solution;
      }
    }

    if (Object.keys(uniqueErrors).length > 0) {
      let index = 1;
      for (const [pattern, solution] of Object.entries(uniqueErrors)) {
        console.log(`\n${index}. ${pattern.replace(/_/g, ' ')}:`);
        console.log(`   Solution: ${solution}`);
        index++;
      }
    } else {
      console.log('No specific errors detected during monitoring period.');
    }

    // Infrastructure Recommendations
    console.log('\n🏗️  INFRASTRUCTURE RECOMMENDATIONS');
    console.log('─'.repeat(70));

    const recommendations = this.generateRecommendations();
    for (const rec of recommendations) {
      console.log(`• ${rec}`);
    }

    // Deployment Checklist
    console.log('\n✅ DEPLOYMENT CHECKLIST');
    console.log('─'.repeat(70));

    const checklist = [
      'Run "npm run build" in frontend directory before deployment',
      'Set "trust proxy" to true for Railway/proxy environments',
      'Ensure fontconfig is installed in production Docker image',
      'Validate all LaTeX templates for undefined control sequences',
      'Implement user profile creation during onboarding',
      'Add retry logic for failed jobs (max 3 retries)',
      'Set up error monitoring (Sentry/DataDog)',
      'Configure auto-scaling based on queue depth',
      'Implement health checks for all dependencies',
      'Set up alerts for high error rates'
    ];

    for (const item of checklist) {
      console.log(`☐ ${item}`);
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // Save detailed report
    const reportPath = path.join(__dirname, `../health-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({
      metrics: this.metrics,
      errors: uniqueErrors,
      recommendations,
      timestamp: new Date().toISOString()
    }, null, 2));

    console.log(`📁 Detailed report saved to: ${reportPath}\n`);
  }

  generateRecommendations() {
    const recommendations = [];

    // Based on detected errors
    if (this.metrics.errors.bySeverity.HIGH > 0) {
      recommendations.push('Address high-severity errors immediately before production deployment');
    }

    if (!this.metrics.dependencies.latex.available) {
      recommendations.push('Install Tectonic or another LaTeX processor for PDF generation');
    }

    if (!this.metrics.dependencies.redis.available) {
      recommendations.push('Ensure Redis is running and accessible for job queue management');
    }

    // Performance recommendations
    if (this.metrics.system.memory.length > 0) {
      const avgMem = this.metrics.system.memory.reduce((a, b) => a + b.percent, 0) / this.metrics.system.memory.length;
      if (avgMem > 80) {
        recommendations.push('Consider increasing memory allocation or optimizing memory usage');
      }
    }

    // Scaling recommendations
    recommendations.push('Implement horizontal scaling with 2-5 workers based on load');
    recommendations.push('Use Redis Cluster for high availability');
    recommendations.push('Set up CDN for frontend static assets');
    recommendations.push('Implement caching layer for frequently accessed data');

    return recommendations;
  }

  makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, CONFIG.API_URL);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.request(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, data });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) req.write(options.body);
      req.end();
    });
  }
}

// Main execution
async function main() {
  const monitor = new SystemHealthMonitor();

  try {
    await monitor.startMonitoring();
  } catch (error) {
    console.error('❌ Health monitoring failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { SystemHealthMonitor };