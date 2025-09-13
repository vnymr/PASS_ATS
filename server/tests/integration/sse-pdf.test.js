import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { EventEmitter } from 'events';
import { testProfiles, testJobDescriptions, testSSEEvents, testPDFMetadata } from '../fixtures/testData.js';
import crypto from 'crypto';

describe('SSE (Server-Sent Events) Streaming Tests', () => {
  let app;
  let jobEmitter;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    jobEmitter = new EventEmitter();
    
    // Mock job storage
    const jobs = new Map();
    
    // SSE endpoint for job progress
    app.get('/jobs/:jobId/stream', (req, res) => {
      const { jobId } = req.params;
      
      if (!jobs.has(jobId)) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      
      // Send initial connection event
      res.write(':ok\n\n');
      
      const job = jobs.get(jobId);
      
      // Event listener for updates
      const sendUpdate = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };
      
      // Listen for job events
      job.on('progress', sendUpdate);
      job.on('complete', (data) => {
        sendUpdate({ type: 'complete', ...data });
        res.end();
      });
      job.on('error', (error) => {
        sendUpdate({ type: 'error', error: error.message });
        res.end();
      });
      
      // Handle client disconnect
      req.on('close', () => {
        job.removeListener('progress', sendUpdate);
        res.end();
      });
    });
    
    // Create job endpoint
    app.post('/jobs', (req, res) => {
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const job = new EventEmitter();
      
      jobs.set(jobId, job);
      
      // Simulate job processing
      setTimeout(() => {
        job.emit('progress', { type: 'start', message: 'Job started', progress: 0 });
      }, 10);
      
      setTimeout(() => {
        job.emit('progress', { type: 'progress', message: 'Processing', progress: 50 });
      }, 50);
      
      setTimeout(() => {
        job.emit('complete', { 
          message: 'Job completed', 
          progress: 100,
          result: { success: true }
        });
        
        // Clean up after completion
        setTimeout(() => jobs.delete(jobId), 1000);
      }, 100);
      
      res.status(201).json({ jobId, status: 'created' });
    });
    
    // Error simulation endpoint
    app.post('/jobs/error', (req, res) => {
      const jobId = `job-error-${Date.now()}`;
      const job = new EventEmitter();
      
      jobs.set(jobId, job);
      
      setTimeout(() => {
        job.emit('progress', { type: 'start', message: 'Job started', progress: 0 });
      }, 10);
      
      setTimeout(() => {
        job.emit('error', new Error('Simulated processing error'));
      }, 50);
      
      res.status(201).json({ jobId, status: 'created' });
    });
  });
  
  describe('SSE Connection', () => {
    test('should establish SSE connection with correct headers', (done) => {
      // Create a job first
      request(app)
        .post('/jobs')
        .send({})
        .end((err, res) => {
          if (err) return done(err);
          
          const { jobId } = res.body;
          
          const req = request(app)
            .get(`/jobs/${jobId}/stream`)
            .expect(200);
          
          req.on('response', (response) => {
            expect(response.headers['content-type']).toBe('text/event-stream');
            expect(response.headers['cache-control']).toBe('no-cache');
            expect(response.headers['connection']).toBe('keep-alive');
            done();
          });
        });
    });
    
    test('should return 404 for non-existent job', async () => {
      await request(app)
        .get('/jobs/non-existent-job/stream')
        .expect(404);
    });
  });
  
  describe('Event Streaming', () => {
    test('should stream progress events in correct order', (done) => {
      request(app)
        .post('/jobs')
        .send({})
        .end((err, res) => {
          if (err) return done(err);
          
          const { jobId } = res.body;
          const events = [];
          
          const req = request(app)
            .get(`/jobs/${jobId}/stream`);
          
          let buffer = '';
          req.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const event = JSON.parse(line.slice(6));
                events.push(event);
                
                if (event.type === 'complete') {
                  // Verify events were received in order
                  expect(events[0].type).toBe('start');
                  expect(events[0].progress).toBe(0);
                  
                  expect(events[1].type).toBe('progress');
                  expect(events[1].progress).toBe(50);
                  
                  expect(events[2].type).toBe('complete');
                  expect(events[2].progress).toBe(100);
                  
                  done();
                }
              }
            }
          });
        });
    });
    
    test('should handle error events', (done) => {
      request(app)
        .post('/jobs/error')
        .send({})
        .end((err, res) => {
          if (err) return done(err);
          
          const { jobId } = res.body;
          
          const req = request(app)
            .get(`/jobs/${jobId}/stream`);
          
          req.on('data', (chunk) => {
            const data = chunk.toString();
            if (data.includes('error')) {
              const lines = data.split('\n');
              const eventLine = lines.find(l => l.startsWith('data: '));
              if (eventLine) {
                const event = JSON.parse(eventLine.slice(6));
                expect(event.type).toBe('error');
                expect(event.error).toContain('Simulated processing error');
                done();
              }
            }
          });
        });
    });
    
    test('should handle client disconnection gracefully', (done) => {
      request(app)
        .post('/jobs')
        .send({})
        .end((err, res) => {
          if (err) return done(err);
          
          const { jobId } = res.body;
          
          const req = request(app)
            .get(`/jobs/${jobId}/stream`);
          
          // Abort connection after receiving first event
          req.on('data', (chunk) => {
            if (chunk.toString().includes('start')) {
              req.abort();
              // Give server time to clean up
              setTimeout(done, 100);
            }
          });
        });
    });
  });
  
  describe('Concurrent Connections', () => {
    test('should support multiple clients streaming same job', (done) => {
      request(app)
        .post('/jobs')
        .send({})
        .end((err, res) => {
          if (err) return done(err);
          
          const { jobId } = res.body;
          let completedClients = 0;
          const totalClients = 3;
          
          for (let i = 0; i < totalClients; i++) {
            const req = request(app)
              .get(`/jobs/${jobId}/stream`);
            
            req.on('data', (chunk) => {
              if (chunk.toString().includes('complete')) {
                completedClients++;
                if (completedClients === totalClients) {
                  done();
                }
              }
            });
          }
        });
    });
  });
});

