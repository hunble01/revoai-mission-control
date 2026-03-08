-- Lead status + lead enrichment fields for phase 1
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'RESEARCHED';

ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "linkedinUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "preferredChannel" "Channel";
