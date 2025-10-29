-- CreateTable: Track companies discovered through job aggregation
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
CREATE UNIQUE INDEX "DiscoveredCompany_atsType_slug_key" ON "DiscoveredCompany"("atsType", "slug");

-- CreateIndex
CREATE INDEX "DiscoveredCompany_atsType_isActive_idx" ON "DiscoveredCompany"("atsType", "isActive");

-- CreateIndex
CREATE INDEX "DiscoveredCompany_lastFetchedAt_idx" ON "DiscoveredCompany"("lastFetchedAt");
