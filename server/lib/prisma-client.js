import { PrismaClient } from '@prisma/client';

// Create a single instance of PrismaClient to be shared across the application
const globalForPrisma = global;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error', 'warn'],
    errorFormat: 'minimal',
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;