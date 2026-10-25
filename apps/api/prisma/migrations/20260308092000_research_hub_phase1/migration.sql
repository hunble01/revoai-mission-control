-- Create research hub phase 1 tables
CREATE TABLE "research_runs" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "research_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "research_leads" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "contactName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "linkedinUrl" TEXT,
  "sourceUrl" TEXT,
  "sourceType" TEXT NOT NULL DEFAULT 'research_agent',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "research_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "research_content" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "videoAngle" TEXT,
  "sourceUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "research_content_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "research_intel" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "competitor" TEXT NOT NULL,
  "insight" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "research_intel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "research_runs_createdAt_idx" ON "research_runs"("createdAt");
CREATE INDEX "research_leads_runId_idx" ON "research_leads"("runId");
CREATE INDEX "research_content_runId_idx" ON "research_content"("runId");
CREATE INDEX "research_intel_runId_idx" ON "research_intel"("runId");

ALTER TABLE "research_leads"
  ADD CONSTRAINT "research_leads_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "research_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "research_content"
  ADD CONSTRAINT "research_content_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "research_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "research_intel"
  ADD CONSTRAINT "research_intel_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "research_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
