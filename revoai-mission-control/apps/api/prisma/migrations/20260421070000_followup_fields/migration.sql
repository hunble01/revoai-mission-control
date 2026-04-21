-- Follow-up sequence tracking per Lead
ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "followUpStage" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastOutboundAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastEngagementAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sequencePausedReason" TEXT;

CREATE INDEX IF NOT EXISTS "Lead_followUpStage_lastOutboundAt_idx"
  ON "Lead" ("followUpStage", "lastOutboundAt")
  WHERE "followUpStage" < 99;
