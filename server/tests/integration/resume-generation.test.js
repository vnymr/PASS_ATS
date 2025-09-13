import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { testProfiles, testJobDescriptions, mockOpenAIResponses, testResumes } from '../fixtures/testData.js';
import fs from 'fs/promises';
import path from 'path';

// Mock OpenAI
jest.mock('openai', () => {
  return {
    default: class OpenAI {
      constructor() {
        this.chat = {
          completions: {
            create: jest.fn()
          }
        };
      }
    }
  };
});

describe('Resume Generation Integration Tests', () => {
  let app;
  let openaiMock;
  let authToken;
  
  beforeAll(async () => {
    // Setup test environment
    process.env.JWT_SECRET = 'test-secret';
    process.env.OPENAI_API_KEY = 'sk-test-key';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3004';
    
    // Import and setup mocked OpenAI
    const OpenAI = (await import('openai')).default;
    openaiMock = new OpenAI();
  });
  
  beforeEach(async () => {
    // Create test app
    app = express();
    app.use(express.json());
    
    // Mock authentication
    authToken = 'test-token-123';
    
    // Mock authentication middleware
    const authenticateToken = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      req.user = { email: 'test@example.com' };
      next();
    };
    
    // Generate endpoint
    app.post('/generate', async (req, res) => {
      const { profile, jobDescription, outputSettings } = req.body;
      
      if (!profile || !jobDescription) {
        return res.status(400).json({ 
          error: 'Profile and job description required' 
        });
      }
      
      try {
        // Mock OpenAI response
        openaiMock.chat.completions.create.mockResolvedValue(
          mockOpenAIResponses.resumeGeneration.success
        );
        
        // Simulate AI processing
        const aiResponse = await openaiMock.chat.completions.create({
          model: 'gpt-5-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a professional resume writer.'
            },
            {
              role: 'user',
              content: `Generate resume for: ${JSON.stringify({ profile, jobDescription })}`
            }
          ]
        });
        
        const generatedContent = JSON.parse(
          aiResponse.choices[0].message.content
        );
        
        // Build resume
        const resume = {
          ...profile,
          summary: generatedContent.summary,
          experience: profile.experience?.map((exp, idx) => ({
            ...exp,
            bullets: generatedContent.experience?.[idx]?.bullets || []
          })),
          skills: generatedContent.skills,
          tailoredSections: generatedContent.tailoredSections
        };
        
        // Save to file
        const outputPath = path.join('/tmp', `resume-${Date.now()}.json`);
        await fs.writeFile(outputPath, JSON.stringify(resume, null, 2));
        
        res.json({
          success: true,
          resumePath: outputPath,
          resume
        });
      } catch (error) {
        res.status(500).json({ 
          error: 'Failed to generate resume',
          details: error.message 
        });
      }
    });
    
    // Generate with job endpoint (SSE)
    app.post('/generate/job', async (req, res) => {
      const { profile, jobDescription, jobId = 'test-job-123' } = req.body;
      
      if (!profile || !jobDescription) {
        return res.status(400).json({ 
          error: 'Profile and job description required' 
        });
      }
      
      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Job-Id', jobId);
      
      // Send events
      const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };
      
      try {
        // Start event
        sendEvent({ type: 'start', message: 'Starting generation', progress: 0 });
        
        // Progress events
        setTimeout(() => {
          sendEvent({ type: 'progress', message: 'Analyzing job description', progress: 25 });
        }, 100);
        
        setTimeout(() => {
          sendEvent({ type: 'progress', message: 'Tailoring resume', progress: 50 });
        }, 200);
        
        // Mock OpenAI call
        openaiMock.chat.completions.create.mockResolvedValue(
          mockOpenAIResponses.resumeGeneration.success
        );
        
        const aiResponse = await openaiMock.chat.completions.create({
          model: 'gpt-5-mini',
          messages: []
        });
        
        const generatedContent = JSON.parse(
          aiResponse.choices[0].message.content
        );
        
        // Complete event
        setTimeout(() => {
          sendEvent({
            type: 'complete',
            message: 'Resume generated successfully',
            progress: 100,
            data: {
              resumeUrl: '/output/resume.json',
              pdfUrl: '/output/resume.pdf',
              resume: generatedContent
            }
          });
          res.end();
        }, 300);
      } catch (error) {
        sendEvent({
          type: 'error',
          message: 'Generation failed',
          error: error.message
        });
        res.end();
      }
    });
    
    // Compile endpoint (PDF generation)
    app.post('/compile', async (req, res) => {
      const { resume, template = 'default' } = req.body;
      
      if (!resume) {
        return res.status(400).json({ error: 'Resume data required' });
      }
      
      try {
        // Simulate PDF generation
        const pdfPath = path.join('/tmp', `resume-${Date.now()}.pdf`);
        
        // Mock PDF creation (in real implementation, use pdf-lib or similar)
        await fs.writeFile(pdfPath, Buffer.from('Mock PDF content'));
        
        res.json({
          success: true,
          pdfPath,
          size: 1024,
          pages: 2
        });
      } catch (error) {
        res.status(500).json({ 
          error: 'Failed to generate PDF',
          details: error.message 
        });
      }
    });
  });
  
  describe('POST /generate', () => {
    test('should generate resume with valid profile and job description', async () => {
      const response = await request(app)
        .post('/generate')
        .send({
          profile: testProfiles.completeProfile,
          jobDescription: testJobDescriptions.seniorEngineer.description,
          outputSettings: { format: 'json' }
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('resume');
      expect(response.body.resume).toHaveProperty('summary');
      expect(response.body.resume).toHaveProperty('skills');
      expect(openaiMock.chat.completions.create).toHaveBeenCalled();
    });
    
    test('should tailor resume content to job description', async () => {
      openaiMock.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              summary: 'Software engineer with AWS and microservices expertise',
              skills: testJobDescriptions.seniorEngineer.priority,
              experience: [{
                bullets: [
                  'Developed microservices using Node.js and AWS',
                  'Implemented React applications with 40% performance gain'
                ]
              }]
            })
          }
        }]
      });
      
      const response = await request(app)
        .post('/generate')
        .send({
          profile: testProfiles.completeProfile,
          jobDescription: testJobDescriptions.seniorEngineer.description
        })
        .expect(200);
      
      // Check that skills match job requirements
      expect(response.body.resume.skills).toEqual(
        expect.arrayContaining(['JavaScript', 'React', 'Node.js', 'AWS'])
      );
      
      // Check that summary mentions key requirements
      expect(response.body.resume.summary).toContain('AWS');
      expect(response.body.resume.summary).toContain('microservices');
    });
    
    test('should handle missing profile', async () => {
      const response = await request(app)
        .post('/generate')
        .send({
          jobDescription: testJobDescriptions.seniorEngineer.description
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });
    
    test('should handle missing job description', async () => {
      const response = await request(app)
        .post('/generate')
        .send({
          profile: testProfiles.completeProfile
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });
    
    test('should handle OpenAI API errors gracefully', async () => {
      openaiMock.chat.completions.create.mockRejectedValue(
        new Error('OpenAI API rate limit exceeded')
      );
      
      const response = await request(app)
        .post('/generate')
        .send({
          profile: testProfiles.completeProfile,
          jobDescription: testJobDescriptions.seniorEngineer.description
        })
        .expect(500);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toContain('rate limit');
    });
    
    test('should save generated resume to file', async () => {
      const response = await request(app)
        .post('/generate')
        .send({
          profile: testProfiles.completeProfile,
          jobDescription: testJobDescriptions.seniorEngineer.description
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('resumePath');
      
      // Verify file was created
      const fileContent = await fs.readFile(response.body.resumePath, 'utf-8');
      const savedResume = JSON.parse(fileContent);
      expect(savedResume).toHaveProperty('name', testProfiles.completeProfile.name);
    });
  });
  
  describe('POST /generate/job (SSE)', () => {
    test('should stream progress events', (done) => {
      const req = request(app)
        .post('/generate/job')
        .send({
          profile: testProfiles.completeProfile,
          jobDescription: testJobDescriptions.seniorEngineer.description,
          jobId: 'test-123'
        })
        .expect(200);
      
      const events = [];
      let buffer = '';
      
      req.on('response', (res) => {
        expect(res.headers['content-type']).toBe('text/event-stream');
        expect(res.headers['x-job-id']).toBe('test-123');
      });
      
      req.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            events.push(data);
            
            if (data.type === 'complete') {
              expect(events).toContainEqual(
                expect.objectContaining({ type: 'start' })
              );
              expect(events).toContainEqual(
                expect.objectContaining({ type: 'progress' })
              );
              expect(events).toContainEqual(
                expect.objectContaining({ 
                  type: 'complete',
                  progress: 100 
                })
              );
              done();
            }
          }
        }
      });
      
      req.on('error', done);
    });
    
    test('should handle errors during generation', (done) => {
      openaiMock.chat.completions.create.mockRejectedValue(
        new Error('API Error')
      );
      
      const req = request(app)
        .post('/generate/job')
        .send({
          profile: testProfiles.completeProfile,
          jobDescription: testJobDescriptions.seniorEngineer.description
        });
      
      req.on('data', (chunk) => {
        const data = chunk.toString();
        if (data.includes('error')) {
          const event = JSON.parse(data.replace('data: ', ''));
          expect(event.type).toBe('error');
          expect(event.message).toContain('failed');
          done();
        }
      });
      
      req.on('error', done);
    });
  });
  
  describe('POST /compile', () => {
    test('should generate PDF from resume data', async () => {
      const response = await request(app)
        .post('/compile')
        .send({
          resume: testResumes.goldStandard,
          template: 'professional'
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('pdfPath');
      expect(response.body).toHaveProperty('size');
      expect(response.body).toHaveProperty('pages');
    });
    
    test('should handle missing resume data', async () => {
      const response = await request(app)
        .post('/compile')
        .send({ template: 'professional' })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });
    
    test('should use default template if not specified', async () => {
      const response = await request(app)
        .post('/compile')
        .send({ resume: testResumes.goldStandard })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
    });
  });
  
  describe('Resume Quality Validation', () => {
    test('should ensure generated resume meets minimum quality standards', async () => {
      const response = await request(app)
        .post('/generate')
        .send({
          profile: testProfiles.completeProfile,
          jobDescription: testJobDescriptions.seniorEngineer.description
        })
        .expect(200);
      
      const resume = response.body.resume;
      
      // Check required fields
      expect(resume).toHaveProperty('name');
      expect(resume).toHaveProperty('email');
      expect(resume).toHaveProperty('summary');
      expect(resume.summary.length).toBeGreaterThan(50);
      
      // Check experience bullets
      if (resume.experience && resume.experience.length > 0) {
        resume.experience.forEach(exp => {
          expect(exp).toHaveProperty('bullets');
          expect(Array.isArray(exp.bullets)).toBe(true);
          expect(exp.bullets.length).toBeGreaterThan(0);
        });
      }
      
      // Check skills
      expect(resume).toHaveProperty('skills');
      expect(Array.isArray(resume.skills)).toBe(true);
      expect(resume.skills.length).toBeGreaterThan(0);
    });
    
    test('should include keywords from job description', async () => {
      const jobKeywords = testJobDescriptions.seniorEngineer.priority;
      
      const response = await request(app)
        .post('/generate')
        .send({
          profile: testProfiles.completeProfile,
          jobDescription: testJobDescriptions.seniorEngineer.description
        })
        .expect(200);
      
      const resume = response.body.resume;
      const resumeText = JSON.stringify(resume).toLowerCase();
      
      // Check that key requirements appear in resume
      jobKeywords.forEach(keyword => {
        expect(resumeText).toContain(keyword.toLowerCase());
      });
    });
  });
});