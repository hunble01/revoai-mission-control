CREATE TABLE "social_posts" (
  "id" TEXT NOT NULL,
  "channel" "Channel" NOT NULL,
  "body" TEXT NOT NULL,
  "mediaUrl" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "postedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'draft',
  "externalPostId" TEXT,
  "engagementStats" JSONB NOT NULL DEFAULT '{}',
  "sourceType" TEXT DEFAULT 'manual',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "social_posts_status_idx" ON "social_posts"("status");
CREATE INDEX "social_posts_channel_idx" ON "social_posts"("channel");
CREATE INDEX "social_posts_scheduledAt_idx" ON "social_posts"("scheduledAt");
