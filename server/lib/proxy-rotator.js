/**
 * Proxy Rotator
 * Manages residential proxy rotation for auto-apply at scale
 *
 * Supports multiple providers:
 * - IPRoyal (recommended for cost)
 * - Bright Data
 * - Oxylabs
 * - SmartProxy
 * - Custom proxy lists
 */

import logger from './logger.js';
import crypto from 'crypto';

class ProxyRotator {
  constructor() {
    this.provider = process.env.PROXY_PROVIDER || 'iproyal';
    this.enabled = process.env.PROXY_ENABLED === 'true';

    // Provider configurations
    this.configs = {
      iproyal: {
        host: process.env.PROXY_HOST || 'geo.iproyal.com',
        port: process.env.PROXY_PORT || '12321',
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD,
        // IPRoyal session format: username_session-{id}_country-us
        sessionFormat: (user, sessionId, country) =>
          `${user}_session-${sessionId}${country ? `_country-${country}` : ''}`
      },
      brightdata: {
        host: process.env.PROXY_HOST || 'brd.superproxy.io',
        port: process.env.PROXY_PORT || '22225',
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD,
        // Bright Data session format: username-session-{id}
        sessionFormat: (user, sessionId, country) =>
          `${user}-session-${sessionId}${country ? `-country-${country}` : ''}`
      },
      oxylabs: {
        host: process.env.PROXY_HOST || 'pr.oxylabs.io',
        port: process.env.PROXY_PORT || '7777',
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD,
        // Oxylabs session format: customer-{user}-sessid-{id}
        sessionFormat: (user, sessionId, country) =>
          `customer-${user}-sessid-${sessionId}${country ? `-cc-${country}` : ''}`
      },
      smartproxy: {
        host: process.env.PROXY_HOST || 'gate.smartproxy.com',
        port: process.env.PROXY_PORT || '7000',
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD,
        // SmartProxy session format: user-session-{id}
        sessionFormat: (user, sessionId, country) =>
          `${user}-session-${sessionId}${country ? `-country-${country}` : ''}`
      },
      custom: {
        // For custom proxy lists or self-hosted proxies
        host: process.env.PROXY_HOST,
        port: process.env.PROXY_PORT,
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD,
        sessionFormat: (user, sessionId) => user
      }
    };

    // Stats tracking
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      blockedRequests: 0,
      byCountry: {}
    };

    // Default country for job applications (US)
    this.defaultCountry = process.env.PROXY_COUNTRY || 'us';

    this.logConfig();
  }

  logConfig() {
    if (!this.enabled) {
      logger.info('🔓 Proxy rotation DISABLED - using direct connection');
      return;
    }

    const config = this.configs[this.provider];
    if (!config || !config.username) {
      logger.warn('⚠️ Proxy enabled but not configured properly');
      logger.warn('   Set PROXY_USERNAME, PROXY_PASSWORD, and optionally PROXY_HOST/PROXY_PORT');
      return;
    }

    logger.info(`🔐 Proxy rotation ENABLED`);
    logger.info(`   Provider: ${this.provider}`);
    logger.info(`   Host: ${config.host}:${config.port}`);
    logger.info(`   Default country: ${this.defaultCountry}`);
  }

  /**
   * Get a rotating proxy (new IP each time)
   * Use for: Different job applications
   */
  getRotatingProxy(options = {}) {
    if (!this.enabled) return null;

    const config = this.configs[this.provider];
    if (!config || !config.username) return null;

    const country = options.country || this.defaultCountry;

    // Generate random session ID for rotation
    const sessionId = crypto.randomBytes(8).toString('hex');
    const username = config.sessionFormat(config.username, sessionId, country);

    this.stats.totalRequests++;
    if (country) {
      this.stats.byCountry[country] = (this.stats.byCountry[country] || 0) + 1;
    }

    const proxy = {
      server: `http://${config.host}:${config.port}`,
      username: username,
      password: config.password
    };

    logger.debug({
      provider: this.provider,
      sessionId: sessionId.substring(0, 8),
      country
    }, '🔄 Generated rotating proxy');

    return proxy;
  }

  /**
   * Get a sticky proxy (same IP for entire session)
   * Use for: Multi-page application forms
   */
  getStickyProxy(applicationId, options = {}) {
    if (!this.enabled) return null;

    const config = this.configs[this.provider];
    if (!config || !config.username) return null;

    const country = options.country || this.defaultCountry;

    // Use application ID as session ID for consistency
    const sessionId = this.hashString(applicationId);
    const username = config.sessionFormat(config.username, sessionId, country);

    const proxy = {
      server: `http://${config.host}:${config.port}`,
      username: username,
      password: config.password
    };

    logger.debug({
      provider: this.provider,
      applicationId,
      sessionId: sessionId.substring(0, 8),
      country
    }, '📌 Generated sticky proxy');

    return proxy;
  }

  /**
   * Get proxy for specific job board
   * Some job boards need specific countries or proxy types
   */
  getProxyForJobBoard(jobBoardDomain, applicationId) {
    // Job board specific configurations
    const boardConfigs = {
      'greenhouse.io': { country: 'us' },
      'lever.co': { country: 'us' },
      'workday.com': { country: 'us' },
      'myworkdayjobs.com': { country: 'us' },
      'ashbyhq.com': { country: 'us' },
      'jobs.smartrecruiters.com': { country: 'us' },
      // Add more as needed
    };

    // Find matching config
    let boardConfig = { country: this.defaultCountry };
    for (const [domain, config] of Object.entries(boardConfigs)) {
      if (jobBoardDomain.includes(domain)) {
        boardConfig = config;
        break;
      }
    }

    // Use sticky proxy for multi-page forms
    return this.getStickyProxy(applicationId, boardConfig);
  }

  /**
   * Report proxy success/failure for tracking
   */
  reportResult(success, blocked = false) {
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
      if (blocked) {
        this.stats.blockedRequests++;
      }
    }
  }

  /**
   * Get proxy stats
   */
  getStats() {
    const successRate = this.stats.totalRequests > 0
      ? ((this.stats.successfulRequests / this.stats.totalRequests) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      successRate: `${successRate}%`,
      enabled: this.enabled,
      provider: this.provider
    };
  }

  /**
   * Reset stats
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      blockedRequests: 0,
      byCountry: {}
    };
  }

  /**
   * Test proxy connection
   */
  async testConnection() {
    if (!this.enabled) {
      return { success: false, message: 'Proxy not enabled' };
    }

    const proxy = this.getRotatingProxy();
    if (!proxy) {
      return { success: false, message: 'Proxy not configured' };
    }

    try {
      // Use native fetch with proxy agent
      const { HttpsProxyAgent } = await import('https-proxy-agent');
      const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.server.replace('http://', '')}`;
      const agent = new HttpsProxyAgent(proxyUrl);

      const response = await fetch('https://api.ipify.org?format=json', {
        agent,
        timeout: 10000
      });

      const data = await response.json();

      logger.info(`✅ Proxy test successful - IP: ${data.ip}`);
      return {
        success: true,
        ip: data.ip,
        provider: this.provider
      };
    } catch (error) {
      logger.error({ error: error.message }, '❌ Proxy test failed');
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Hash string for consistent session IDs
   */
  hashString(str) {
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 16);
  }

  /**
   * Check if proxy is enabled and configured
   */
  isConfigured() {
    if (!this.enabled) return false;
    const config = this.configs[this.provider];
    return config && config.username && config.password;
  }
}

// Singleton instance
const proxyRotator = new ProxyRotator();

export default proxyRotator;
export { ProxyRotator };
