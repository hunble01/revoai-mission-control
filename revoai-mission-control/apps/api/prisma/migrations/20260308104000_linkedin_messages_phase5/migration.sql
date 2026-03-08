CREATE TABLE "linkedin_messages" (
  "id" TEXT NOT NULL,
  "leadId" TEXT,
  "draftId" TEXT,
  "messageBody" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "sentAt" TIMESTAMP(3),
  "replyReceivedAt" TIMESTAMP(3),
  "externalThreadId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "linkedin_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "linkedin_messages_status_idx" ON "linkedin_messages"("status");
CREATE INDEX "linkedin_messages_sentAt_idx" ON "linkedin_messages"("sentAt");
