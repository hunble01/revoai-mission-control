DO $$ BEGIN
  CREATE TYPE "ConnectionHealth" AS ENUM ('HEALTHY', 'DEGRADED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Connection"
  ADD COLUMN IF NOT EXISTS "health" "ConnectionHealth" NOT NULL DEFAULT 'DEGRADED',
  ADD COLUMN IF NOT EXISTS "lastCheckedAt" TIMESTAMP(3);
