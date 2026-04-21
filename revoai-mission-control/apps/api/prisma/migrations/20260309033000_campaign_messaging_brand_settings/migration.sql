ALTER TABLE "Campaign"
  ADD COLUMN IF NOT EXISTS "pain_point" TEXT,
  ADD COLUMN IF NOT EXISTS "your_offer" TEXT,
  ADD COLUMN IF NOT EXISTS "your_proof" TEXT,
  ADD COLUMN IF NOT EXISTS "email_subject_template" TEXT,
  ADD COLUMN IF NOT EXISTS "email_body_template" TEXT,
  ADD COLUMN IF NOT EXISTS "email_ai_generate" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "dm_body_template" TEXT,
  ADD COLUMN IF NOT EXISTS "dm_ai_generate" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "followup_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "followup_sequence" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "send_window_from" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "send_window_to" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "send_days" JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS "brand_settings" (
  "id" TEXT PRIMARY KEY DEFAULT 'default',
  "yourName" TEXT,
  "yourTitle" TEXT,
  "companyName" TEXT,
  "phoneNumber" TEXT,
  "websiteUrl" TEXT,
  "logoData" TEXT,
  "signatureStyle" TEXT NOT NULL DEFAULT 'Professional',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "brand_settings" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING;
