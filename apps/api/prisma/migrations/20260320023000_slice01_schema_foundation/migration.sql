-- Slice 01 schema foundation: lead intel + unified outbound queue
DO $$ BEGIN
  CREATE TYPE "QueueStatus" AS ENUM ('DRAFT', 'APPROVED', 'QUEUED', 'SENDING', 'SENT', 'FAILED', 'CANCELED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "lead_intel" (
  "id" TEXT NOT NULL,
  "lead_id" TEXT NOT NULL,
  "intel_type" TEXT NOT NULL,
  "title" TEXT,
  "summary" TEXT NOT NULL,
  "source_url" TEXT,
  "confidence" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_intel_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lead_intel_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "lead_intel_lead_id_idx" ON "lead_intel"("lead_id");
CREATE INDEX IF NOT EXISTS "lead_intel_intel_type_idx" ON "lead_intel"("intel_type");

CREATE TABLE IF NOT EXISTS "outbound_queue" (
  "id" TEXT NOT NULL,
  "channel" "Channel" NOT NULL,
  "leadId" TEXT,
  "draftId" TEXT,
  "campaignId" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "status" "QueueStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "sendAfter" TIMESTAMP(3),
  "failureReason" TEXT,
  "workerLockId" TEXT,
  "workerLockedAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outbound_queue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "outbound_queue_status_scheduledAt_idx" ON "outbound_queue"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "outbound_queue_channel_status_idx" ON "outbound_queue"("channel", "status");
CREATE INDEX IF NOT EXISTS "outbound_queue_leadId_idx" ON "outbound_queue"("leadId");
CREATE INDEX IF NOT EXISTS "outbound_queue_draftId_idx" ON "outbound_queue"("draftId");
