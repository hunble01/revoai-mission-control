CREATE TABLE "provider_tokens" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "accountId" TEXT,
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT,
  "expiresAt" TIMESTAMP(3),
  "scope" TEXT,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_tokens_provider_key" ON "provider_tokens"("provider");
CREATE INDEX "provider_tokens_expiresAt_idx" ON "provider_tokens"("expiresAt");
