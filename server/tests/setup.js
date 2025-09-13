// Test environment setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.OPENAI_API_KEY = 'sk-test-fake-api-key-for-testing';
process.env.PORT = '3002'; // Use different port for tests
process.env.RATE_LIMIT_REQUESTS = '100';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3001,chrome-extension://*';

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Global test helpers
global.testHelpers = {
  generateTestToken: (payload) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
  },
  
  createMockRequest: (overrides = {}) => ({
    headers: {},
    body: {},
    params: {},
    query: {},
    ...overrides
  }),
  
  createMockResponse: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      write: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };
    return res;
  },
  
  waitForEvent: (emitter, event, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);
      
      emitter.once(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }
};

// Cleanup after all tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
});