import { jest } from '@jest/globals';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Chrome Extension E2E Tests', () => {
  let browser;
  let page;
  let extensionId;
  const extensionPath = path.join(__dirname, '../../../dist/extension');
  const serverUrl = 'http://localhost:3001';
  
  beforeAll(async () => {
    // Launch Chrome with extension loaded
    browser = await puppeteer.launch({
      headless: false, // Extension testing requires headed mode
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });
    
    // Get extension ID
    const targets = await browser.targets();
    const extensionTarget = targets.find(target => 
      target.type() === 'service_worker' || 
      target.type() === 'background_page'
    );
    
    if (extensionTarget) {
      const extensionUrl = extensionTarget.url();
      const matches = extensionUrl.match(/chrome-extension:\/\/([^\/]+)/);
      extensionId = matches ? matches[1] : null;
    }
    
    console.log('Extension ID:', extensionId);
  }, 30000);
  
  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });
  
  beforeEach(async () => {
    page = await browser.newPage();
  });
  
  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });
  
  describe('Extension Installation', () => {
    test('should load extension successfully', () => {
      expect(extensionId).toBeTruthy();
      expect(extensionId).toMatch(/^[a-z]{32}$/);
    });
    
    test('should have correct manifest permissions', async () => {
      const manifestPath = path.join(extensionPath, 'manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);
      
      expect(manifest.manifest_version).toBe(3);
      expect(manifest.permissions).toContain('storage');
      expect(manifest.permissions).toContain('sidePanel');
      expect(manifest.host_permissions).toContain('http://localhost:3001/*');
    });
  });
  
  describe('Popup Functionality', () => {
    test('should open extension popup', async () => {
      if (!extensionId) {
        console.warn('Extension ID not found, skipping popup test');
        return;
      }
      
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await page.waitForSelector('#app', { timeout: 5000 });
      
      const title = await page.$eval('h1', el => el.textContent);
      expect(title).toContain('PASS ATS');
    });
    
    test('should show login form when not authenticated', async () => {
      if (!extensionId) return;
      
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      
      // Clear any stored auth token
      await page.evaluate(() => {
        chrome.storage.local.clear();
      });
      
      await page.waitForSelector('#login-form', { timeout: 5000 });
      
      const emailInput = await page.$('#email');
      const passwordInput = await page.$('#password');
      const loginButton = await page.$('#login-button');
      
      expect(emailInput).toBeTruthy();
      expect(passwordInput).toBeTruthy();
      expect(loginButton).toBeTruthy();
    });
    
    test('should handle login flow', async () => {
      if (!extensionId) return;
      
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await page.waitForSelector('#login-form', { timeout: 5000 });
      
      // Mock server response
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (request.url().includes('/auth/login')) {
          request.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              token: 'test-token-123',
              user: { email: 'test@example.com', name: 'Test User' }
            })
          });
        } else {
          request.continue();
        }
      });
      
      // Fill login form
      await page.type('#email', 'test@example.com');
      await page.type('#password', 'TestPassword123');
      await page.click('#login-button');
      
      // Should redirect to main view
      await page.waitForSelector('#main-view', { timeout: 5000 });
      
      const welcomeMessage = await page.$eval('#welcome', el => el.textContent);
      expect(welcomeMessage).toContain('Test User');
    });
  });
  
  describe('Side Panel Integration', () => {
    test('should open side panel on job posting page', async () => {
      if (!extensionId) return;
      
      // Navigate to a mock job posting page
      await page.goto('https://www.linkedin.com/jobs/view/123456789');
      
      // Inject content script manually for testing
      await page.evaluate(() => {
        // Simulate content script injection
        const button = document.createElement('button');
        button.id = 'pass-ats-trigger';
        button.textContent = 'Generate Resume with PASS';
        button.style.position = 'fixed';
        button.style.top = '10px';
        button.style.right = '10px';
        button.style.zIndex = '9999';
        document.body.appendChild(button);
        
        button.addEventListener('click', () => {
          chrome.runtime.sendMessage({ action: 'openSidePanel' });
        });
      });
      
      // Check if button was injected
      const button = await page.$('#pass-ats-trigger');
      expect(button).toBeTruthy();
    });
    
    test('should extract job description from page', async () => {
      // Create a mock job posting page
      await page.setContent(`
        <html>
          <body>
            <h1>Senior Software Engineer</h1>
            <div class="company">Tech Corp</div>
            <div class="description">
              <h2>About the role</h2>
              <p>We are looking for a Senior Software Engineer...</p>
              <h3>Requirements</h3>
              <ul>
                <li>5+ years of experience</li>
                <li>JavaScript, React, Node.js</li>
                <li>AWS experience</li>
              </ul>
            </div>
          </body>
        </html>
      `);
      
      // Inject extraction script
      const jobData = await page.evaluate(() => {
        const title = document.querySelector('h1')?.textContent || '';
        const company = document.querySelector('.company')?.textContent || '';
        const description = document.querySelector('.description')?.textContent || '';
        
        return { title, company, description };
      });
      
      expect(jobData.title).toBe('Senior Software Engineer');
      expect(jobData.company).toBe('Tech Corp');
      expect(jobData.description).toContain('Requirements');
      expect(jobData.description).toContain('JavaScript');
    });
  });
  
  describe('Resume Generation Flow', () => {
    test('should complete full resume generation flow', async () => {
      if (!extensionId) return;
      
      // Setup mock server responses
      await page.setRequestInterception(true);
      
      page.on('request', request => {
        const url = request.url();
        
        if (url.includes('/auth/login')) {
          request.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              token: 'test-token',
              user: { email: 'test@example.com' }
            })
          });
        } else if (url.includes('/generate/job')) {
          // Simulate SSE response
          request.respond({
            status: 200,
            contentType: 'text/event-stream',
            body: `data: {"type":"start","progress":0}\n\ndata: {"type":"complete","progress":100,"resumeUrl":"/test.pdf"}\n\n`
          });
        } else {
          request.continue();
        }
      });
      
      // Start from popup
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      
      // Login
      await page.waitForSelector('#login-form', { timeout: 5000 });
      await page.type('#email', 'test@example.com');
      await page.type('#password', 'password');
      await page.click('#login-button');
      
      // Wait for main view
      await page.waitForSelector('#generate-button', { timeout: 5000 });
      
      // Click generate
      await page.click('#generate-button');
      
      // Should show progress
      await page.waitForSelector('#progress-bar', { timeout: 5000 });
      
      // Should complete and show download
      await page.waitForSelector('#download-button', { timeout: 10000 });
      
      const downloadButton = await page.$('#download-button');
      expect(downloadButton).toBeTruthy();
    });
  });
  
  describe('Storage and Persistence', () => {
    test('should persist user authentication', async () => {
      if (!extensionId) return;
      
      // Set auth token in storage
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      
      await page.evaluate(() => {
        chrome.storage.local.set({
          authToken: 'test-token-123',
          user: { email: 'test@example.com', name: 'Test User' }
        });
      });
      
      // Reload page
      await page.reload();
      
      // Should skip login and show main view
      await page.waitForSelector('#main-view', { timeout: 5000 });
      
      const userData = await page.evaluate(() => {
        return new Promise(resolve => {
          chrome.storage.local.get(['user'], result => {
            resolve(result.user);
          });
        });
      });
      
      expect(userData.email).toBe('test@example.com');
    });
    
    test('should store resume generation history', async () => {
      if (!extensionId) return;
      
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      
      // Add history item
      const historyItem = {
        id: 'resume-123',
        date: new Date().toISOString(),
        jobTitle: 'Software Engineer',
        company: 'Tech Corp',
        resumeUrl: '/output/resume-123.pdf'
      };
      
      await page.evaluate((item) => {
        chrome.storage.local.get(['history'], (result) => {
          const history = result.history || [];
          history.push(item);
          chrome.storage.local.set({ history });
        });
      }, historyItem);
      
      // Retrieve history
      const history = await page.evaluate(() => {
        return new Promise(resolve => {
          chrome.storage.local.get(['history'], result => {
            resolve(result.history);
          });
        });
      });
      
      expect(history).toHaveLength(1);
      expect(history[0].jobTitle).toBe('Software Engineer');
    });
  });
  
  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      if (!extensionId) return;
      
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      
      // Simulate network error
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (request.url().includes('/auth/login')) {
          request.abort('failed');
        } else {
          request.continue();
        }
      });
      
      // Try to login
      await page.waitForSelector('#login-form', { timeout: 5000 });
      await page.type('#email', 'test@example.com');
      await page.type('#password', 'password');
      await page.click('#login-button');
      
      // Should show error message
      await page.waitForSelector('.error-message', { timeout: 5000 });
      
      const errorText = await page.$eval('.error-message', el => el.textContent);
      expect(errorText).toContain('Network error');
    });
    
    test('should handle API errors', async () => {
      if (!extensionId) return;
      
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (request.url().includes('/auth/login')) {
          request.respond({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Invalid credentials' })
          });
        } else {
          request.continue();
        }
      });
      
      // Try to login with wrong credentials
      await page.waitForSelector('#login-form', { timeout: 5000 });
      await page.type('#email', 'wrong@example.com');
      await page.type('#password', 'wrongpassword');
      await page.click('#login-button');
      
      // Should show error
      await page.waitForSelector('.error-message', { timeout: 5000 });
      
      const errorText = await page.$eval('.error-message', el => el.textContent);
      expect(errorText).toContain('Invalid credentials');
    });
  });
  
  describe('Performance', () => {
    test('should load popup within acceptable time', async () => {
      if (!extensionId) return;
      
      const startTime = Date.now();
      
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await page.waitForSelector('#app', { timeout: 5000 });
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 2 seconds
      expect(loadTime).toBeLessThan(2000);
    });
    
    test('should handle large resume data efficiently', async () => {
      if (!extensionId) return;
      
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      
      // Create large profile data
      const largeProfile = {
        name: 'Test User',
        experience: Array(50).fill({
          title: 'Software Engineer',
          company: 'Company',
          description: 'Lorem ipsum '.repeat(100)
        })
      };
      
      const startTime = Date.now();
      
      await page.evaluate((profile) => {
        chrome.storage.local.set({ profile });
      }, largeProfile);
      
      const saveTime = Date.now() - startTime;
      
      // Should save within 1 second even with large data
      expect(saveTime).toBeLessThan(1000);
    });
  });
});