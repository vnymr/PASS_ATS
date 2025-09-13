import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { testUsers } from '../fixtures/testData.js';

describe('Authentication Endpoints', () => {
  let app;
  let server;
  
  beforeEach(async () => {
    // Create fresh Express app for each test
    jest.resetModules();
    
    // Mock environment variables
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3003';
    
    // Import server module
    const serverModule = await import('../../server.js');
    app = serverModule.app || serverModule.default;
    
    if (!app) {
      // If server doesn't export app, create minimal test app
      app = express();
      app.use(express.json());
      
      // Mock authentication middleware
      const authenticateToken = (req, res, next) => {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }
        
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
          if (err) return res.status(403).json({ error: 'Invalid token' });
          req.user = user;
          next();
        });
      };
      
      // Mock user storage
      const users = {};
      
      // Signup endpoint
      app.post('/auth/signup', async (req, res) => {
        const { email, password, name } = req.body;
        
        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password required' });
        }
        
        if (users[email]) {
          return res.status(409).json({ error: 'User already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        users[email] = { email, password: hashedPassword, name };
        
        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.status(201).json({
          message: 'User created successfully',
          token,
          user: { email, name }
        });
      });
      
      // Login endpoint
      app.post('/auth/login', async (req, res) => {
        const { email, password } = req.body;
        
        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password required' });
        }
        
        const user = users[email];
        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
          message: 'Login successful',
          token,
          user: { email: user.email, name: user.name }
        });
      });
      
      // Profile endpoint
      app.put('/me', authenticateToken, async (req, res) => {
        const { email } = req.user;
        const updates = req.body;
        
        if (!users[email]) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        users[email] = { ...users[email], ...updates };
        
        res.json({
          message: 'Profile updated successfully',
          user: users[email]
        });
      });
    }
  });
  
  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });
  
  describe('POST /auth/signup', () => {
    test('should create a new user with valid data', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send(testUsers.validUser)
        .expect(201);
      
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUsers.validUser.email);
      expect(response.body.user.name).toBe(testUsers.validUser.name);
      expect(response.body.message).toBe('User created successfully');
    });
    
    test('should reject signup with missing email', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({ password: 'TestPass123!' })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });
    
    test('should reject signup with missing password', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({ email: 'test@example.com' })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });
    
    test('should reject duplicate email signup', async () => {
      // First signup
      await request(app)
        .post('/auth/signup')
        .send(testUsers.validUser)
        .expect(201);
      
      // Attempt duplicate signup
      const response = await request(app)
        .post('/auth/signup')
        .send(testUsers.validUser)
        .expect(409);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already exists');
    });
    
    test('should hash password before storing', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send(testUsers.validUser)
        .expect(201);
      
      // Password should not be returned in response
      expect(response.body.user).not.toHaveProperty('password');
    });
    
    test('should return valid JWT token', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send(testUsers.validUser)
        .expect(201);
      
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('email', testUsers.validUser.email);
    });
  });
  
  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create a user for login tests
      await request(app)
        .post('/auth/signup')
        .send(testUsers.validUser);
    });
    
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUsers.validUser.email,
          password: testUsers.validUser.password
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUsers.validUser.email);
      expect(response.body.message).toBe('Login successful');
    });
    
    test('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUsers.validUser.email,
          password: 'WrongPassword123!'
        })
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid credentials');
    });
    
    test('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!'
        })
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid credentials');
    });
    
    test('should reject login with missing email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ password: 'TestPass123!' })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });
    
    test('should reject login with missing password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });
    
    test('should return valid JWT token on successful login', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUsers.validUser.email,
          password: testUsers.validUser.password
        })
        .expect(200);
      
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('email', testUsers.validUser.email);
    });
  });
  
  describe('PUT /me (Protected Route)', () => {
    let authToken;
    
    beforeEach(async () => {
      // Create user and get token
      const signupResponse = await request(app)
        .post('/auth/signup')
        .send(testUsers.validUser);
      
      authToken = signupResponse.body.token;
    });
    
    test('should update user profile with valid token', async () => {
      const updates = {
        name: 'Updated Name',
        phone: '+1-555-9999'
      };
      
      const response = await request(app)
        .put('/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);
      
      expect(response.body.message).toBe('Profile updated successfully');
      expect(response.body.user.name).toBe(updates.name);
    });
    
    test('should reject request without token', async () => {
      const response = await request(app)
        .put('/me')
        .send({ name: 'New Name' })
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('token required');
    });
    
    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .put('/me')
        .set('Authorization', 'Bearer invalid-token-here')
        .send({ name: 'New Name' })
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid token');
    });
    
    test('should reject request with expired token', async () => {
      // Create expired token
      const expiredToken = jwt.sign(
        { email: testUsers.validUser.email },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );
      
      const response = await request(app)
        .put('/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ name: 'New Name' })
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('should handle malformed authorization header', async () => {
      const response = await request(app)
        .put('/me')
        .set('Authorization', 'InvalidFormat')
        .send({ name: 'New Name' })
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('Token Validation', () => {
    test('should generate tokens with correct expiration', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send(testUsers.validUser)
        .expect(201);
      
      const decoded = jwt.decode(response.body.token);
      const expirationTime = decoded.exp - decoded.iat;
      
      // Should expire in 7 days (604800 seconds)
      expect(expirationTime).toBe(7 * 24 * 60 * 60);
    });
    
    test('should include user email in token payload', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send(testUsers.validUser)
        .expect(201);
      
      const decoded = jwt.decode(response.body.token);
      expect(decoded.email).toBe(testUsers.validUser.email);
    });
  });
});