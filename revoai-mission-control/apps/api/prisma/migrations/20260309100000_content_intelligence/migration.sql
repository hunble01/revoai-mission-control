CREATE TABLE IF NOT EXISTS "content_ideas" (
  "id" TEXT PRIMARY KEY,
  "platform" TEXT NOT NULL,
  "headline" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "contentType" TEXT NOT NULL,
  "angle" TEXT NOT NULL,
  "aiDraft" TEXT NOT NULL,
  "dismissed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "content_ideas_dismissed_idx" ON "content_ideas"("dismissed");
CREATE INDEX IF NOT EXISTS "content_ideas_createdAt_idx" ON "content_ideas"("createdAt");

CREATE TABLE IF NOT EXISTS "competitor_intel" (
  "id" TEXT PRIMARY KEY,
  "competitorName" TEXT NOT NULL,
  "linkedinUrl" TEXT,
  "facebookUrl" TEXT,
  "recentPosts" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "topTopics" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "contentGaps" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "postingFrequency" TEXT,
  "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "competitor_intel_competitorName_idx" ON "competitor_intel"("competitorName");
CREATE INDEX IF NOT EXISTS "competitor_intel_lastUpdated_idx" ON "competitor_intel"("lastUpdated");
