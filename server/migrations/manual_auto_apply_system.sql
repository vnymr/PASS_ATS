-- Auto-Apply System Migration
-- Run this SQL when database is accessible
-- Created: 2025-10-15

-- 1. Create AggregatedJob table (stores jobs from APIs)
CREATE TABLE "AggregatedJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL UNIQUE,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "salary" TEXT,
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "applyUrl" TEXT NOT NULL,
    "companyUrl" TEXT,
    "atsType" TEXT NOT NULL,
    "atsCompany" TEXT,
    "atsComplexity" TEXT NOT NULL,
    "atsConfidence" DOUBLE PRECISION NOT NULL,
    "aiApplyable" BOOLEAN NOT NULL DEFAULT false,
    "postedDate" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX "AggregatedJob_aiApplyable_postedDate_idx" ON "AggregatedJob"("aiApplyable", "postedDate");
CREATE INDEX "AggregatedJob_atsType_idx" ON "AggregatedJob"("atsType");
CREATE INDEX "AggregatedJob_isActive_postedDate_idx" ON "AggregatedJob"("isActive", "postedDate");
CREATE INDEX "AggregatedJob_source_idx" ON "AggregatedJob"("source");

-- 2. Create AutoApplication table (tracks application attempts)
CREATE TABLE "AutoApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "method" TEXT NOT NULL DEFAULT 'AI_AUTO',
    "submittedAt" TIMESTAMP(3),
    "confirmationUrl" TEXT,
    "confirmationId" TEXT,
    "confirmationData" JSONB,
    "error" TEXT,
    "errorType" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "AutoApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    CONSTRAINT "AutoApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AggregatedJob"("id") ON DELETE CASCADE,
    CONSTRAINT "AutoApplication_userId_jobId_key" UNIQUE ("userId", "jobId")
);

CREATE INDEX "AutoApplication_userId_status_idx" ON "AutoApplication"("userId", "status");
CREATE INDEX "AutoApplication_status_idx" ON "AutoApplication"("status");
CREATE INDEX "AutoApplication_createdAt_idx" ON "AutoApplication"("createdAt");

-- 3. Create ApplicationRecipe table (stores recorded automation steps)
CREATE TABLE "ApplicationRecipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL UNIQUE,
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
    "recordedBy" TEXT
);

CREATE INDEX "ApplicationRecipe_platform_idx" ON "ApplicationRecipe"("platform");
CREATE INDEX "ApplicationRecipe_atsType_idx" ON "ApplicationRecipe"("atsType");
CREATE INDEX "ApplicationRecipe_successRate_idx" ON "ApplicationRecipe"("successRate");

-- 4. Create RecipeExecution table (tracks each recipe use)
CREATE TABLE "RecipeExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "method" TEXT NOT NULL,
    "duration" INTEGER,
    "cost" DOUBLE PRECISION NOT NULL,
    "error" TEXT,
    "errorType" TEXT,
    "jobUrl" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecipeExecution_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "ApplicationRecipe"("id") ON DELETE CASCADE
);

CREATE INDEX "RecipeExecution_recipeId_executedAt_idx" ON "RecipeExecution"("recipeId", "executedAt");
CREATE INDEX "RecipeExecution_success_idx" ON "RecipeExecution"("success");

-- Done!
-- After running this migration, run: node test-recipe-system.js