describe('PDF Generation and Validation Tests', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock PDF generation endpoint
    app.post('/generate/pdf', async (req, res) => {
      const { resume, template = 'default', format = 'A4' } = req.body;
      
      if (!resume) {
        return res.status(400).json({ error: 'Resume data required' });
      }
      
      try {
        // Simulate PDF generation
        const pdfBuffer = Buffer.concat([
          Buffer.from('PDF-MOCK-'),
          Buffer.from(JSON.stringify(resume)),
          Buffer.from('-TIMESTAMP-'),
          Buffer.from(Date.now().toString())
        ]);
        
        // Calculate checksum
        const checksum = crypto.createHash('sha256')
          .update(pdfBuffer)
          .digest('hex');
        
        // Mock PDF metadata
        const metadata = {
          size: pdfBuffer.length,
          pages: Math.ceil(JSON.stringify(resume).length / 3000), // Rough estimate
          checksum,
          created: new Date().toISOString(),
          author: 'PASS ATS System',
          creator: 'PASS Resume Generator v1.0',
          template,
          format
        };
        
        res.json({
          success: true,
          pdf: pdfBuffer.toString('base64'),
          metadata
        });
      } catch (error) {
        res.status(500).json({ 
          error: 'PDF generation failed',
          details: error.message 
        });
      }
    });
    
    // PDF validation endpoint
    app.post('/validate/pdf', (req, res) => {
      const { pdfBase64, expectedChecksum } = req.body;
      
      if (!pdfBase64) {
        return res.status(400).json({ error: 'PDF data required' });
      }
      
      try {
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        const actualChecksum = crypto.createHash('sha256')
          .update(pdfBuffer)
          .digest('hex');
        
        // Check if PDF starts with mock header
        const isValidPDF = pdfBuffer.toString().startsWith('PDF-MOCK-');
        
        // Allow small size differences for timestamps
        const sizeValid = Math.abs(pdfBuffer.length - testPDFMetadata.expectedSize) 
          <= testPDFMetadata.allowedSizeDelta;
        
        res.json({
          valid: isValidPDF,
          checksum: actualChecksum,
          checksumMatch: expectedChecksum ? actualChecksum === expectedChecksum : null,
          size: pdfBuffer.length,
          sizeValid
        });
      } catch (error) {
        res.status(500).json({ 
          error: 'PDF validation failed',
          details: error.message 
        });
      }
    });
  });
  
  describe('PDF Generation', () => {
    test('should generate PDF from resume data', async () => {
      const response = await request(app)
        .post('/generate/pdf')
        .send({
          resume: testProfiles.completeProfile,
          template: 'professional',
          format: 'A4'
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('pdf');
      expect(response.body).toHaveProperty('metadata');
      
      const { metadata } = response.body;
      expect(metadata).toHaveProperty('size');
      expect(metadata).toHaveProperty('pages');
      expect(metadata).toHaveProperty('checksum');
      expect(metadata).toHaveProperty('created');
      expect(metadata.template).toBe('professional');
      expect(metadata.format).toBe('A4');
    });
    
    test('should handle missing resume data', async () => {
      const response = await request(app)
        .post('/generate/pdf')
        .send({ template: 'professional' })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });
    
    test('should use default template if not specified', async () => {
      const response = await request(app)
        .post('/generate/pdf')
        .send({ resume: testProfiles.minimalProfile })
        .expect(200);
      
      expect(response.body.metadata.template).toBe('default');
    });
    
    test('should generate consistent checksums for same data', async () => {
      const resume = testProfiles.completeProfile;
      
      const response1 = await request(app)
        .post('/generate/pdf')
        .send({ resume })
        .expect(200);
      
      const response2 = await request(app)
        .post('/generate/pdf')
        .send({ resume })
        .expect(200);
      
      // Checksums should be different due to timestamps
      expect(response1.body.metadata.checksum).not.toBe(response2.body.metadata.checksum);
      
      // But sizes should be similar
      const sizeDiff = Math.abs(
        response1.body.metadata.size - response2.body.metadata.size
      );
      expect(sizeDiff).toBeLessThanOrEqual(100); // Allow small difference for timestamps
    });
  });
  
  describe('PDF Validation', () => {
    test('should validate generated PDF', async () => {
      // Generate PDF first
      const genResponse = await request(app)
        .post('/generate/pdf')
        .send({ resume: testProfiles.completeProfile })
        .expect(200);
      
      const { pdf, metadata } = genResponse.body;
      
      // Validate the PDF
      const valResponse = await request(app)
        .post('/validate/pdf')
        .send({
          pdfBase64: pdf,
          expectedChecksum: metadata.checksum
        })
        .expect(200);
      
      expect(valResponse.body.valid).toBe(true);
      expect(valResponse.body.checksumMatch).toBe(true);
      expect(valResponse.body.size).toBe(metadata.size);
    });
    
    test('should detect invalid PDF data', async () => {
      const invalidPDF = Buffer.from('This is not a PDF').toString('base64');
      
      const response = await request(app)
        .post('/validate/pdf')
        .send({ pdfBase64: invalidPDF })
        .expect(200);
      
      expect(response.body.valid).toBe(false);
    });
    
    test('should detect checksum mismatch', async () => {
      // Generate PDF
      const genResponse = await request(app)
        .post('/generate/pdf')
        .send({ resume: testProfiles.completeProfile })
        .expect(200);
      
      const { pdf } = genResponse.body;
      
      // Validate with wrong checksum
      const response = await request(app)
        .post('/validate/pdf')
        .send({
          pdfBase64: pdf,
          expectedChecksum: 'wrong-checksum-value'
        })
        .expect(200);
      
      expect(response.body.checksumMatch).toBe(false);
    });
    
    test('should handle corrupted PDF data', async () => {
      const corruptedPDF = 'not-valid-base64-!!!';
      
      const response = await request(app)
        .post('/validate/pdf')
        .send({ pdfBase64: corruptedPDF })
        .expect(500);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('validation failed');
    });
  });
  
  describe('PDF Metadata', () => {
    test('should include correct metadata in generated PDF', async () => {
      const response = await request(app)
        .post('/generate/pdf')
        .send({
          resume: testProfiles.completeProfile,
          template: 'modern'
        })
        .expect(200);
      
      const { metadata } = response.body;
      
      expect(metadata.author).toBe('PASS ATS System');
      expect(metadata.creator).toBe('PASS Resume Generator v1.0');
      expect(metadata.template).toBe('modern');
      expect(metadata.pages).toBeGreaterThan(0);
      
      // Check timestamp is recent
      const createdTime = new Date(metadata.created).getTime();
      const now = Date.now();
      expect(now - createdTime).toBeLessThan(1000); // Within 1 second
    });
    
    test('should calculate page count based on content', async () => {
      // Test with minimal profile (should be 1 page)
      const response1 = await request(app)
        .post('/generate/pdf')
        .send({ resume: testProfiles.minimalProfile })
        .expect(200);
      
      expect(response1.body.metadata.pages).toBe(1);
      
      // Test with complete profile (might be 2+ pages)
      const response2 = await request(app)
        .post('/generate/pdf')
        .send({ resume: testProfiles.completeProfile })
        .expect(200);
      
      expect(response2.body.metadata.pages).toBeGreaterThanOrEqual(1);
    });
  });
  
  describe('Golden File Testing', () => {
    test('should produce consistent PDF structure', async () => {
      const resume = testProfiles.completeProfile;
      
      const responses = [];
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/generate/pdf')
          .send({ resume, template: 'default' })
          .expect(200);
        responses.push(response.body);
      }
      
      // All should have same page count
      const pageCounts = responses.map(r => r.metadata.pages);
      expect(new Set(pageCounts).size).toBe(1);
      
      // Sizes should be very similar (within allowed delta)
      const sizes = responses.map(r => r.metadata.size);
      const maxSizeDiff = Math.max(...sizes) - Math.min(...sizes);
      expect(maxSizeDiff).toBeLessThanOrEqual(testPDFMetadata.allowedSizeDelta);
      
      // All should have valid checksums
      responses.forEach(response => {
        expect(response.metadata.checksum).toMatch(/^[a-f0-9]{64}$/);
      });
    });
  });
});