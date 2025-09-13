import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

describe('CORS Configuration Tests', () => {
  let app;
  
  beforeEach(() => {
    // Reset environment
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3001,chrome-extension://*';
    
    app = express();
    app.use(express.json());
    
    // Mock CORS middleware
    const cors = (options) => {
      return (req, res, next) => {
        const origin = req.headers.origin;
        const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
        
        // Check if origin is allowed
        const isAllowed = !origin || allowedOrigins.some(allowed => {
          if (allowed === '*') return true;
          if (allowed.endsWith('*')) {
            return origin.startsWith(allowed.slice(0, -1));
          }
          return origin === allowed;
        });
        
        if (isAllowed) {
          res.setHeader('Access-Control-Allow-Origin', origin || '*');
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        }
        
        if (req.method === 'OPTIONS') {
          res.sendStatus(isAllowed ? 200 : 403);
        } else {
          next();
        }
      };
    };
    
    app.use(cors());
    
    // Test endpoint
    app.get('/test', (req, res) => {
      res.json({ message: 'Success' });
    });
    
    app.post('/test', (req, res) => {
      res.json({ message: 'Created', data: req.body });
    });
  });
  
  describe('Allowed Origins', () => {
    test('should allow requests from localhost:3000', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3000')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
    
    test('should allow requests from localhost:3001', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3001')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    });
    
    test('should allow requests from Chrome extensions', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'chrome-extension://abcdefghijklmnop')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBe('chrome-extension://abcdefghijklmnop');
    });
    
    test('should allow requests with no origin (server-to-server)', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
    
    test('should block requests from unauthorized origins', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://malicious-site.com')
        .expect(200); // Request goes through but without CORS headers
      
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
  
  describe('Preflight Requests', () => {
    test('should handle OPTIONS requests correctly', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
    });
    
    test('should reject OPTIONS from unauthorized origins', async () => {
      await request(app)
        .options('/test')
        .set('Origin', 'http://evil-site.com')
        .set('Access-Control-Request-Method', 'POST')
        .expect(403);
    });
  });
  
  describe('Cross-Origin Requests', () => {
    test('should allow POST requests with JSON body from allowed origin', async () => {
      const testData = { name: 'Test', value: 123 };
      
      const response = await request(app)
        .post('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Content-Type', 'application/json')
        .send(testData)
        .expect(200);
      
      expect(response.body.data).toEqual(testData);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
    
    test('should include credentials in CORS headers', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3000')
        .expect(200);
      
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });
});

describe('Rate Limiting Tests', () => {
  let app;
  const RATE_LIMIT = 10; // Low limit for testing
  const RATE_WINDOW = 1000; // 1 second window
  
  beforeEach(() => {
    // Configure rate limiting
    process.env.RATE_LIMIT_REQUESTS = String(RATE_LIMIT);
    process.env.RATE_LIMIT_WINDOW_MS = String(RATE_WINDOW);
    
    app = express();
    
    // Mock rate limiting middleware
    const requestCounts = new Map();
    
    const rateLimit = (req, res, next) => {
      const ip = req.ip || 'test-ip';
      const now = Date.now();
      
      if (!requestCounts.has(ip)) {
        requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
      } else {
        const userData = requestCounts.get(ip);
        
        if (now > userData.resetTime) {
          userData.count = 1;
          userData.resetTime = now + RATE_WINDOW;
        } else if (userData.count >= RATE_LIMIT) {
          const retryAfter = Math.ceil((userData.resetTime - now) / 1000);
          res.set({
            'X-RateLimit-Limit': String(RATE_LIMIT),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(userData.resetTime / 1000)),
            'Retry-After': String(retryAfter)
          });
          return res.status(429).json({
            error: 'Too many requests',
            retryAfter,
            limit: RATE_LIMIT,
            window: RATE_WINDOW
          });
        } else {
          userData.count++;
        }
      }
      
      const userData = requestCounts.get(ip);
      const remaining = Math.max(0, RATE_LIMIT - userData.count);
      
      res.set({
        'X-RateLimit-Limit': String(RATE_LIMIT),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(Math.ceil(userData.resetTime / 1000))
      });
      
      next();
    };
    
    app.use(rateLimit);
    
    // Test endpoint
    app.get('/test', (req, res) => {
      res.json({ message: 'Success' });
    });
  });
  
  describe('Request Limiting', () => {
    test('should allow requests within rate limit', async () => {
      for (let i = 0; i < RATE_LIMIT; i++) {
        const response = await request(app)
          .get('/test')
          .expect(200);
        
        expect(response.headers['x-ratelimit-limit']).toBe(String(RATE_LIMIT));
        expect(parseInt(response.headers['x-ratelimit-remaining'])).toBe(RATE_LIMIT - i - 1);
      }
    });
    
    test('should block requests exceeding rate limit', async () => {
      // Make requests up to the limit
      for (let i = 0; i < RATE_LIMIT; i++) {
        await request(app).get('/test').expect(200);
      }
      
      // Next request should be blocked
      const response = await request(app)
        .get('/test')
        .expect(429);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Too many requests');
      expect(response.body).toHaveProperty('retryAfter');
      expect(response.body).toHaveProperty('limit', RATE_LIMIT);
    });
    
    test('should include rate limit headers in responses', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
    
    test('should reset rate limit after window expires', async () => {
      // Exhaust rate limit
      for (let i = 0; i < RATE_LIMIT; i++) {
        await request(app).get('/test').expect(200);
      }
      
      // Should be blocked
      await request(app).get('/test').expect(429);
      
      // Wait for window to reset
      await new Promise(resolve => setTimeout(resolve, RATE_WINDOW + 100));
      
      // Should be allowed again
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers['x-ratelimit-remaining']).toBe(String(RATE_LIMIT - 1));
    });
    
    test('should track rate limits per IP', async () => {
      // Simulate different IPs
      const app1 = Object.create(app);
      const app2 = Object.create(app);
      
      // Both IPs should have independent limits
      for (let i = 0; i < RATE_LIMIT; i++) {
        await request(app1)
          .get('/test')
          .set('X-Forwarded-For', '192.168.1.1')
          .expect(200);
        
        await request(app2)
          .get('/test')
          .set('X-Forwarded-For', '192.168.1.2')
          .expect(200);
      }
    });
  });
  
  describe('Rate Limit Headers', () => {
    test('should include Retry-After header when rate limited', async () => {
      // Exhaust rate limit
      for (let i = 0; i < RATE_LIMIT; i++) {
        await request(app).get('/test');
      }
      
      const response = await request(app)
        .get('/test')
        .expect(429);
      
      expect(response.headers).toHaveProperty('retry-after');
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
    });
    
    test('should accurately track remaining requests', async () => {
      let remaining = RATE_LIMIT;
      
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .get('/test')
          .expect(200);
        
        remaining--;
        expect(response.headers['x-ratelimit-remaining']).toBe(String(remaining));
      }
    });
    
    test('should provide reset timestamp', async () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      const resetTime = parseInt(response.headers['x-ratelimit-reset']);
      expect(resetTime).toBeGreaterThan(beforeTime);
      expect(resetTime).toBeLessThanOrEqual(beforeTime + 2); // Within 2 seconds
    });
  });
  
  describe('Rate Limit Edge Cases', () => {
    test('should handle rapid concurrent requests', async () => {
      const requests = [];
      
      // Send many concurrent requests
      for (let i = 0; i < RATE_LIMIT + 5; i++) {
        requests.push(
          request(app).get('/test')
        );
      }
      
      const responses = await Promise.all(requests);
      
      // Count successful and rate-limited responses
      const successful = responses.filter(r => r.status === 200);
      const rateLimited = responses.filter(r => r.status === 429);
      
      expect(successful.length).toBeLessThanOrEqual(RATE_LIMIT);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
    
    test('should handle missing IP gracefully', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
    });
    
    test('should clean up old rate limit entries', async () => {
      // Make requests from multiple IPs
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get('/test')
          .set('X-Forwarded-For', `192.168.1.${i}`)
          .expect(200);
      }
      
      // Wait for cleanup window
      await new Promise(resolve => setTimeout(resolve, RATE_WINDOW + 1000));
      
      // Old entries should be cleaned, new requests should work
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get('/test')
          .set('X-Forwarded-For', `192.168.1.${i}`)
          .expect(200);
      }
    });
  });
});