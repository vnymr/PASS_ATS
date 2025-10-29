-- Fix Failed Migration
-- This resolves the Prisma migration issue by marking the failed migration as resolved

-- Mark the failed migration as applied (forces Prisma to skip it)
-- Run this directly on your database

BEGIN;

-- Delete the failed migration record
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20251104120000_add_auto_apply_tables';

-- Now let's check what tables exist and only create the missing ones

-- Create ENUM if not exists (PostgreSQL doesn't have CREATE IF NOT EXISTS for ENUM)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AutoApplicationStatus') THEN
        CREATE TYPE "AutoApplicationStatus" AS ENUM ('QUEUED', 'APPLYING', 'SUBMITTED', 'FAILED', 'CANCELLED', 'RETRYING');
    END IF;
END $$;

-- Create ApplicationRecipe table if not exists
CREATE TABLE IF NOT EXISTS "ApplicationRecipe" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "atsType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "steps" JSONB NOT NULL,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "recordingCost" DOUBLE PRECISION NOT NULL DEFAULT 0.80,
    "replayCost" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "totalSaved" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsed" TIMESTAMP(3),
    "lastFailure" TIMESTAMP(3),
    "recordedBy" TEXT,
    CONSTRAINT "ApplicationRecipe_pkey" PRIMARY KEY ("id")
);

-- Create AutoApplication table if not exists
CREATE TABLE IF NOT EXISTS "AutoApplication" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "AutoApplicationStatus" NOT NULL DEFAULT 'QUEUED',
    "method" TEXT NOT NULL DEFAULT 'AI_AUTO',
    "submittedAt" TIMESTAMP(3),
    "confirmationUrl" TEXT,
    "confirmationId" TEXT,
    "confirmationData" JSONB,
    "error" TEXT,
    "errorType" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "AutoApplication_pkey" PRIMARY KEY ("id")
);

-- Create RecipeExecution table if not exists
CREATE TABLE IF NOT EXISTS "RecipeExecution" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "method" TEXT NOT NULL,
    "duration" INTEGER,
    "cost" DOUBLE PRECISION NOT NULL,
    "error" TEXT,
    "errorType" TEXT,
    "jobUrl" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecipeExecution_pkey" PRIMARY KEY ("id")
);

-- Create DiscoveredCompany table if not exists
CREATE TABLE IF NOT EXISTS "DiscoveredCompany" (
    "id" TEXT NOT NULL,
    "atsType" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discoveredFrom" TEXT,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalJobs" INTEGER NOT NULL DEFAULT 0,
    "lastJobCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DiscoveredCompany_pkey" PRIMARY KEY ("id")
);

-- Create indexes (IF NOT EXISTS added for safety)
CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationRecipe_platform_key" ON "ApplicationRecipe"("platform");
CREATE INDEX IF NOT EXISTS "ApplicationRecipe_platform_idx" ON "ApplicationRecipe"("platform");
CREATE INDEX IF NOT EXISTS "ApplicationRecipe_atsType_idx" ON "ApplicationRecipe"("atsType");
CREATE INDEX IF NOT EXISTS "ApplicationRecipe_successRate_idx" ON "ApplicationRecipe"("successRate");

CREATE UNIQUE INDEX IF NOT EXISTS "AutoApplication_userId_jobId_key" ON "AutoApplication"("userId", "jobId");
CREATE INDEX IF NOT EXISTS "AutoApplication_userId_status_idx" ON "AutoApplication"("userId", "status");
CREATE INDEX IF NOT EXISTS "AutoApplication_status_idx" ON "AutoApplication"("status");
CREATE INDEX IF NOT EXISTS "AutoApplication_createdAt_idx" ON "AutoApplication"("createdAt");

CREATE INDEX IF NOT EXISTS "RecipeExecution_recipeId_executedAt_idx" ON "RecipeExecution"("recipeId", "executedAt");
CREATE INDEX IF NOT EXISTS "RecipeExecution_success_idx" ON "RecipeExecution"("success");

CREATE UNIQUE INDEX IF NOT EXISTS "DiscoveredCompany_atsType_slug_key" ON "DiscoveredCompany"("atsType", "slug");
CREATE INDEX IF NOT EXISTS "DiscoveredCompany_atsType_isActive_idx" ON "DiscoveredCompany"("atsType", "isActive");
CREATE INDEX IF NOT EXISTS "DiscoveredCompany_lastFetchedAt_idx" ON "DiscoveredCompany"("lastFetchedAt");

-- Add foreign keys only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AutoApplication_userId_fkey'
    ) THEN
        ALTER TABLE "AutoApplication" ADD CONSTRAINT "AutoApplication_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AutoApplication_jobId_fkey'
    ) THEN
        ALTER TABLE "AutoApplication" ADD CONSTRAINT "AutoApplication_jobId_fkey"
        FOREIGN KEY ("jobId") REFERENCES "AggregatedJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RecipeExecution_recipeId_fkey'
    ) THEN
        ALTER TABLE "RecipeExecution" ADD CONSTRAINT "RecipeExecution_recipeId_fkey"
        FOREIGN KEY ("recipeId") REFERENCES "ApplicationRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Mark migration as successful
INSERT INTO "_prisma_migrations" (
    "id",
    "checksum",
    "finished_at",
    "migration_name",
    "logs",
    "rolled_back_at",
    "started_at",
    "applied_steps_count"
) VALUES (
    gen_random_uuid()::text,
    '0',
    NOW(),
    '20251104120000_add_auto_apply_tables',
    NULL,
    NULL,
    NOW(),
    1
);

COMMIT;
