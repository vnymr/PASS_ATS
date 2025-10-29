-- Migration: Add AI-extracted metadata fields to AggregatedJob table
-- This enables storing LLM-extracted skills, experience, and other job metadata

-- Add new columns for extracted metadata
ALTER TABLE "AggregatedJob"
ADD COLUMN IF NOT EXISTS "extractedSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "extractedExperience" TEXT,
ADD COLUMN IF NOT EXISTS "extractedEducation" TEXT,
ADD COLUMN IF NOT EXISTS "extractedJobLevel" TEXT,
ADD COLUMN IF NOT EXISTS "extractedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "extractedBenefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "lastExtractedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "extractionConfidence" DOUBLE PRECISION;

-- Add index on extractedSkills for faster searches
CREATE INDEX IF NOT EXISTS "AggregatedJob_extractedSkills_idx" ON "AggregatedJob" USING GIN ("extractedSkills");

-- Update existing jobs to mark them as needing extraction
-- (lastExtractedAt will be NULL, so they'll be extracted on next sync)
UPDATE "AggregatedJob"
SET "lastExtractedAt" = NULL
WHERE "lastExtractedAt" IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN "AggregatedJob"."extractedSkills" IS 'AI-extracted skills from job description (all types: technical, soft, domain)';
COMMENT ON COLUMN "AggregatedJob"."extractedExperience" IS 'Required experience (e.g., "3+ years", "5-7 years")';
COMMENT ON COLUMN "AggregatedJob"."extractedEducation" IS 'Required education level';
COMMENT ON COLUMN "AggregatedJob"."extractedJobLevel" IS 'Job seniority level (Entry, Mid, Senior, Lead, Executive)';
COMMENT ON COLUMN "AggregatedJob"."extractedKeywords" IS 'Important keywords and technologies from job posting';
COMMENT ON COLUMN "AggregatedJob"."extractedBenefits" IS 'Benefits and perks mentioned in job posting';
COMMENT ON COLUMN "AggregatedJob"."lastExtractedAt" IS 'Timestamp of last metadata extraction';
COMMENT ON COLUMN "AggregatedJob"."extractionConfidence" IS 'Confidence score (0.0 to 1.0) for extraction quality';
