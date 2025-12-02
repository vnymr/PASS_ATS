/**
 * Worker Authentication Middleware
 * Separate authentication system for workers (not users)
 */

import jwt from 'jsonwebtoken';
import { prisma } from './prisma-client.js';
import logger from './logger.js';

const WORKER_JWT_SECRET = process.env.WORKER_JWT_SECRET || process.env.JWT_SECRET;

/**
 * Middleware to authenticate worker requests
 */
export const authenticateWorker = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Worker access token required' });
  }

  try {
    const decoded = jwt.verify(token, WORKER_JWT_SECRET);

    // Verify worker exists and is active
    const worker = await prisma.worker.findUnique({
      where: { id: decoded.workerId }
    });

    if (!worker) {
      return res.status(401).json({ error: 'Worker not found' });
    }

    if (!worker.isActive) {
      return res.status(403).json({ error: 'Worker account is inactive' });
    }

    // Update last active timestamp
    await prisma.worker.update({
      where: { id: worker.id },
      data: { lastActiveAt: new Date() }
    });

    req.worker = worker;
    req.workerId = worker.id;
    next();
  } catch (err) {
    logger.warn({ error: err.message }, 'Worker authentication failed');
    return res.status(403).json({ error: 'Invalid or expired worker token' });
  }
};

/**
 * Generate JWT token for worker
 */
export const generateWorkerToken = (worker) => {
  return jwt.sign(
    {
      workerId: worker.id,
      email: worker.email,
      role: worker.role
    },
    WORKER_JWT_SECRET,
    { expiresIn: '12h' }
  );
};

/**
 * Middleware to check if worker has admin role
 */
export const requireWorkerAdmin = (req, res, next) => {
  if (!req.worker || req.worker.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export default { authenticateWorker, generateWorkerToken, requireWorkerAdmin };
