-- CreateEnum
CREATE TYPE "AutoApplicationStatus" AS ENUM ('QUEUED', 'APPLYING', 'SUBMITTED', 'FAILED', 'CANCELLED', 'RETRYING');

-- CreateTable
CREATE TABLE "AggregatedJob" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
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
    "extractedSkills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "extractedExperience" TEXT,
    "extractedEducation" TEXT,
    "extractedJobLevel" TEXT,
    "extractedKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "extractedBenefits" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "lastExtractedAt" TIMESTAMP(3),
    "extractionConfidence" DOUBLE PRECISION,
    "postedDate" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AggregatedJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationRecipe" (
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

-- CreateTable
CREATE TABLE "AutoApplication" (
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

-- CreateTable
CREATE TABLE "RecipeExecution" (
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

-- CreateTable
CREATE TABLE "DiscoveredCompany" (
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

-- CreateIndex
CREATE UNIQUE INDEX "AggregatedJob_externalId_key" ON "AggregatedJob"("externalId");

-- CreateIndex
CREATE INDEX "AggregatedJob_aiApplyable_postedDate_idx" ON "AggregatedJob"("aiApplyable", "postedDate");

-- CreateIndex
CREATE INDEX "AggregatedJob_atsType_idx" ON "AggregatedJob"("atsType");

-- CreateIndex
CREATE INDEX "AggregatedJob_isActive_postedDate_idx" ON "AggregatedJob"("isActive", "postedDate");

-- CreateIndex
CREATE INDEX "AggregatedJob_source_idx" ON "AggregatedJob"("source");

-- CreateIndex
CREATE INDEX "AggregatedJob_extractedSkills_idx" ON "AggregatedJob" USING GIN ("extractedSkills");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationRecipe_platform_key" ON "ApplicationRecipe"("platform");

-- CreateIndex
CREATE INDEX "ApplicationRecipe_platform_idx" ON "ApplicationRecipe"("platform");

-- CreateIndex
CREATE INDEX "ApplicationRecipe_atsType_idx" ON "ApplicationRecipe"("atsType");

-- CreateIndex
CREATE INDEX "ApplicationRecipe_successRate_idx" ON "ApplicationRecipe"("successRate");

-- CreateIndex
CREATE UNIQUE INDEX "AutoApplication_userId_jobId_key" ON "AutoApplication"("userId", "jobId");

-- CreateIndex
CREATE INDEX "AutoApplication_userId_status_idx" ON "AutoApplication"("userId", "status");

-- CreateIndex
CREATE INDEX "AutoApplication_status_idx" ON "AutoApplication"("status");

-- CreateIndex
CREATE INDEX "AutoApplication_createdAt_idx" ON "AutoApplication"("createdAt");

-- CreateIndex
CREATE INDEX "RecipeExecution_recipeId_executedAt_idx" ON "RecipeExecution"("recipeId", "executedAt");

-- CreateIndex
CREATE INDEX "RecipeExecution_success_idx" ON "RecipeExecution"("success");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveredCompany_atsType_slug_key" ON "DiscoveredCompany"("atsType", "slug");

-- CreateIndex
CREATE INDEX "DiscoveredCompany_atsType_isActive_idx" ON "DiscoveredCompany"("atsType", "isActive");

-- CreateIndex
CREATE INDEX "DiscoveredCompany_lastFetchedAt_idx" ON "DiscoveredCompany"("lastFetchedAt");

-- AddForeignKey
ALTER TABLE "AutoApplication" ADD CONSTRAINT "AutoApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoApplication" ADD CONSTRAINT "AutoApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AggregatedJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeExecution" ADD CONSTRAINT "RecipeExecution_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "ApplicationRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
