# PASS ATS Test Suite Documentation

## Overview

This document provides comprehensive documentation for the PASS ATS testing infrastructure. The test suite ensures reliability, performance, and correctness across all system components.

## Test Structure

```
tests/
├── unit/                 # Unit tests for individual components
│   └── auth.test.js     # Authentication endpoint tests
├── integration/          # Integration tests with mocked dependencies
│   ├── resume-generation.test.js  # Resume generation and AI tests
│   ├── cors-rate-limiting.test.js # CORS and rate limiting tests
│   └── sse-pdf.test.js           # SSE streaming and PDF tests
├── e2e/                  # End-to-end browser automation tests
│   └── chrome-extension.spec.js  # Chrome extension tests
├── fixtures/             # Test data and mock responses
│   └── testData.js      # Centralized test data
├── setup.js             # Jest setup and global helpers
└── run-tests.sh         # Test runner script
```

## Running Tests

### Install Dependencies
```bash
cd server
npm install
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # E2E tests (requires Chrome)
```

### Generate Coverage Report
```bash
npm run test:coverage
```

### Watch Mode (Development)
```bash
npm run test:watch
```

### Using the Test Runner Script
```bash
./tests/run-tests.sh
```

## Test Coverage Requirements

- **Line Coverage**: Minimum 85%
- **Branch Coverage**: Minimum 75%
- **Function Coverage**: Minimum 85%
- **Statement Coverage**: Minimum 85%

## Test Categories

### 1. Unit Tests (`tests/unit/`)

#### Authentication Tests (`auth.test.js`)
- **POST /auth/signup**: User registration
  - Valid user creation
  - Duplicate email prevention
  - Password hashing
  - JWT token generation
  - Input validation

- **POST /auth/login**: User authentication
  - Valid credentials
  - Invalid credentials
  - Missing fields
  - Token generation and expiration

- **PUT /me**: Protected route access
  - Valid token authentication
  - Invalid/expired tokens
  - Profile updates

### 2. Integration Tests (`tests/integration/`)

#### Resume Generation Tests (`resume-generation.test.js`)
- **POST /generate**: AI-powered resume generation
  - Profile and job description processing
  - OpenAI API integration (mocked)
  - Keyword matching and optimization
  - Output validation
  - Error handling

- **POST /generate/job**: SSE-based generation
  - Real-time progress streaming
  - Event ordering
  - Error propagation
  - Client disconnection handling

- **POST /compile**: PDF generation
  - Resume to PDF conversion
  - Template handling
  - Metadata inclusion

#### CORS and Rate Limiting Tests (`cors-rate-limiting.test.js`)
- **CORS Configuration**
  - Allowed origins validation
  - Chrome extension support
  - Preflight requests
  - Credentials handling

- **Rate Limiting**
  - Request counting per IP
  - Window-based limits
  - Header inclusion
  - Retry-After timing
  - Concurrent request handling

#### SSE and PDF Tests (`sse-pdf.test.js`)
- **Server-Sent Events**
  - Connection establishment
  - Event streaming
  - Progress tracking
  - Error events
  - Multiple client support

- **PDF Generation**
  - Content rendering
  - Checksum validation
  - Metadata accuracy
  - Golden file testing
  - Size consistency

### 3. End-to-End Tests (`tests/e2e/`)

#### Chrome Extension Tests (`chrome-extension.spec.js`)
- **Extension Installation**
  - Manifest validation
  - Permission checks
  - Extension ID retrieval

- **Popup Functionality**
  - UI rendering
  - Authentication flow
  - State management

- **Side Panel Integration**
  - Job description extraction
  - Content script injection
  - User interaction

- **Complete Workflows**
  - Full resume generation flow
  - Storage persistence
  - Error handling
  - Performance metrics

## Mock Data and Fixtures

### Test Users
```javascript
{
  validUser: {
    email: 'test@example.com',
    password: 'TestPassword123!',
    name: 'Test User'
  }
}
```

### Test Profiles
- Complete profile with all fields
- Minimal profile with basic information
- Edge cases and validation boundaries

### Job Descriptions
- Senior Engineer position
- Data Scientist role
- Various industry examples

### Mock API Responses
- OpenAI completion responses
- Error scenarios
- Rate limiting responses

## Test Helpers

Global test helpers available in all tests:

```javascript
// Generate test JWT token
testHelpers.generateTestToken(payload)

// Create mock request object
testHelpers.createMockRequest(overrides)

// Create mock response object
testHelpers.createMockResponse()

// Wait for event emission
testHelpers.waitForEvent(emitter, event, timeout)
```

## Continuous Integration

### CI Configuration
Tests are configured to run in CI/CD pipelines with:
- Headless mode for E2E tests
- Parallel execution where possible
- Coverage reporting
- Failure notifications

### Environment Variables
Required for testing:
```bash
NODE_ENV=test
JWT_SECRET=test-jwt-secret
OPENAI_API_KEY=sk-test-key
PORT=3002
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

## Best Practices

1. **Test Independence**: Each test should be completely independent
2. **Mock External Services**: Always mock OpenAI, database, and other external services
3. **Clear Test Names**: Use descriptive test names that explain the scenario
4. **Proper Cleanup**: Always clean up resources in afterEach/afterAll hooks
5. **Deterministic Tests**: Avoid time-dependent or random behaviors
6. **Error Scenarios**: Test both success and failure paths
7. **Performance**: Keep tests fast (< 30s for unit, < 2min for integration)

## Debugging Tests

### Run Single Test File
```bash
npm test -- tests/unit/auth.test.js
```

### Run with Verbose Output
```bash
npm test -- --verbose
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal"
}
```

## Common Issues and Solutions

### Issue: Tests timeout
**Solution**: Increase timeout in jest.config.js or specific test

### Issue: Port already in use
**Solution**: Use different ports for test environment (PORT=3002)

### Issue: E2E tests fail to find extension
**Solution**: Ensure extension is built (`npm run build:extension`)

### Issue: Flaky tests
**Solution**: Add retry logic or increase timeouts for network operations

## Maintenance

### Adding New Tests
1. Create test file in appropriate directory
2. Import necessary fixtures and helpers
3. Follow existing patterns and conventions
4. Update this documentation

### Updating Mock Data
1. Modify `tests/fixtures/testData.js`
2. Ensure backward compatibility
3. Update dependent tests

### Coverage Improvements
1. Run coverage report: `npm run test:coverage`
2. Identify uncovered lines
3. Add tests for edge cases
4. Focus on critical paths first

## Performance Benchmarks

Target performance metrics:
- Unit tests: < 10 seconds total
- Integration tests: < 30 seconds total
- E2E tests: < 2 minutes total
- Full suite: < 5 minutes

## Contact and Support

For questions or issues with tests:
1. Check this documentation
2. Review existing test examples
3. Consult team leads for architectural decisions

---

Last Updated: 2025-09-13
Version: 1.0.0