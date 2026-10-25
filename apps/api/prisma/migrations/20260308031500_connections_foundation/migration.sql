-- Connections backend foundation

DO $$ BEGIN
  CREATE TYPE "ConnectionStatus" AS ENUM ('NOT_CONNECTED', 'CONNECTING', 'CONNECTED', 'DEGRADED', 'ERROR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Connection" (
  "id" TEXT PRIMARY KEY,
  "provider" "Channel" NOT NULL,
  "status" "ConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
  "accountId" TEXT,
  "scopes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "tokenRef" TEXT,
  "tokenMeta" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "lastSyncAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Connection_provider_key" ON "Connection"("provider");
