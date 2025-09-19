-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('RESUME_JSON', 'LATEX_SOURCE', 'PDF_OUTPUT', 'JOB_DESCRIPTION', 'DIAGNOSTIC_LOG');

-- CreateEnum
CREATE TYPE "EmbeddingType" AS ENUM ('SKILL', 'EXPERIENCE', 'REQUIREMENT', 'KEYWORD');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "resumeText" TEXT NOT NULL,
    "jobDescription" TEXT NOT NULL,
    "aiMode" TEXT,
    "matchMode" TEXT,
    "error" TEXT,
    "diagnostics" JSONB,
    "processingLog" JSONB[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" BYTEA NOT NULL,
    "metadata" JSONB,
    "schema" JSONB,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Embedding" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentType" "EmbeddingType" NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "relevance" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Embedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_status_priority_createdAt_idx" ON "Job"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "Job_userId_idx" ON "Job"("userId");

-- CreateIndex
CREATE INDEX "Artifact_jobId_type_idx" ON "Artifact"("jobId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Artifact_jobId_type_version_key" ON "Artifact"("jobId", "type", "version");

-- CreateIndex
CREATE INDEX "Embedding_jobId_contentType_idx" ON "Embedding"("jobId", "contentType");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Embedding" ADD CONSTRAINT "Embedding_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
