CREATE TABLE IF NOT EXISTS "OutboundSend" (
  "id" TEXT PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "draftId" TEXT,
  "leadId" TEXT,
  "status" TEXT NOT NULL,
  "externalMessageId" TEXT,
  "error" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "OutboundSend_provider_idx" ON "OutboundSend"("provider");
CREATE INDEX IF NOT EXISTS "OutboundSend_draftId_idx" ON "OutboundSend"("draftId");
CREATE INDEX IF NOT EXISTS "OutboundSend_leadId_idx" ON "OutboundSend"("leadId");
